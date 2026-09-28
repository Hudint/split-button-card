#!/usr/bin/env bash
# Starts a local Home Assistant (demo entities) on http://127.0.0.1:18123
# with the built card mounted. Login: dev / devdevdev (after onboarding).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .ha-config
cp configuration.yaml ui-lovelace.yaml .ha-config/
if docker ps -a --format '{{.Names}}' | grep -qx sbc-ha; then
  docker start sbc-ha >/dev/null
else
  docker run -d --name sbc-ha -p 127.0.0.1:18123:8123 \
    -v "$PWD/.ha-config:/config" -v "$PWD/../dist:/config/www" \
    -e TZ=Europe/Berlin ghcr.io/home-assistant/home-assistant:stable >/dev/null
fi
echo "Home Assistant: http://127.0.0.1:18123/lovelace/masonry"
