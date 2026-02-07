#!/bin/bash

# Run Supabase migration to add is_hidden column to oracles table
# Usage: ./run-migration.sh

MIGRATION_FILE="$(dirname "$0")/migration-add-hidden.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📝 Running migration: migration-add-hidden.sql"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "⚠️  Supabase CLI not found. Installing via npm..."
  npm install -g supabase
fi

# Check if we're in a Supabase project
if [ ! -f "$(dirname "$0")/../../supabase/config.toml" ]; then
  echo "⚠️  Not a Supabase project. You'll need to run the migration manually."
  echo ""
  echo "Option 1: Run via Supabase Dashboard"
  echo "  1. Go to https://supabase.com/dashboard"
  echo "  2. Select your project"
  echo "  3. Go to SQL Editor"
  echo "  4. Paste the contents of: $MIGRATION_FILE"
  echo "  5. Click 'Run'"
  echo ""
  echo "Option 2: Run via psql"
  echo "  psql \$DATABASE_URL -f $MIGRATION_FILE"
  echo ""
  exit 0
fi

# Run migration via Supabase CLI
supabase db push

echo ""
echo "✅ Migration completed!"
