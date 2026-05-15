#!/usr/bin/env bash
# venOM — one-command startup for macOS / Linux.
# First run: installs Python venv + frontend node_modules (one-time, ~1-2 min).
# Subsequent runs: just boots both services in ~3 seconds.
#
# Usage:   ./start.sh
# Stop:    Ctrl+C (kills both services cleanly)

set -e
cd "$(dirname "$0")"

# ---- pretty output ---------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
say()  { printf "${GREEN}✦${NC} %s\n" "$1"; }
step() { printf "${YELLOW}→${NC} %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }

# ---- prereq check ----------------------------------------------------------
say "venOM startup"

PY=""
if command -v python3 >/dev/null 2>&1; then PY="python3"
elif command -v python >/dev/null 2>&1; then PY="python"
else fail "Python 3 not found. Install from https://python.org (3.10+ required)."
fi

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install from https://nodejs.org (18+ required)."
command -v npm  >/dev/null 2>&1 || fail "npm not found (it should ship with Node.js)."

# ---- backend setup ---------------------------------------------------------
VENV_PY="backend/.venv/bin/python"

if [ ! -x "$VENV_PY" ]; then
    step "Creating Python venv (one-time)…"
    "$PY" -m venv backend/.venv
fi

# Always quick-install (fast no-op if requirements are already satisfied)
step "Ensuring backend dependencies…"
"$VENV_PY" -m pip install --upgrade pip --quiet
"$VENV_PY" -m pip install -q -r backend/requirements.txt

# ---- frontend setup --------------------------------------------------------
if [ ! -d "frontend/node_modules" ]; then
    step "Installing frontend dependencies (one-time, ~1 min)…"
    (cd frontend && npm install --silent --no-fund --no-audit)
fi

# ---- browser opener (best effort) -----------------------------------------
open_browser() {
    sleep 3
    URL="http://localhost:5173"
    if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
    elif command -v open     >/dev/null 2>&1; then open      "$URL" >/dev/null 2>&1 &
    fi
}

# ---- launch both services --------------------------------------------------
echo ""
say "Starting services. ${DIM}Ctrl+C stops both.${NC}"
printf "  Backend  → ${DIM}http://localhost:8000${NC}  (Swagger: /docs)\n"
printf "  Frontend → ${DIM}http://localhost:5173${NC}\n"
echo ""

# Trap cleanup: kill all jobs in this process group on any exit signal
trap 'echo ""; step "Stopping services…"; kill 0 2>/dev/null; exit 0' INT TERM EXIT

# Backend
(cd backend && exec ".venv/bin/uvicorn" main:app --reload --port 8000) &
# Frontend
(cd frontend && exec npm run dev) &
# Auto-open browser
open_browser &

wait
