#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
readonly backup_dir="${1:-${project_dir}/backups}"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly backup_name="fin_workspace_${timestamp}.dump"
readonly backup_file="${backup_dir}/${backup_name}"
readonly partial_file="${backup_file}.partial"

compose() {
  docker compose \
    --project-directory "${project_dir}" \
    --file "${project_dir}/docker-compose.yml" \
    "$@"
}

fail() {
  printf 'Backup failed: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  rm -f -- "${partial_file}"
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed or is not in PATH"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is not installed or is not in PATH"
mkdir -p -- "${backup_dir}"
chmod 700 -- "${backup_dir}"
umask 077
trap cleanup EXIT HUP INT TERM

compose exec -T db sh -ec '
  : "${POSTGRES_USER:?POSTGRES_USER is not configured}"
  : "${POSTGRES_DB:?POSTGRES_DB is not configured}"
  pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-acl
' > "${partial_file}"

[[ -s "${partial_file}" ]] || fail "pg_dump created an empty file"

compose exec -T db pg_restore --list < "${partial_file}" >/dev/null

mv -- "${partial_file}" "${backup_file}"
chmod 600 -- "${backup_file}"

(
  cd -- "${backup_dir}"
  sha256sum -- "${backup_name}" > "${backup_name}.sha256"
  chmod 600 -- "${backup_name}.sha256"
)

trap - EXIT HUP INT TERM

printf 'Backup completed successfully.\n'
printf 'Dump: %s\n' "${backup_file}"
printf 'Checksum: %s.sha256\n' "${backup_file}"
du -h -- "${backup_file}"
