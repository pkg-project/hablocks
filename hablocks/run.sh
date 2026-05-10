#!/usr/bin/with-contenv bashio
# ==============================================================================
# HA Blocks Add-on: run.sh
# Starts the nginx web server for the Blockly automation builder
# ==============================================================================

declare ingress_entry
declare ha_url
declare supervisor_token

bashio::log.info "Starting HA Blocks..."

# Get the ingress entry path
ingress_entry=$(bashio::addon.ingress_entry)
bashio::log.info "Ingress entry: ${ingress_entry}"

# Get the HA URL (internal) and Supervisor token for auto-connection
ha_url="http://supervisor/core"
supervisor_token="${SUPERVISOR_TOKEN}"

# Inject ingress path and HA connection info into the HTML
bashio::log.info "Configuring application..."

# Replace placeholders in the HTML with actual values
sed -i "s|%%INGRESS_PATH%%|${ingress_entry}|g" /var/www/index.html
sed -i "s|%%HA_URL%%|/api/hassio/homeassistant|g" /var/www/index.html
sed -i "s|%%SUPERVISOR_TOKEN%%|${supervisor_token}|g" /var/www/index.html

# Update nginx config with ingress path
sed -i "s|%%INGRESS_PATH%%|${ingress_entry}|g" /etc/nginx/nginx.conf

bashio::log.info "Starting nginx..."

# Start nginx in foreground
exec nginx -g "daemon off;"
