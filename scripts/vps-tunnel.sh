#!/usr/bin/env bash
# Run ON THE VPS after deploy.
# Starts a Cloudflare quick tunnel → unique HTTPS URL (no domain buy).
# Camera / getUserMedia works because it is HTTPS.
#
#   bash scripts/vps-tunnel.sh

set -euo pipefail

PORT="${PORT:-3010}"
APP_NAME="asl-alphabet-tunnel"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "==> Installing cloudflared…"
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /tmp/cloudflared
  chmod +x /tmp/cloudflared
  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
fi

# Keep Next only on localhost; tunnel publishes HTTPS
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start cloudflared --name "$APP_NAME" -- tunnel --url "http://127.0.0.1:${PORT}"
pm2 save

echo ""
echo "==> Tunnel starting. Find your unique URL in logs:"
echo "    pm2 logs ${APP_NAME} --lines 30"
echo ""
echo "Look for: https://xxxx.trycloudflare.com"
echo "Share that link — HTTPS, unique, no domain needed."
echo ""
pm2 logs "$APP_NAME" --lines 40 --nostream || true
