#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$root/.temp/guards"
exec 9>"$root/.temp/guards/serial.lock"
flock -n 9 || { printf 'Another Rust product job is running.\n' >&2; exit 75; }
memory_mib="${TSTS_RUST_MEMORY_MIB:-6144}"
timeout_seconds="${TSTS_RUST_TIMEOUT_SECONDS:-300}"
if [[ ! "$memory_mib" =~ ^[1-9][0-9]{0,4}$ || ! "$timeout_seconds" =~ ^[1-9][0-9]{0,4}$ ]] ||
  (( memory_mib < 2048 || memory_mib > 16384 || timeout_seconds > 7200 )); then
  printf 'Select 2048–16384 MiB memory and 1–7200 seconds.\n' >&2
  exit 64
fi
available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if [[ -z "$available_kib" ]] || (( available_kib < (memory_mib + 2048) * 1024 )); then
  printf 'The selected memory ceiling plus 2 GiB must be available.\n' >&2
  exit 75
fi
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
record="$root/.temp/guards/$run_id"
printf '%q ' "$@" >"$record.command"
printf '\n' >>"$record.command"
set +e
systemd-run --user --scope --quiet --unit "tsts-rust-$run_id" \
  -p "MemoryMax=${memory_mib}M" -p MemorySwapMax=0 -p OOMPolicy=kill -p TasksMax=256 \
  /usr/bin/time --verbose --output "$record.time" \
  timeout --signal=TERM --kill-after=15s "$timeout_seconds" \
  env NODE_OPTIONS="--max-old-space-size=$((memory_mib * 2 / 3))" GOMEMLIMIT=2GiB GOMAXPROCS=2 \
  CARGO_BUILD_JOBS=2 "$@" 9>&-
status=$?
set -e
printf 'exit_status=%s\n' "$status" >"$record.finished"
exit "$status"
