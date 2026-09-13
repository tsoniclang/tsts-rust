#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$root/.temp/guards"
exec 9>"$root/.temp/guards/serial.lock"
flock -n 9 || { printf 'Another Rust product job is running.\n' >&2; exit 75; }
available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if [[ -z "$available_kib" || "$available_kib" -lt 8388608 ]]; then
  printf 'At least 8 GiB available memory is required.\n' >&2
  exit 75
fi
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
record="$root/.temp/guards/$run_id"
printf '%q ' "$@" >"$record.command"
printf '\n' >>"$record.command"
set +e
systemd-run --user --scope --quiet --unit "tsts-rust-$run_id" \
  -p MemoryMax=6G -p MemorySwapMax=0 -p OOMPolicy=kill -p TasksMax=256 \
  /usr/bin/time --verbose --output "$record.time" \
  timeout --signal=TERM --kill-after=15s 5m \
  env NODE_OPTIONS=--max-old-space-size=4096 GOMEMLIMIT=2GiB GOMAXPROCS=2 \
  CARGO_BUILD_JOBS=2 "$@" 9>&-
status=$?
set -e
printf 'exit_status=%s\n' "$status" >"$record.finished"
exit "$status"
