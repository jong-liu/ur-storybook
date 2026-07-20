#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES_BASE_URL="${PAGES_BASE_URL:-https://jong-liu.github.io/ur-storybook}"
PORT="${PORT:-3000}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
RUNTIME_DIR="$(mktemp -d /tmp/ur-storybook.XXXXXX)"
SERVER_LOG="$RUNTIME_DIR/server.log"
TUNNEL_LOG="$RUNTIME_DIR/tunnel.log"
SERVER_PID=""
TUNNEL_PID=""

cleanup() {
  local exit_code=$?

  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi

  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}
trap cleanup INT TERM EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少必要指令：$1" >&2
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local attempts="$2"
  local delay="$3"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if [[ -n "$SERVER_PID" ]] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "後端啟動失敗，請檢查：$SERVER_LOG" >&2
      cat "$SERVER_LOG" >&2 || true
      exit 1
    fi

    sleep "$delay"
  done

  echo "等待後端逾時：$url" >&2
  echo "請檢查：$SERVER_LOG" >&2
  exit 1
}

wait_for_tunnel_url() {
  local attempts="$1"
  local delay="$2"
  local tunnel_url=""
  local i

  for ((i = 1; i <= attempts; i++)); do
    if [[ -n "$TUNNEL_PID" ]] && ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "Tunnel 啟動失敗，請檢查：$TUNNEL_LOG" >&2
      cat "$TUNNEL_LOG" >&2 || true
      exit 1
    fi

    tunnel_url="$(grep 'tunneled with tls termination' "$TUNNEL_LOG" 2>/dev/null | sed -E 's/.*(https:\/\/[^[:space:]]+).*/\1/' | tail -n 1)"
    if [[ "$tunnel_url" == https://* ]]; then
      printf '%s\n' "$tunnel_url"
      return 0
    fi

    sleep "$delay"
  done

  echo "等待 tunnel 網址逾時，請檢查：$TUNNEL_LOG" >&2
  exit 1
}

require_command curl
require_command ssh
require_command node

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "找不到 nvm：$NVM_DIR/nvm.sh" >&2
  exit 1
fi

cd "$ROOT_DIR"
. "$NVM_DIR/nvm.sh"
nvm use >/dev/null

node server/server.mjs >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"

wait_for_http "http://127.0.0.1:$PORT/api/health" 30 1
HEALTH_JSON="$(curl -fsS "http://127.0.0.1:$PORT/api/health")"

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:$PORT nokey@localhost.run >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID="$!"

TUNNEL_URL="$(wait_for_tunnel_url 30 1)"
STORY_URL="$PAGES_BASE_URL/?api=$TUNNEL_URL"
CHARACTER_URL="$PAGES_BASE_URL/character.html?api=$TUNNEL_URL"

printf '\n學生連結：\n'
printf '故事書頁：%s\n' "$STORY_URL"
printf '角色頁：%s\n' "$CHARACTER_URL"

if printf '%s' "$HEALTH_JSON" | grep -q '"needsPassword":true'; then
  printf '首次進入時，瀏覽器會要求輸入密碼。\n'
fi

printf '\n執行中：\n'
printf '後端 PID：%s\n' "$SERVER_PID"
printf 'Tunnel PID：%s\n' "$TUNNEL_PID"
printf '後端 log：%s\n' "$SERVER_LOG"
printf 'Tunnel log：%s\n' "$TUNNEL_LOG"
printf '\n按 Ctrl+C 可同時停止後端與 tunnel。\n\n'

wait "$TUNNEL_PID"
