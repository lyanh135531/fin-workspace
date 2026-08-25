#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
readonly sql_file="${script_dir}/financial-plan/preflight.sql"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly report_dir="${1:-${project_dir}/backups/financial-plan-audit}"
readonly report_file="${report_dir}/preflight_${timestamp}.json"
readonly partial_file="${report_file}.partial"

compose() {
  docker compose \
    --project-directory "${project_dir}" \
    --file "${project_dir}/docker-compose.yml" \
    "$@"
}

cleanup() {
  rm -f -- "${partial_file}"
}

command -v docker >/dev/null 2>&1 || { printf 'docker is required\n' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { printf 'node is required\n' >&2; exit 1; }
[[ -f "${sql_file}" ]] || { printf 'SQL file not found: %s\n' "${sql_file}" >&2; exit 1; }

umask 077
mkdir -p -- "${report_dir}"
trap cleanup EXIT HUP INT TERM

compose exec -T db sh -ec '
  : "${POSTGRES_USER:?POSTGRES_USER is not configured}"
  : "${POSTGRES_DB:?POSTGRES_DB is not configured}"
  export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000"
  exec psql \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-align \
    --tuples-only \
    --quiet \
    --set=ON_ERROR_STOP=1
' < "${sql_file}" > "${partial_file}"

node -e '
  const fs = require("node:fs");
  const file = process.argv[1];
  const report = JSON.parse(fs.readFileSync(file, "utf8").trim());
  if (!Number.isInteger(report.blockingIssueCount)) {
    throw new Error("blockingIssueCount is missing or invalid");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.blockingIssueCount > 0) process.exitCode = 2;
' "${partial_file}" > "${report_file}"

chmod 600 -- "${report_file}"
trap - EXIT HUP INT TERM

printf 'Financial-plan preflight report: %s\n' "${report_file}"
node -e '
  const report = require(process.argv[1]);
  console.log(`Blocking issues: ${report.blockingIssueCount}`);
  console.log(`Recurring expenses requiring category migration: ${report.migrationRequired.recurringExpenseWithoutCategory}`);
' "${report_file}"
