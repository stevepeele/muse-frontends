#!/bin/sh
# Generates config.js from env vars at build time. Keys are never committed.
# Analytics loads only when the corresponding var is set.
set -e
cat > config.js <<EOF
/* generated at build time by scripts/write-config.sh */
window.MUSEFRONTENDS_CONFIG = Object.assign(window.MUSEFRONTENDS_CONFIG || {}, { posthogKey: "${POSTHOG_KEY:-}" });
EOF
