#!/bin/bash
# VAPID Key Deployment Helper Script
# Deploys VAPID private key to Cloudflare Workers

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRIVATE_KEY_FILE="$HOME/.config/ups-tracker-secrets/vapid_private_key.txt"

echo "=== VAPID Key Deployment Helper ==="
echo ""

# Check if private key file exists
if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "❌ Error: Private key not found at $PRIVATE_KEY_FILE"
    echo ""
    echo "To generate and store a new key pair:"
    echo "  npx web-push generate-vapid-keys"
    echo "  echo 'YOUR_PRIVATE_KEY' > $PRIVATE_KEY_FILE"
    echo "  chmod 600 $PRIVATE_KEY_FILE"
    exit 1
fi

echo "✅ Private key found at: $PRIVATE_KEY_FILE"
echo ""

# Verify key file permissions
PERMISSIONS=$(stat -c "%a" "$PRIVATE_KEY_FILE" 2>/dev/null || stat -f "%Lp" "$PRIVATE_KEY_FILE" 2>/dev/null)
if [ "$PERMISSIONS" != "600" ]; then
    echo "⚠️  Warning: Private key has permissions $PERMISSIONS (should be 600)"
    echo "   Fixing permissions..."
    chmod 600 "$PRIVATE_KEY_FILE"
    echo "✅ Permissions corrected"
fi

# Display current public key from .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    PUBLIC_KEY=$(grep VITE_VAPID_PUBLIC_KEY "$PROJECT_ROOT/.env" | cut -d'=' -f2)
    echo "📋 Current public key in .env:"
    echo "   $PUBLIC_KEY"
    echo ""
fi

# Ask for confirmation
echo "This will set the VAPID_PRIVATE_KEY secret in Cloudflare Workers."
echo "The private key will be read from: $PRIVATE_KEY_FILE"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Change to workers directory
cd "$PROJECT_ROOT/workers" || {
    echo "❌ Error: workers/ directory not found"
    exit 1
}

echo ""
echo "🚀 Setting VAPID_PRIVATE_KEY secret..."
echo ""

# Set the secret
if cat "$PRIVATE_KEY_FILE" | npx wrangler secret put VAPID_PRIVATE_KEY; then
    echo ""
    echo "✅ VAPID_PRIVATE_KEY secret set successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Verify secret: npx wrangler secret list"
    echo "   2. Deploy worker: npx wrangler deploy"
    echo "   3. Test notifications in the app"
    echo ""
else
    echo ""
    echo "❌ Failed to set secret"
    exit 1
fi
