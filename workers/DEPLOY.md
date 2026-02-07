# Deploy FEEDS Validators - Quick Guide

## Prerequisites

1. Cloudflare account
2. 5 wallet addresses for validators (with ~0.01 ETH each on Base)

## Step 1: Install Wrangler

```bash
npm install -g wrangler
```

## Step 2: Login to Cloudflare

```bash
wrangler login
```

## Step 3: Generate 5 Validator Wallets

Run this to generate 5 validator wallets:

```bash
node generate-validators.js
```

**Save the output!** You'll need:
- The 5 addresses (to register in Registry contract)
- The 5 private keys (to configure workers)

**IMPORTANT:** Send ~0.01 ETH on Base to each of the 5 addresses for gas.

## Step 4: Deploy Workers

Deploy all 5 validators:

```bash
wrangler deploy --env validator-1
wrangler deploy --env validator-2
wrangler deploy --env validator-3
wrangler deploy --env validator-4
wrangler deploy --env validator-5
```

## Step 5: Set Secrets for Each Worker

For each validator (1-5), set the private key:

```bash
# Validator 1
echo "PASTE_PRIVATE_KEY_1_HERE" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-1

# Validator 2
echo "PASTE_PRIVATE_KEY_2_HERE" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-2

# Validator 3
echo "PASTE_PRIVATE_KEY_3_HERE" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-3

# Validator 4
echo "PASTE_PRIVATE_KEY_4_HERE" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-4

# Validator 5
echo "PASTE_PRIVATE_KEY_5_HERE" | wrangler secret put VALIDATOR_PRIVATE_KEY --env validator-5
```

## Step 6: Update wrangler.toml

Edit `wrangler.toml` and replace `YOUR_REGISTRY_ADDRESS` with:
```
0x9262cDe71f1271Ea542545C7A379E112f904439b
```

## Step 7: Test Workers

```bash
curl https://feeds-validator-1.YOUR_SUBDOMAIN.workers.dev/health
```

Should return: `{"status":"healthy","timestamp":...}`

## Step 8: Register Validators in Registry Contract

Use Basescan to call `addValidator()` on the Registry contract 5 times:

**Registry:** `0x9262cDe71f1271Ea542545C7A379E112f904439b`

For each validator (index 0-4):
```solidity
addValidator(
    0, // index (0, 1, 2, 3, 4)
    "0x...", // validator wallet address
    "https://feeds-validator-1.YOUR_SUBDOMAIN.workers.dev" // worker URL
)
```

## Step 9: Set Validators in Factory Contract

Call `setValidators()` on the Factory contract:

**Factory:** `0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6`

```solidity
setValidators([
    "0x...", // validator 1 address
    "0x...", // validator 2 address
    "0x...", // validator 3 address
    "0x...", // validator 4 address
    "0x..."  // validator 5 address
])
```

## Done!

Your validators are now:
- ✅ Deployed on Cloudflare
- ✅ Running cron jobs every minute
- ✅ Registered in Registry contract
- ✅ Configured in Factory contract

Users can now deploy oracles via the UI!
