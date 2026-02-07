# $FEEDS Token Launch Guide

## Overview

This guide covers deploying the $FEEDS ERC-20 token on Base network using Clanker, a token deployment platform on Farcaster.

---

## What is Clanker?

Clanker is an AI-powered token deployment agent that automates ERC-20 token launches on Base network through Farcaster social mentions.

**Key Features:**
- Instant ERC-20 deployment on Base
- Automatic Uniswap V3 liquidity pool creation
- Locked liquidity (prevents rug pulls)
- 40% fee distribution to creators
- No coding required

**Learn More:**
- [How to Create Tokens Using Clanker](https://percs.app/blog/token-creation-clanker/)
- [Clanker Documentation](https://pool.fans/docs)
- [Base Token Launch Guide](https://docs.base.org/get-started/launch-token)

---

## Launch Process

### Prerequisites

1. **Farcaster Account**
   - Create account at [warpcast.com](https://warpcast.com)
   - Connect your wallet (for receiving creator fees)

2. **Initial Liquidity**
   - Prepare ~0.5-1 ETH on Base for liquidity
   - WETH will be paired with $FEEDS in Uniswap V3 pool

### Step 1: Tag @clanker on Farcaster

Post a message mentioning @clanker with your token details:

```
@clanker deploy a token

Name: Feeds Token
Ticker: $FEEDS

Decentralized oracle network on Base. Get 25% off oracle subscriptions when paying with $FEEDS.

[Attach FEEDS logo/image if available]
```

### Step 2: Confirm Deployment

Clanker will respond with:
- Contract address on Base
- Uniswap V3 pool link
- Token details confirmation

### Step 3: Add Initial Liquidity

1. Visit the Uniswap V3 pool link provided by Clanker
2. Add liquidity (ETH + $FEEDS)
3. Recommended: Add ~$5,000-$10,000 initial liquidity
4. Set price range (full range recommended for launch)

### Step 4: Update Smart Contract

After deployment, update SubscriptionManager with the token address:

```bash
# Using Hardhat console
npx hardhat console --network base

# In console:
const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
const manager = await SubscriptionManager.attach("YOUR_SUBSCRIPTION_MANAGER_ADDRESS");
await manager.setFeedsToken("CLANKER_DEPLOYED_TOKEN_ADDRESS");
```

---

## Token Economics

### Initial Distribution

Recommended allocation for 100M total supply:

```
Total Supply: 100,000,000 $FEEDS

Distribution:
├── 40% (40M) → Liquidity Pool (Uniswap V3)
├── 20% (20M) → Treasury (protocol development)
├── 15% (15M) → Team (12-month vesting)
├── 15% (15M) → Community Rewards (airdrops, incentives)
└── 10% (10M) → Early Supporters (6-month vesting)
```

### Pricing Strategy

**Target Initial Price:** $0.01 per $FEEDS

**Example Starter Tier:**
- USDC/ETH price: $29
- $FEEDS price: $21.75 (25% discount)
- $FEEDS required: 2,175 tokens

**Value Proposition:**
- Users buy $FEEDS on Uniswap
- Use $FEEDS to save 25% on subscriptions
- Creates buy pressure for token
- Incentivizes ecosystem participation

---

## Marketing & Launch Plan

### Pre-Launch (Week 1-2)

- [ ] Build Farcaster following
- [ ] Announce token launch date
- [ ] Create $FEEDS landing page
- [ ] Prepare launch graphics/videos
- [ ] Set up token tracking on DEXTools/DexScreener

### Launch Day

- [ ] Tag @clanker to deploy token
- [ ] Add initial liquidity (Uniswap V3)
- [ ] Announce contract address
- [ ] Update SubscriptionManager contract
- [ ] Submit to CoinGecko/CoinMarketCap
- [ ] Post launch announcement

### Post-Launch (Week 1-4)

- [ ] Airdrop to early FEEDS users
- [ ] Run $FEEDS discount campaign
- [ ] Create Uniswap liquidity incentives
- [ ] Partner with Base ecosystem projects
- [ ] Weekly community updates

---

## Integration with FEEDS Platform

### Smart Contract Updates

**SubscriptionManager.sol:**
```solidity
// After Clanker deployment
function setFeedsToken(address _feedsToken) external onlyOwner {
    feedsToken = IERC20(_feedsToken);
}

// Users can now call:
function subscribeWithFEEDS(Tier tier) external nonReentrant {
    // 25% discount applied automatically
}
```

### Frontend Updates

**Pricing Page:**
- Show $FEEDS pricing alongside USDC/ETH
- Display "SAVE 25%" badge
- Link to Uniswap for buying $FEEDS

**Dashboard:**
- Add "Buy $FEEDS" button
- Show current $FEEDS balance
- Calculate savings with $FEEDS payment

**Checkout Flow:**
```
┌─────────────────────────┐
│  Select Payment Method  │
├─────────────────────────┤
│ ○ USDC ($29.00)        │
│ ○ ETH (~0.0097 ETH)    │
│ ● $FEEDS ($21.75) 💰   │  ← 25% discount
│   └─ SAVE $7.25        │
└─────────────────────────┘
```

---

## Liquidity Management

### Uniswap V3 Pool Setup

**Initial Pool:**
- Pair: WETH/$FEEDS
- Fee Tier: 0.3% (recommended for new tokens)
- Price Range: Full range initially
- Liquidity: $5,000-$10,000

**Ongoing Management:**
- Monitor pool depth
- Adjust price ranges as needed
- Add liquidity from protocol revenue
- Consider liquidity mining incentives

### Price Oracle Integration

Update `getFeedsPrice()` in SubscriptionManager:

```solidity
function getFeedsPrice(uint256 usdcAmount) public view returns (uint256) {
    // Integrate Uniswap V3 TWAP oracle
    // Get current $FEEDS/USD price from pool
    // Calculate required $FEEDS for usdcAmount
}
```

---

## Security Considerations

### Token Contract (Clanker Deployment)

**Pros:**
- ✅ Standard ERC-20 (widely audited)
- ✅ No admin functions (decentralized)
- ✅ Liquidity locked by default
- ✅ Simple, no complex mechanisms

**Limitations:**
- ❌ No staking built-in
- ❌ No burning mechanism
- ❌ No governance features
- ❌ Fixed supply (can't mint more)

### Risk Mitigation

1. **Liquidity Locking**
   - Lock initial liquidity for 6-12 months
   - Use services like Uncx.network or Team.finance

2. **Transparency**
   - Publish tokenomics publicly
   - Share team allocation addresses
   - Regular community updates

3. **Smart Contract Security**
   - Audit SubscriptionManager before mainnet
   - Test $FEEDS payment flow on testnet
   - Monitor for unusual transactions

---

## Monitoring & Analytics

### Track These Metrics

**Token Metrics:**
- Price ($FEEDS/USD)
- Market cap
- 24h volume
- Liquidity depth
- Holder count

**Usage Metrics:**
- Subscriptions paid with $FEEDS
- Total $FEEDS spent on subscriptions
- Discount value provided
- $FEEDS buy-to-use ratio

**Tools:**
- [DexScreener](https://dexscreener.com) - Price tracking
- [DexTools](https://www.dextools.io) - Advanced charts
- [BaseScan](https://basescan.org) - On-chain analytics
- Custom dashboard for $FEEDS subscriptions

---

## Example Launch Timeline

### Day 0: Deployment
- 9:00 AM: Tag @clanker on Farcaster
- 9:15 AM: Receive contract address
- 9:30 AM: Add initial liquidity
- 10:00 AM: Announce launch
- 11:00 AM: Submit to tracking sites

### Week 1: Bootstrap
- Update smart contracts
- Airdrop to early users (1,000 $FEEDS each)
- Launch 50% discount promotion
- Partner announcements

### Week 2-4: Growth
- Community campaigns
- Liquidity mining rewards
- Integration tutorials
- Influencer partnerships

### Month 2-3: Scale
- CoinGecko/CMC listings
- CEX discussions
- Additional utility features
- Governance proposals

---

## Alternative: Manual ERC-20 Deployment

If you prefer more control over tokenomics (staking, burning, etc.), deploy a custom ERC-20:

### Option 1: OpenZeppelin Wizard
- [OpenZeppelin Contracts Wizard](https://docs.openzeppelin.com/contracts/5.x/wizard)
- Select features: Mintable, Burnable, Pausable
- Deploy via Hardhat/Remix

### Option 2: Custom Contract
See `/contracts/contracts/FeedsToken.sol` (removed) for advanced features:
- Vesting schedules
- Staking rewards
- Governance voting
- Controlled minting

**Trade-off:**
- More control vs. Clanker's simplicity
- Custom features vs. quick launch
- Higher dev cost vs. zero-code deployment

---

## Resources

**Clanker Platform:**
- [Clanker on Farcaster](https://warpcast.com/clanker)
- [Pool.fans Documentation](https://pool.fans/docs)
- [Token Creation Guide](https://percs.app/blog/token-creation-clanker/)

**Base Network:**
- [Base Docs](https://docs.base.org)
- [Base Bridge](https://bridge.base.org)
- [BaseScan Explorer](https://basescan.org)

**DEX Integration:**
- [Uniswap V3 Docs](https://docs.uniswap.org/contracts/v3/overview)
- [Add Liquidity Guide](https://support.uniswap.org/hc/en-us/articles/7423194619661-How-to-provide-liquidity-on-Uniswap-V3)

**Token Tracking:**
- [DexScreener](https://dexscreener.com)
- [DexTools](https://www.dextools.io)
- [CoinGecko](https://www.coingecko.com/en/coins/recently_added)
- [CoinMarketCap](https://coinmarketcap.com/request/)

---

## Next Steps

1. **Create Farcaster account** and build following
2. **Prepare launch materials** (logo, description, graphics)
3. **Tag @clanker** with token details
4. **Add initial liquidity** on Uniswap V3
5. **Update SubscriptionManager** with token address
6. **Launch marketing campaign** across Base ecosystem
7. **Monitor and adjust** based on community feedback

**Questions?** Join the FEEDS community on Farcaster or Discord.
