#!/bin/bash

# Update all 5 validators with Neynar API key
# Run this after deploying the updated validator code

NEYNAR_API_KEY="C2522BC8-1CCA-4AF8-B8DC-00F6B7046C4C"

echo "Updating validators with Neynar API key..."
echo ""

# Set Neynar API key for all validators
for i in {1..5}; do
  echo "Setting Neynar API key for validator-$i..."
  echo "$NEYNAR_API_KEY" | wrangler secret put NEYNAR_API_KEY --env validator-$i
done

echo ""
echo "✅ All validators updated with Neynar API key!"
echo ""
echo "Next steps:"
echo "1. Deploy updated validators: ./deploy-validators.sh"
echo "2. Verify validators are healthy: curl https://feeds-validator-1.see21289.workers.dev/health"
