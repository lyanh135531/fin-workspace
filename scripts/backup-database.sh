#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
readonly backup_dir="${1:-${project_dir}/backups}"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly backup_name="fin_workspace_${timestamp}.dump"
readonly backup_file="${backup_dir}/${backup_name}"
readonly partial_file="${backup_file}.partial"
readonly checksum_file="${backup_file}.sha256"
readonly checksum_partial_file="${checksum_file}.partial"
readonly retention_count=2

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
  rm -f -- "${partial_file}" "${checksum_partial_file}"
}

prune_old_backups() {
  local -a backups=()
  local index
  local old_backup

  mapfile -d '' -t backups < <(
    find "${backup_dir}" \
      -maxdepth 1 \
      -type f \
      -name 'fin_workspace_????????T??????Z.dump' \
      -printf '%f\0' \
      | LC_ALL=C sort -z -r
  )

  if (( ${#backups[@]} <= retention_count )); then
    return
  fi

  for ((index = retention_count; index < ${#backups[@]}; index++)); do
    old_backup="${backups[index]}"
    rm -f -- \
      "${backup_dir}/${old_backup}" \
      "${backup_dir}/${old_backup}.sha256"
    printf 'Removed old backup: %s\n' "${backup_dir}/${old_backup}"
  done
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed or is not in PATH"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is not installed or is not in PATH"
command -v flock >/dev/null 2>&1 || fail "flock is not installed or is not in PATH"
umask 077
mkdir -p -- "${backup_dir}"
chmod 700 -- "${backup_dir}"
trap cleanup EXIT HUP INT TERM

exec 9>"${backup_dir}/.backup.lock"
flock -n 9 || fail "another backup process is already running"

[[ ! -e "${backup_file}" ]] || fail "backup file already exists: ${backup_file}"

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

readonly checksum="$(sha256sum -- "${partial_file}" | cut -d ' ' -f 1)"
[[ "${checksum}" =~ ^[[:xdigit:]]{64}$ ]] || fail "could not calculate a valid SHA-256 checksum"
printf '%s  %s\n' "${checksum}" "${backup_name}" > "${checksum_partial_file}"

mv -- "${partial_file}" "${backup_file}"
chmod 600 -- "${backup_file}"
mv -- "${checksum_partial_file}" "${checksum_file}"
chmod 600 -- "${checksum_file}"

(cd -- "${backup_dir}" && sha256sum --check -- "${backup_name}.sha256")

# Retention only runs after the new dump and checksum have both been verified.
prune_old_backups

trap - EXIT HUP INT TERM

printf 'Backup completed successfully.\n'
printf 'Dump: %s\n' "${backup_file}"
printf 'Checksum: %s\n' "${checksum_file}"
printf 'Retention: latest %s backups\n' "${retention_count}"
du -h -- "${backup_file}"
