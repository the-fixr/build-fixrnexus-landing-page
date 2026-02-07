# FEEDS Tokenomics & Pricing Strategy

## Executive Summary

FEEDS implements a tri-token payment model accepting USDC, ETH, and $FEEDS token, with a subscription + pay-per-use structure designed for developers building on Base. This document outlines the complete pricing, tokenomics, and usage analytics system.

---

## 1. Payment Infrastructure

### Supported Payment Methods

**Tri-Token Payment Options:**
- **USDC** (preferred for subscriptions - price stability)
- **ETH** (native Base token - widely held)
- **$FEEDS** (protocol token - 25% discount incentive)

**Why Tri-Token Model:**
- USDC provides price stability for predictable monthly budgeting
- ETH offers flexibility and native Base ecosystem alignment
- $FEEDS token incentivizes ecosystem participation with 25% discount
- Real-time conversion rates ensure fair pricing regardless of payment method

### Smart Contract Architecture

```solidity
// SubscriptionManager.sol
contract SubscriptionManager {
    IERC20 public immutable usdc;
    IERC20 public feedsToken;
    address public treasury;

    uint256 public constant FEEDS_DISCOUNT = 25; // 25% discount

    struct Subscription {
        Tier tier;           // FREE, STARTER, PRO, ENTERPRISE
        uint256 expiresAt;   // Timestamp
        uint256 monthlyLimit; // API calls per month
        uint256 usedThisMonth;
    }

    mapping(address => Subscription) public subscriptions;
    mapping(address => uint256) public credits; // Prepaid credits in USD

    function subscribeWithUSDC(Tier tier) external;
    function subscribeWithETH(Tier tier) external payable;
    function subscribeWithFEEDS(Tier tier) external; // 25% discount
}
```

### $FEEDS Token

**Token Details:**
- Name: Feeds Token
- Symbol: $FEEDS
- Network: Base (via Clanker deployment)
- Standard: ERC-20
- Utility: 25% discount on all subscription tiers

**Launch Strategy:**
- Deploy via Clanker on Farcaster
- Initial liquidity on Uniswap V3
- Simple ERC-20 (no complex mechanics)
- Discount incentive drives adoption

---

## 2. Pricing Tiers

### Subscription Plans (Monthly)

| Tier | USDC/ETH Price | $FEEDS Price (25% off) | API Calls | Update Frequency | Support | Best For |
|------|----------------|------------------------|-----------|------------------|---------|----------|
| **Free** | $0 | $0 | 10,000 | 5 min | Community | Testing, POCs |
| **Starter** | $29 | $21.75 | 100,000 | 1 min | Email | Small dApps |
| **Pro** | $99 | $74.25 | 1,000,000 | 30 sec | Priority | Production apps |
| **Enterprise** | Custom | Custom | Unlimited | Custom | Dedicated | Large scale |

**Payment Options:**
- Pay with USDC for price stability
- Pay with ETH for convenience
- Pay with $FEEDS to save 25% on all tiers

### Pay-Per-Use Pricing (On Top of Subscription)

**Overage Charges:**
- $0.0005 per additional API call (after monthly limit)
- Billed automatically from credits or charged monthly
- Volume discounts apply at scale

**Credit Packages:**
- $50 = 120,000 calls ($0.00042 per call - 16% discount)
- $200 = 500,000 calls ($0.0004 per call - 20% discount)
- $1000 = 3,000,000 calls ($0.00033 per call - 34% discount)

**Custom Oracle Deployment:**
- One-time fee: $500 USDC
- Includes: Custom data source integration, 5 validators, 24/7 monitoring
- Monthly maintenance: Included in Pro tier

---

## 3. Revenue Distribution

### Fee Allocation

```
Total Revenue Distribution:
├── 40% → Validator Rewards (distributed based on uptime/performance)
├── 25% → Protocol Treasury (development, infrastructure)
├── 20% → Operational Costs (RPC, Cloudflare, hosting)
├── 10% → Liquidity Reserve (market making, stability)
└── 5%  → Community Incentives (bug bounties, governance)
```

### Validator Economics

**Performance-Based Rewards:**
- Base reward: 40% of revenue ÷ 5 validators = 8% each
- Performance multiplier: 0.8x to 1.2x based on:
  - Uptime (99.9%+ required for 1.0x)
  - Response time (<200ms = 1.1x, <100ms = 1.2x)
  - Data accuracy (measured against consensus)

**Monthly Validator Earnings Example:**
```
Monthly Revenue: $10,000
Validator Pool: $4,000
Per Validator (base): $800

With 99.99% uptime + <100ms response:
Actual payout: $800 × 1.2 = $960/month
```

---

## 4. Usage Analytics & Visualization

### Dashboard Metrics

**Real-Time Metrics:**
1. **API Calls**
   - Current month usage vs limit
   - Hourly/daily breakdown
   - Peak usage times
   - Projected month-end usage

2. **Cost Tracking**
   - Subscription cost
   - Overage costs (real-time)
   - Projected monthly bill
   - Cost per call average

3. **Performance Metrics**
   - Average response time
   - Success rate (%)
   - Validator consensus time
   - Data freshness

4. **Oracle Health**
   - Active oracles count
   - Total updates this month
   - Failed updates
   - Consensus failures

### Visualization Components

**1. Usage Graph (Recharts)**
```typescript
// Monthly usage trend with limit indicator
<LineChart>
  <Line dataKey="calls" stroke="#ff006e" />
  <Line dataKey="limit" stroke="#666" strokeDasharray="5 5" />
  <Area dataKey="overage" fill="#ff006e" opacity={0.3} />
</LineChart>
```

**2. Cost Breakdown (Pie Chart)**
```typescript
// Subscription vs overage vs credits used
<PieChart>
  <Pie data={[
    { name: 'Subscription', value: 99, fill: '#ff006e' },
    { name: 'Overage', value: 45, fill: '#ff4d8f' },
    { name: 'Credits', value: -20, fill: '#00ff88' }
  ]} />
</PieChart>
```

**3. Real-Time Activity Feed**
```typescript
// Live oracle updates with timestamps
[12:34:56] ETH/USD → $3,245.67 (5 validators, 234ms)
[12:34:51] BTC/USD → $64,234.12 (5 validators, 189ms)
[12:34:46] USDC/USD → $1.0001 (5 validators, 156ms)
```

**4. Cost Forecasting**
```typescript
// Predict end-of-month costs based on current usage
Current pace: 45,000 calls/day
Projected monthly: 1,350,000 calls
Your limit: 1,000,000 calls
Projected overage: 350,000 × $0.0005 = $175
Total projected bill: $99 (sub) + $175 (overage) = $274
```

---

## 5. Billing & Payment Flow

### Subscription Flow

1. **User selects tier** → Connects wallet
2. **Payment modal** → Choose USDC or ETH
3. **Smart contract** → `subscribe(tier, paymentToken)`
4. **Confirmation** → Subscription active immediately
5. **Auto-renewal** → 7 days before expiry, email notification

### Pay-Per-Use Flow

**Option A: Prepaid Credits**
1. User buys credit package ($50, $200, $1000)
2. Credits stored in smart contract
3. API calls deduct from credits in real-time
4. Low balance alerts at 20% remaining

**Option B: Monthly Billing**
1. Overage tracked in real-time
2. Bill generated at month end
3. 7-day grace period to pay
4. Auto-charge if card on file / wallet approved

---

## 6. Smart Contract Implementation

### Key Contracts

**1. SubscriptionManager.sol**
```solidity
contract SubscriptionManager {
    struct Plan {
        uint256 priceUSDC;
        uint256 callLimit;
        uint256 updateFrequency;
    }

    Plan[4] public plans = [
        Plan(0, 10000, 300),      // Free
        Plan(29e6, 100000, 60),   // Starter
        Plan(99e6, 1000000, 30),  // Pro
        Plan(0, type(uint256).max, 1) // Enterprise
    ];

    function subscribe(uint8 tier, address paymentToken) external {
        require(tier < 4, "Invalid tier");
        Plan memory plan = plans[tier];

        if (tier > 0) {
            if (paymentToken == address(usdc)) {
                IERC20(usdc).transferFrom(msg.sender, treasury, plan.priceUSDC);
            } else {
                // Convert ETH amount using oracle price
                uint256 ethAmount = getETHAmount(plan.priceUSDC);
                require(msg.value >= ethAmount, "Insufficient ETH");
            }
        }

        subscriptions[msg.sender] = Subscription({
            tier: tier,
            expiresAt: block.timestamp + 30 days,
            monthlyLimit: plan.callLimit,
            usedThisMonth: 0
        });
    }
}
```

**2. UsageTracker.sol**
```solidity
contract UsageTracker {
    event APICall(
        address indexed user,
        address indexed oracle,
        uint256 timestamp,
        uint256 cost
    );

    function recordCall(address user, address oracle) external onlyValidator {
        Subscription storage sub = subscriptions[user];
        sub.usedThisMonth++;

        // Check if over limit
        if (sub.usedThisMonth > sub.monthlyLimit) {
            uint256 overage = sub.usedThisMonth - sub.monthlyLimit;
            uint256 cost = overage * COST_PER_CALL; // $0.0005

            // Deduct from credits or add to bill
            if (credits[user] >= cost) {
                credits[user] -= cost;
            } else {
                monthlyBills[user] += cost;
            }
        }

        emit APICall(user, oracle, block.timestamp, COST_PER_CALL);
    }
}
```

---

## 7. Competitive Analysis

### Market Comparison

| Provider | Model | Price/Call | Subscription | Strengths |
|----------|-------|------------|--------------|-----------|
| **Chainlink** | Push oracle | ~$0.001 | Via credits | Established, highly secure |
| **API3** | Subscription | Custom | $200+/month | First-party data |
| **Pyth** | Pull oracle | 1 wei | Pay-per-pull | Ultra low cost |
| **FEEDS** | Hybrid | $0.0005 | $29-$99/mo | AI config, transparent pricing |

**FEEDS Competitive Advantages:**
- 50% cheaper than Chainlink per call
- More flexible than API3 subscriptions
- Better UX with AI-powered setup
- Transparent, predictable pricing
- Base-native (lower gas costs)

---

## 8. Growth Incentives

### Launch Strategy

**Phase 1: Free Tier (Months 1-3)**
- Unlimited free tier for early adopters
- Collect usage data and feedback
- Build case studies

**Phase 2: Paid Tiers (Months 4-6)**
- Introduce Starter + Pro tiers
- Early adopter discount: 50% off for 6 months
- Referral program: 20% commission for 12 months

**Phase 3: Enterprise (Months 7-12)**
- Custom enterprise deals
- Volume discounts
- White-label solutions

### Developer Incentives

**Credits for Contributions:**
- Bug reports: $50-$500 in credits
- Documentation: $25/page
- Integration guides: $100/guide
- Open source integrations: Up to $1000

**Hackathon Sponsorships:**
- $10,000 in credits for winners
- 6 months free Pro tier
- Technical support during hackathon

---

## 9. Implementation Roadmap

### Phase 1: Core Billing (Week 1-2)
- [ ] Deploy SubscriptionManager contract
- [ ] Deploy UsageTracker contract
- [ ] Integrate USDC payment processing
- [ ] Build subscription UI

### Phase 2: Analytics Dashboard (Week 3-4)
- [ ] Real-time usage tracking
- [ ] Cost calculator
- [ ] Usage graphs (Recharts)
- [ ] Export data (CSV, API)

### Phase 3: Advanced Features (Week 5-6)
- [ ] Credit system
- [ ] Auto-renewal
- [ ] Invoice generation
- [ ] Email notifications

### Phase 4: Optimization (Week 7-8)
- [ ] Volume discounts
- [ ] Referral system
- [ ] Admin dashboard
- [ ] Analytics for validators

---

## 10. References

**Oracle Pricing Research:**
- [Chainlink Billing Documentation](https://docs.chain.link/chainlink-functions/resources/billing)
- [Pyth Network Fees](https://docs.pyth.network/price-feeds/how-pyth-works/fees)
- [API3 Tokenomics](https://old-docs.api3.org/api3-whitepaper-v1.0.3.pdf)
- [Oracle Subscription Pricing](https://www.oracle.com/cloud/pricing/)

**Payment Infrastructure:**
- [USDC ERC20 Compatibility](https://web3.gate.com/en/crypto-wiki/article/understanding-usdc-s-erc20-token-compatibility-20251205)
- [Web3 Token Types Overview](https://www.hiro.so/blog/an-overview-of-8-types-of-tokens-in-web3)

---

## Appendix: Example User Journeys

### Small dApp Developer
- Starts with Free tier (testing)
- Upgrades to Starter at $29/month (10k MAU)
- Average cost: $32/month (29 + small overage)
- ROI: Oracle reliability > cost savings

### DeFi Protocol
- Needs Pro tier for production
- 500k API calls/month average
- Pays $99/month subscription
- Saves $400/month vs Chainlink
- ROI: 4x cost savings

### Enterprise Trading Platform
- Custom Enterprise deal
- 10M+ calls/month
- Dedicated infrastructure
- Volume pricing: $0.0003/call
- Total: ~$3,000/month vs $10,000 on Chainlink

