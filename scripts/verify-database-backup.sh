#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"

compose() {
  docker compose \
    --project-directory "${project_dir}" \
    --file "${project_dir}/docker-compose.yml" \
    "$@"
}

fail() {
  printf 'Backup verification failed: %s\n' "$1" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <backup.dump>\n' "$0" >&2
  exit 2
fi

command -v docker >/dev/null 2>&1 || fail "docker is not installed or is not in PATH"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is not installed or is not in PATH"

readonly requested_backup_file="$1"
[[ -f "${requested_backup_file}" ]] || fail "backup file does not exist: ${requested_backup_file}"

readonly backup_dir="$(cd -- "$(dirname -- "${requested_backup_file}")" && pwd -P)"
readonly backup_name="$(basename -- "${requested_backup_file}")"
readonly backup_file="${backup_dir}/${backup_name}"
readonly checksum_file="${backup_file}.sha256"
readonly rehearsal_database="fin_workspace_restore_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"

[[ -f "${checksum_file}" ]] || fail "checksum file does not exist: ${checksum_file}"

cleanup() {
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
compose exec -T db pg_restore --list < "${backup_file}" >/dev/null

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

readonly signature_sql='SELECT json_build_object(
  '\''wallet_count'\'', (SELECT count(*) FROM "WALLETS"),
  '\''opening_balance'\'', (SELECT coalesce(sum(opening_balance), 0)::text FROM "WALLETS"),
  '\''current_balance'\'', (SELECT coalesce(sum(current_balance), 0)::text FROM "WALLETS"),
  '\''transaction_count'\'', (SELECT count(*) FROM "TRANSACTION"),
  '\''transaction_amount'\'', (SELECT coalesce(sum(amount), 0)::text FROM "TRANSACTION"),
  '\''migration_count'\'', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL)
)::text;'

readonly source_signature="$(compose exec -T -e SIGNATURE_SQL="${signature_sql}" db sh -ec '
  psql \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-align \
    --tuples-only \
    --quiet \
    --set=ON_ERROR_STOP=1 \
    --command="$SIGNATURE_SQL"
')"

readonly restored_signature="$(compose exec -T -e REHEARSAL_DATABASE="${rehearsal_database}" -e SIGNATURE_SQL="${signature_sql}" db sh -ec '
  psql \
    --username="$POSTGRES_USER" \
    --dbname="$REHEARSAL_DATABASE" \
    --no-align \
    --tuples-only \
    --quiet \
    --set=ON_ERROR_STOP=1 \
    --command="$SIGNATURE_SQL"
')"

[[ -n "${source_signature}" ]] || fail "source signature is empty"
[[ "${source_signature}" == "${restored_signature}" ]] || {
  printf 'Source signature:   %s\n' "${source_signature}" >&2
  printf 'Restored signature: %s\n' "${restored_signature}" >&2
  fail "restored database signature does not match source"
}

printf 'Backup restore rehearsal succeeded.\n'
printf 'Verified signature: %s\n' "${restored_signature}"
