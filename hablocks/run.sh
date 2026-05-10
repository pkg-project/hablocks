#!/bin/sh
# HA Blocks Add-on: run.sh
set -e

echo "[INFO] Starting HA Blocks..."

INGRESS_PATH="${INGRESS_ENTRY:-/}"
echo "[INFO] Ingress path: ${INGRESS_PATH}"

sed -i "s|%%INGRESS_PATH%%|${INGRESS_PATH}|g" /var/www/index.html
sed -i "s|%%HA_URL%%|/api/hassio/homeassistant|g" /var/www/index.html
sed -i "s|%%SUPERVISOR_TOKEN%%|${SUPERVISOR_TOKEN:-}|g" /var/www/index.html
sed -i "s|%%INGRESS_PATH%%|${INGRESS_PATH}|g" /etc/nginx/nginx.conf

echo "[INFO] Starting nginx..."
exec nginx -g "daemon off;"
