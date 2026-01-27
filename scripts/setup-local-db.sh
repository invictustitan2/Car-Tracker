#!/bin/bash
set -e

echo "🛠️ Setting up local D1 database..."

# Apply migrations in order
echo "Applying 0001_initial_schema.sql..."
npx wrangler d1 execute ups-tracker-db --local --file=./migrations/0001_initial_schema.sql

echo "Applying 0002_push_subscriptions.sql..."
npx wrangler d1 execute ups-tracker-db --local --file=./migrations/0002_push_subscriptions.sql

echo "✅ Local database setup complete."
