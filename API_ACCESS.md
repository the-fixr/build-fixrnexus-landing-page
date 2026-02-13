# FIXR API Access Guide

> Access FIXR's API through staking or pay-per-call

## Overview

FIXR provides tiered API access based on FIXR token staking. Non-stakers can use x402 micropayments for pay-per-call access on **Base** or **Solana**.

## Access Tiers

| Tier | Staked FIXR | Rate Limit | Benefits |
|------|-------------|------------|----------|
| FREE | 0 | 10/min | Basic access |
| BUILDER | 1M+ | 20/min | 2x limits, basic analytics |
| PRO | 10M+ | 50/min | 5x limits, premium dashboard |
| ELITE | 50M+ | Unlimited | All features, priority support |

## Authentication Methods

### 1. Wallet Header (Simple)

Add your wallet address to requests:

```bash
curl -H "X-Wallet-Address: 0xYourWalletAddress" \
  https://fixr-agent.see21289.workers.dev/api/token/analyze
```

Your tier is determined by on-chain staked balance in the FixrStaking contract.

### 2. Signed Authentication (Secure)

For higher security, sign a challenge:

```bash
# 1. Get challenge
curl "https://fixr-agent.see21289.workers.dev/api/access/tier?wallet=0xYourWallet"

# Response includes authChallenge

# 2. Sign the challenge with your wallet

# 3. Send signed request
curl -H "Authorization: Bearer 0xWallet:0xSignature" \
     -H "X-Signed-Message: <the signed message>" \
     https://fixr-agent.see21289.workers.dev/api/token/analyze
```

### 3. x402 Pay-Per-Call

Pay $0.01 USDC per API call on **Base** or **Solana**. No staking required.

## x402 Payment Flow

```
┌─────────┐         ┌──────────┐       ┌──────────────────┐
│ Client  │         │  Server  │       │  Base or Solana  │
└────┬────┘         └────┬─────┘       └────────┬─────────┘
     │                   │                      │
     │ 1. Request API    │                      │
     │──────────────────>│                      │
     │                   │                      │
     │ 2. 402 Payment    │                      │
     │<──────────────────│                      │
     │    Required       │                      │
     │                   │                      │
     │ 3. Send $0.01 USDC to treasury          │
     │─────────────────────────────────────────>│
     │                   │                      │
     │ 4. Retry with     │                      │
     │    X-Payment-TxHash + X-Payment-Chain    │
     │──────────────────>│                      │
     │                   │ 5. Verify tx         │
     │                   │─────────────────────>│
     │                   │                      │
     │ 6. Response       │                      │
     │<──────────────────│                      │
     │                   │                      │
```

### Step-by-Step (Base)

**1. Make a request (will receive 402 if rate limited)**

```bash
curl -i https://agent.fixr.nexus/api/v1/token/analyze \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

**2. If rate limited, receive 402 with payment details:**

```json
{
  "error": "Invalid payment",
  "x402": {
    "pricePerCall": "$0.01 USDC",
    "amount": 10000,
    "chains": {
      "base": {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "recipient": "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
        "chainId": 8453
      },
      "solana": {
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "recipient": "96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU",
        "network": "mainnet-beta"
      }
    }
  }
}
```

**3. Send USDC payment on Base:**

```javascript
// Using ethers.js
const usdc = new ethers.Contract(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ["function transfer(address to, uint256 amount) returns (bool)"],
  signer
);

const tx = await usdc.transfer(
  "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4",
  10000n // $0.01 (6 decimals)
);
await tx.wait();
```

**4. Retry request with transaction hash:**

```bash
curl https://agent.fixr.nexus/api/v1/token/analyze \
  -H "Content-Type: application/json" \
  -H "X-Payment-TxHash: 0xYourTransactionHash" \
  -d '{"address": "0x..."}'
```

### Step-by-Step (Solana)

**1. Send 0.01 USDC on Solana to the treasury:**

```javascript
// Using @solana/web3.js + @solana/spl-token
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const TREASURY = new PublicKey('96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU');

const fromAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
const toAta = await getAssociatedTokenAddress(USDC_MINT, TREASURY);

const tx = new Transaction().add(
  createTransferInstruction(fromAta, toAta, wallet.publicKey, 10000) // 0.01 USDC
);
const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
```

**2. Use the signature to authenticate your API call:**

```bash
curl https://agent.fixr.nexus/api/v1/token/analyze \
  -H "Content-Type: application/json" \
  -H "X-Payment-Chain: solana" \
  -H "X-Payment-TxHash: YourSolanaTransactionSignature" \
  -d '{"address": "0x..."}'
```

**Important:** Each transaction hash/signature can only be used once. This prevents replay attacks.

## API Endpoints

### Check Your Tier

```bash
GET /api/access/tier?wallet=0x...
```

Response:
```json
{
  "success": true,
  "wallet": "0x...",
  "tier": "BUILDER",
  "stakedAmount": "1500000000000000000000000",
  "stakedFormatted": "1.5M",
  "rateLimit": "20/min",
  "benefits": ["2x rate limits", "Basic analytics"],
  "nextTier": { "tier": "PRO", "required": "10M FIXR" }
}
```

### Get Payment Info

```bash
GET /api/access/payment
```

Response:
```json
{
  "success": true,
  "x402": {
    "version": 2,
    "pricePerCall": "$0.01 USDC",
    "priceInUnits": 10000,
    "chains": {
      "base": {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6,
        "chainId": 8453,
        "recipient": "0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4"
      },
      "solana": {
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "symbol": "USDC",
        "decimals": 6,
        "network": "mainnet-beta",
        "recipient": "96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU"
      }
    },
    "headers": {
      "payment": "X-Payment-TxHash",
      "chain": "X-Payment-Chain (base | solana, default: base)",
      "wallet": "X-Wallet-Address"
    }
  }
}
```

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Payment-TxHash` | For x402 | Transaction hash (Base) or signature (Solana) |
| `X-Payment-Chain` | For Solana x402 | `base` (default) or `solana` |
| `X-Wallet-Address` | For tier access | Your EVM wallet address for staking tier lookup |

## Response Headers

All API responses include:

| Header | Description |
|--------|-------------|
| `X-Access-Tier` | Your current tier (FREE/BUILDER/PRO/ELITE) |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-Wallet-Verified` | Whether wallet address was verified |
| `X-Payment-Verified` | Whether x402 payment was verified |

## SDK Example (Base — JavaScript)

```javascript
class FixrClient {
  constructor(walletAddress, signer) {
    this.wallet = walletAddress;
    this.signer = signer;
    this.baseUrl = 'https://agent.fixr.nexus';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Wallet-Address': this.wallet,
      ...options.headers
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    // Handle x402 payment required
    if (response.status === 402) {
      const txHash = await this.payBase();

      // Retry with payment proof
      return fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, 'X-Payment-TxHash': txHash }
      });
    }

    return response;
  }

  async payBase() {
    const usdc = new ethers.Contract(
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ['function transfer(address,uint256) returns (bool)'],
      this.signer
    );
    const tx = await usdc.transfer(
      '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
      10000n
    );
    await tx.wait();
    return tx.hash;
  }

  async analyzeToken(address) {
    const res = await this.request('/api/v1/token/analyze', {
      method: 'POST',
      body: JSON.stringify({ address })
    });
    return res.json();
  }
}
```

## SDK Example (Solana — JavaScript)

```javascript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const TREASURY = new PublicKey('96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU');

async function payAndCall(connection, wallet, endpoint, body) {
  // 1. Send 0.01 USDC
  const fromAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
  const toAta = await getAssociatedTokenAddress(USDC_MINT, TREASURY);

  const tx = new Transaction().add(
    createTransferInstruction(fromAta, toAta, wallet.publicKey, 10000)
  );
  const sig = await connection.sendTransaction(tx, [wallet]);
  await connection.confirmTransaction(sig, 'confirmed');

  // 2. Call API with signature
  const res = await fetch(`https://agent.fixr.nexus${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Chain': 'solana',
      'X-Payment-TxHash': sig,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

## Staking for Access

To get tier benefits, stake FIXR tokens:

**Staking Contract:** `0x39DbBa2CdAF7F668816957B023cbee1841373F5b`

```javascript
import { ethers } from 'ethers';

const stakingAbi = [
  'function stake(uint256 amount, uint8 tier) external',
  'function unstake(uint256 positionId) external',
  'function claimRewards() external',
  'function getUserStake(address) view returns (uint256)'
];

const staking = new ethers.Contract(
  '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
  stakingAbi,
  signer
);

// Approve FIXR tokens first
await fixrToken.approve(staking.address, amount);

// Stake with lock tier (0-3)
// 0: 7 days (1x), 1: 30 days (1.25x), 2: 90 days (1.5x), 3: 180 days (2x)
await staking.stake(amount, 1); // 30-day lock
```

## Cost Comparison

| Method | Cost per 1000 calls |
|--------|---------------------|
| x402 Pay-per-call (Base USDC) | $10.00 |
| x402 Pay-per-call (Solana USDC) | $10.00 |
| BUILDER tier (1M FIXR staked) | Free (within limits) |
| PRO tier (10M FIXR staked) | Free (within limits) |
| ELITE tier (50M FIXR staked) | Free (unlimited) |

## Troubleshooting

### "Transaction already used"
Each tx hash/signature works once. Send a new USDC payment for each API call.

### "No USDC payment to treasury found" (Base)
Ensure you sent USDC (not ETH) to the correct treasury address on Base mainnet.

### "Transaction not found" (Solana)
Ensure you're using the correct transaction signature and that the transaction has been confirmed.

### "Insufficient payment"
Send at least $0.01 USDC (10000 raw units with 6 decimals) on either chain.

### "Rate limit exceeded" (even with staking)
Your tier rate limit is per-minute. Wait for the reset or use x402 to bypass.

### Solana payment not recognized
Make sure you include `X-Payment-Chain: solana` header. Without it, the server assumes Base and will fail to verify.

## Contract Addresses

### Base (EVM)

| Contract | Address |
|----------|---------|
| FixrStaking | `0x39DbBa2CdAF7F668816957B023cbee1841373F5b` |
| FixrFeeSplitter | `0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928` |
| Treasury | `0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |
| FIXR Token | TBD (Clanker launch) |

### Solana

| Account | Address |
|---------|---------|
| Treasury | `96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU` |
| USDC Mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

---

Questions? Reach out via [XMTP](xmtp://fixr.base.eth) or [@fixr on Farcaster](https://farcaster.xyz/fixr).
