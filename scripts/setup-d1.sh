#!/bin/bash
# Setup script for Cloudflare D1 database

set -e

echo "🚀 UPS Tracker - D1 Database Setup"
echo "=================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "   Install with: npm install -g wrangler"
    exit 1
fi

echo "✓ Wrangler CLI found"
echo ""

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare..."
    wrangler login
fi

echo "✓ Authenticated with Cloudflare"
echo ""

# Create development database
echo "📦 Creating development database..."
DEV_DB_OUTPUT=$(wrangler d1 create ups-tracker-db-dev 2>&1 || true)

if echo "$DEV_DB_OUTPUT" | grep -q "already exists"; then
    echo "   Development database already exists"
    DEV_DB_ID=$(wrangler d1 list | grep ups-tracker-db-dev | awk '{print $2}')
else
    echo "   Created development database"
    DEV_DB_ID=$(echo "$DEV_DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)"/\1/')
fi

echo "   Database ID: $DEV_DB_ID"
echo ""

# Create production database
echo "📦 Creating production database..."
PROD_DB_OUTPUT=$(wrangler d1 create ups-tracker-db 2>&1 || true)

if echo "$PROD_DB_OUTPUT" | grep -q "already exists"; then
    echo "   Production database already exists"
    PROD_DB_ID=$(wrangler d1 list | grep -E "^ups-tracker-db\s" | awk '{print $2}')
else
    echo "   Created production database"
    PROD_DB_ID=$(echo "$PROD_DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)"/\1/')
fi

echo "   Database ID: $PROD_DB_ID"
echo ""

# Update wrangler.toml with database IDs
echo "📝 Updating wrangler.toml with database IDs..."

# Backup original
cp wrangler.toml wrangler.toml.backup

# Update development database ID
sed -i.tmp "s/database_id = \"\" # Will be populated after creating dev database/database_id = \"$DEV_DB_ID\"/" wrangler.toml

# Update production database ID  
sed -i.tmp "s/database_id = \"\" # Will be populated after creating database/database_id = \"$PROD_DB_ID\"/" wrangler.toml

# Remove backup file
rm -f wrangler.toml.tmp

echo "   Updated wrangler.toml"
echo ""

# Run migrations on development database
echo "🔄 Running migrations on development database..."
wrangler d1 execute ups-tracker-db-dev --file=./migrations/0001_initial_schema.sql --local

echo "   Applied schema to local development database"
echo ""

# Run migrations on production database
echo "🔄 Running migrations on production database..."
wrangler d1 execute ups-tracker-db --file=./migrations/0001_initial_schema.sql --remote

echo "   Applied schema to remote production database"
echo ""

# Seed development database with default cars (optional)
echo "🌱 Seeding development database with default cars..."

SEED_SQL="INSERT OR IGNORE INTO cars (id, location, arrived, late, empty, last_updated_by) VALUES
('128489', 'Yard', 0, 0, 0, 'system'),
('128507', 'Yard', 0, 0, 0, 'system'),
('144129', 'Yard', 0, 0, 0, 'system'),
('156445', 'Yard', 0, 0, 0, 'system'),
('171011', 'Yard', 0, 0, 0, 'system');"

echo "$SEED_SQL" | wrangler d1 execute ups-tracker-db-dev --command="$SEED_SQL" --local

echo "   Seeded development database"
echo ""

echo "✅ Database setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Deploy the worker: npm run deploy:worker"
echo "   2. Set VITE_API_URL in your .env file:"
echo "      VITE_API_URL=https://ups-tracker-api.invictustitan2.workers.dev"
echo "   3. Test the API: curl https://ups-tracker-api.invictustitan2.workers.dev/api/health"
echo ""
echo "🔍 Useful commands:"
echo "   - List databases: wrangler d1 list"
echo "   - Query dev DB: wrangler d1 execute ups-tracker-db-dev --command='SELECT * FROM cars' --local"
echo "   - Query prod DB: wrangler d1 execute ups-tracker-db --command='SELECT * FROM cars' --remote"
echo ""
