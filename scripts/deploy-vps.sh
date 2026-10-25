#!/usr/bin/env bash
# Deploy ASL Alphabet to VPS (alongside existing PM2 apps).
# Usage (from your Mac, project root):
#   chmod +x scripts/deploy-vps.sh
#   ./scripts/deploy-vps.sh

set -euo pipefail

VPS_HOST="${VPS_HOST:-deploy@94.156.189.5}"
REMOTE_DIR="${REMOTE_DIR:-/home/deploy/asl-alphabet}"
APP_NAME="asl-alphabet"
PORT="3010"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1) Upload project to ${VPS_HOST}:${REMOTE_DIR}"
ssh "$VPS_HOST" "mkdir -p '${REMOTE_DIR}'"

# Prefer rsync if remote has it; otherwise tar-over-ssh (no rsync needed)
if ssh "$VPS_HOST" "command -v rsync >/dev/null 2>&1"; then
  echo "    using rsync…"
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude backend/.venv \
    --exclude gateway/node_modules \
    --exclude '.cursor' \
    --exclude '*.log' \
    "$ROOT/" "${VPS_HOST}:${REMOTE_DIR}/"
else
  echo "    remote has no rsync — using tar over ssh…"
  tar -C "$ROOT" \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude backend/.venv \
    --exclude gateway/node_modules \
    --exclude '.cursor' \
    --exclude '*.log' \
    -czf - . \
  | ssh "$VPS_HOST" "mkdir -p '${REMOTE_DIR}' && tar -xzf - -C '${REMOTE_DIR}'"
fi

echo "==> 2) Install, build, PM2 restart on VPS"
ssh -t "$VPS_HOST" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"

# Node 20+ if missing
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm i -g pm2
fi

npm ci || npm install
npm run build

# Point PM2 cwd at this deploy
sed -i "s|cwd: \".*\"|cwd: \"${REMOTE_DIR}\"|" ecosystem.config.cjs || true

pm2 delete ${APP_NAME} >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "App bound on 127.0.0.1:${PORT}"
pm2 ls
EOF

echo ""
echo "==> Done."
echo "Next (HTTPS URL for camera):"
echo "  ssh ${VPS_HOST}"
echo "  cd ${REMOTE_DIR} && bash scripts/vps-tunnel.sh"
echo "  pm2 logs asl-alphabet-tunnel --lines 40"
