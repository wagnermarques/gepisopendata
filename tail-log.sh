#!/usr/bin/env bash
# Tail the latest application log for Gepis Dados Abertos
# Usage: ./tail-log.sh [<log-file-name>]

APP_NAME="Gepis Dados Abertos"
APP_DIR_NAMES=(
  "Gepis Dados Abertos"
  "com.gepis.dadosabertos"
  "com.gepisopendata.gepisopendata"
  "gepis-dados-abertos"
)

get_log_dirs() {
  if [ -n "$APPDATA" ]; then
    for name in "${APP_DIR_NAMES[@]}"; do
      echo "$APPDATA/$name"
    done
  fi
  if [ -n "$LOCALAPPDATA" ]; then
    for name in "${APP_DIR_NAMES[@]}"; do
      echo "$LOCALAPPDATA/$name"
    done
  fi
  if [ -n "$XDG_DATA_HOME" ]; then
    for name in "${APP_DIR_NAMES[@]}"; do
      echo "$XDG_DATA_HOME/$name"
    done
  else
    for name in "${APP_DIR_NAMES[@]}"; do
      echo "$HOME/.local/share/$name"
    done
  fi
}

log_dir=""
for base in $(get_log_dirs); do
  candidate="$base/logs"
  if [ -d "$candidate" ]; then
    log_dir="$candidate"
    break
  fi
done

if [ -z "$log_dir" ]; then
  echo "Log directory not found in any of the candidate paths." >&2
  exit 1
fi

echo "Resolved log directory: $log_dir"

if [ $# -gt 0 ]; then
  log_path="$log_dir/$1"
  if [ ! -f "$log_path" ]; then
    echo "Specified log file not found: $log_path" >&2
    exit 1
  fi
else
  log_path=$(find "$log_dir" -maxdepth 1 -type f \( -name '*.log' -o -name '*.log.*' \) -print0 | xargs -0 ls -1t 2>/dev/null | head -n 1)
  if [ -z "$log_path" ]; then
    echo "No log files found in: $log_dir" >&2
    exit 1
  fi
fi

echo "Tailing log: $log_path"
tail -n 50 -F "$log_path"
