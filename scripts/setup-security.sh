#!/bin/bash
# Setup script for security configuration

set -e

echo "🔐 UPS Tracker Security Setup"
echo "=============================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in to Cloudflare. Running wrangler login..."
    wrangler login
fi

echo "✅ Wrangler CLI configured"
echo ""

# Create KV namespace for rate limiting (from workers directory)
echo "📦 Creating KV namespace for rate limiting..."
cd workers
KV_ID=$(wrangler kv:namespace create RATE_LIMIT_KV --preview false 2>&1 | grep -oP 'id = "\K[^"]+' || echo "")
cd ..

if [ -n "$KV_ID" ]; then
    echo "✅ KV namespace created: $KV_ID"
    echo ""
    echo "⚠️  Update workers/wrangler.toml:"
    echo "   Replace 'create-this-namespace' with: $KV_ID"
    echo ""
else
    echo "⚠️  KV namespace may already exist. Check with: wrangler kv:namespace list"
    echo ""
fi

# Generate API secret key
echo "🔑 Generating API secret key..."
API_KEY=$(openssl rand -base64 32)
echo "✅ API Secret Key generated"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Update API_SECRET_KEY in .env
    sed -i "s|API_SECRET_KEY=your-secret-key-here|API_SECRET_KEY=$API_KEY|" .env
    
    echo "✅ .env file created"
    echo ""
else
    echo "⚠️  .env file already exists. Skipping..."
    echo ""
fi

# Set secrets in Cloudflare (from workers directory)
echo "🌩️  Setting Cloudflare Worker secrets..."
echo ""
echo "Setting API_SECRET_KEY..."
cd workers
echo "$API_KEY" | wrangler secret put API_SECRET_KEY
cd ..

echo ""
echo "✅ Security setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update workers/wrangler.toml with KV namespace ID"
echo "   2. Update ALLOWED_ORIGINS in .env and wrangler.toml with your domain"
echo "   3. Deploy worker: cd workers && wrangler deploy"
echo "   4. Test API with X-API-Key header"
echo ""
echo "📖 Documentation: See DEPLOYMENT.md for detailed instructions"
