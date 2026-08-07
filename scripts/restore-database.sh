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
  printf 'Restore failed: %s\n' "$1" >&2
  exit 1
}

print_usage() {
  printf 'Usage: %s <backup.dump> --yes\n' "$0" >&2
  printf 'Warning: this replaces the configured PostgreSQL database.\n' >&2
}

if [[ $# -ne 2 || "$2" != "--yes" ]]; then
  print_usage
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

[[ -f "${checksum_file}" ]] || fail "checksum file does not exist: ${checksum_file}"

(
  cd -- "${backup_dir}"
  sha256sum --check -- "${backup_name}.sha256"
)

compose exec -T db pg_restore --list < "${backup_file}" >/dev/null

printf 'Stopping application services...\n'
compose stop app recurring-worker

printf 'Recreating the target database...\n'
compose exec -T db sh -ec '
  : "${POSTGRES_USER:?POSTGRES_USER is not configured}"
  : "${POSTGRES_DB:?POSTGRES_DB is not configured}"
  dropdb \
    --username="$POSTGRES_USER" \
    --force \
    --if-exists \
    "$POSTGRES_DB"
  createdb \
    --username="$POSTGRES_USER" \
    --owner="$POSTGRES_USER" \
    "$POSTGRES_DB"
'

printf 'Restoring backup...\n'
compose exec -T db sh -ec '
  pg_restore \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-owner \
    --no-acl \
    --exit-on-error \
    --verbose
' < "${backup_file}"

printf 'Applying pending migrations...\n'
compose run --rm migrate

printf 'Starting application services...\n'
compose up -d app recurring-worker

compose exec -T db sh -ec '
  psql \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --command="SELECT 1" \
    | grep -q 1
'

printf 'Restore completed successfully from: %s\n' "${backup_file}"
