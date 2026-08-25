#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
readonly verify_sql="${script_dir}/financial-plan/verify-jar-backfill.sql"
readonly backfill_sql="${project_dir}/prisma/migrations/20260824083500_backfill_financial_jars/migration.sql"

compose() {
  docker compose \
    --project-directory "${project_dir}" \
    --file "${project_dir}/docker-compose.yml" \
    "$@"
}

fail() {
  printf 'Migration rehearsal failed: %s\n' "$1" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <backup.dump>\n' "$0" >&2
  exit 2
fi

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

readonly requested_backup_file="$1"
[[ -f "${requested_backup_file}" ]] || fail "backup file does not exist: ${requested_backup_file}"
[[ -f "${verify_sql}" ]] || fail "verification SQL does not exist: ${verify_sql}"
[[ -f "${backfill_sql}" ]] || fail "backfill SQL does not exist: ${backfill_sql}"

readonly backup_dir="$(cd -- "$(dirname -- "${requested_backup_file}")" && pwd -P)"
readonly backup_name="$(basename -- "${requested_backup_file}")"
readonly backup_file="${backup_dir}/${backup_name}"
readonly checksum_file="${backup_file}.sha256"
readonly rehearsal_database="fin_workspace_migration_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"
readonly report_file="${backup_dir}/${backup_name%.dump}_migration_rehearsal.json"
readonly partial_file="${report_file}.partial"

[[ -f "${checksum_file}" ]] || fail "checksum file does not exist: ${checksum_file}"

cleanup() {
  rm -f -- "${partial_file}"
  compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" db sh -ec '
    dropdb \
      --username="$POSTGRES_USER" \
      --force \
      --if-exists \
      "$REHEARSAL_DATABASE"
  ' >/dev/null 2>&1 || true
}

trap cleanup EXIT HUP INT TERM

(cd -- "${backup_dir}" && sha256sum --check -- "${backup_name}.sha256")

compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" db sh -ec '
  createdb \
    --username="$POSTGRES_USER" \
    --owner="$POSTGRES_USER" \
    "$REHEARSAL_DATABASE"
'

compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" db sh -ec '
  pg_restore \
    --username="$POSTGRES_USER" \
    --dbname="$REHEARSAL_DATABASE" \
    --no-owner \
    --no-acl \
    --exit-on-error
' < "${backup_file}"

# Execute the data-only migration a second time before verification. This is
# deliberate: production recovery may replay the backfill after a partial
# deployment. It must run before the Phase 8 contract removes legacy columns.
compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" db sh -ec '
  exec psql \
    --username="$POSTGRES_USER" \
    --dbname="$REHEARSAL_DATABASE" \
    --quiet \
    --set=ON_ERROR_STOP=1
' < "${backfill_sql}"

compose run --rm --no-deps --build -e REHEARSAL_DATABASE="${rehearsal_database}" migrate sh -ec '
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${REHEARSAL_DATABASE}?schema=public"
  pnpm prisma:deploy
'

compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" db sh -ec '
  export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000"
  exec psql \
    --username="$POSTGRES_USER" \
    --dbname="$REHEARSAL_DATABASE" \
    --no-align \
    --tuples-only \
    --quiet \
    --set=ON_ERROR_STOP=1
' < "${verify_sql}" > "${partial_file}"

node -e '
  const fs = require("node:fs");
  const source = process.argv[1];
  const destination = process.argv[2];
  const report = JSON.parse(fs.readFileSync(source, "utf8").trim());
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  if (report.invariantIssueCount !== 0) process.exitCode = 2;
' "${partial_file}" "${report_file}"

trap - EXIT HUP INT TERM
cleanup

printf 'Migration rehearsal succeeded.\n'
printf 'Report: %s\n' "${report_file}"
