#!/usr/bin/env bash

set -Eeuo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
readonly sql_file="${script_dir}/financial-plan/verify-contract-cleanup.sql"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly report_dir="${1:-${project_dir}/backups/financial-plan-audit}"
readonly report_file="${report_dir}/contract_verify_${timestamp}.json"
readonly partial_file="${report_file}.partial"

cleanup() { rm -f -- "${partial_file}"; }
compose() { docker compose --project-directory "${project_dir}" --file "${project_dir}/docker-compose.yml" "$@"; }

command -v docker >/dev/null 2>&1 || { printf 'docker is required\n' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { printf 'node is required\n' >&2; exit 1; }
umask 077
mkdir -p -- "${report_dir}"
trap cleanup EXIT HUP INT TERM

compose exec -T db sh -ec '
  export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000"
  exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-align --tuples-only --quiet --set=ON_ERROR_STOP=1
' < "${sql_file}" > "${partial_file}"

node -e '
  const fs = require("node:fs");
  const source = process.argv[1];
  const target = process.argv[2];
  const report = JSON.parse(fs.readFileSync(source, "utf8").trim());
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Contract cleanup verification: ${target}`);
  console.log(`Issues: ${report.contractIssueCount}; remaining categories: ${report.categoryCount}`);
  if (report.contractIssueCount !== 0) process.exitCode = 2;
' "${partial_file}" "${report_file}"

trap - EXIT HUP INT TERM
