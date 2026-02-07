#!/bin/bash

# Deploy all 5 validators to Cloudflare Workers

echo "🚀 Deploying FEEDS validators to Cloudflare Workers..."
echo ""

# Deploy each validator
for i in {1..5}; do
  echo "Deploying validator-$i..."
  wrangler deploy --env validator-$i
  echo ""
done

echo "✅ All validators deployed!"
echo ""
echo "Verify deployment:"
echo "  Validator 1: https://feeds-validator-1.see21289.workers.dev/health"
echo "  Validator 2: https://feeds-validator-2.see21289.workers.dev/health"
echo "  Validator 3: https://feeds-validator-3.see21289.workers.dev/health"
echo "  Validator 4: https://feeds-validator-4.see21289.workers.dev/health"
echo "  Validator 5: https://feeds-validator-5.see21289.workers.dev/health"
echo ""
echo "Or check via API:"
echo "  curl http://localhost:3000/api/v1/validators"
