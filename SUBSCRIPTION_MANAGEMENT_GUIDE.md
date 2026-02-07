# Subscription Management System

## Overview

A complete subscription management interface has been added to FEEDS, allowing users to view their current plan, track usage, and upgrade/downgrade with multiple payment options (USDC, ETH, $FEEDS).

---

## New Components

### 1. SubscriptionManager Component

**Location:** [components/SubscriptionManager.tsx](components/SubscriptionManager.tsx)

**Purpose:** Comprehensive subscription management UI for the dashboard

**Features:**

#### Current Plan Overview
- Visual display of current tier (Free, Starter, Pro, Enterprise)
- Monthly pricing with $FEEDS discount option
- Real-time usage tracking with progress bar
- Color-coded usage alerts (green < 70%, yellow 70-90%, red > 90%)
- Quick stats: Update frequency, Remaining calls, Support level

#### Available Plans Grid
- Side-by-side comparison of all tiers
- Highlighted recommended plan (Pro)
- Current plan indicator
- Upgrade/Downgrade buttons
- Feature previews (first 4 features + count)
- Responsive grid layout

#### Payment Method Modal
- Three payment options:
  - **USDC** - Stablecoin for price stability
  - **ETH** - Native Base token
  - **$FEEDS** - 25% discount + "SAVE 25%" badge
- Visual selection interface
- Price display for each method
- Order summary before confirmation
- Immediate billing notice

**Key Props:**
```typescript
interface SubscriptionManagerProps {
  currentTier?: 'free' | 'starter' | 'pro' | 'enterprise';
  usedCalls?: number;
  monthlyLimit?: number;
  onUpgrade?: (tier: string, paymentMethod: string) => void;
}
```

### 2. Subscription Page

**Location:** [app/subscription/page.tsx](app/subscription/page.tsx)

**Purpose:** Dedicated page for subscription management

**Features:**
- Protected route (requires authentication)
- Breadcrumb navigation back to dashboard
- Full-page subscription manager
- Loading state while fetching data
- Future integration with Supabase/smart contracts

**Access:** `/subscription` or click "SUBSCRIPTION" card from dashboard

---

## Dashboard Integration

### Updated Dashboard Quick Actions

**Location:** [app/dashboard/page.tsx](app/dashboard/page.tsx)

**New Layout:** 4-column grid (was 3-column)

**Quick Action Cards:**

1. **CREATE ORACLE** (Pink border - Primary CTA)
   - Icon: Zap
   - Action: Navigate to `/create-oracle`
   - Purpose: AI-powered oracle configuration

2. **SUBSCRIPTION** (New - Green accent)
   - Icon: CreditCard
   - Action: Navigate to `/subscription`
   - Purpose: Manage billing and upgrade plan

3. **ANALYTICS** (Updated - Now clickable)
   - Icon: TrendingUp
   - Action: Navigate to `/analytics`
   - Purpose: Track usage and performance

4. **MY ORACLES** (Coming Soon)
   - Icon: Settings
   - Status: Future feature
   - Purpose: View and manage data feeds

---

## User Flows

### View Current Subscription

```
Dashboard
  ↓
Click "SUBSCRIPTION" card
  ↓
Subscription Page
  ↓
View:
  - Current plan details
  - Usage progress bar
  - Remaining calls
  - Quick stats
```

### Upgrade to Paid Tier

```
Subscription Page
  ↓
Click tier card (e.g., "Pro")
  ↓
Payment Modal opens
  ↓
Select payment method:
  - USDC ($99)
  - ETH (~0.033 ETH)
  - $FEEDS ($74.25) [SAVE 25%]
  ↓
Review summary
  ↓
Click "CONFIRM UPGRADE"
  ↓
Smart contract transaction
  ↓
Success + Plan activated
```

### Downgrade Flow

```
Subscription Page
  ↓
Click lower tier (e.g., Pro → Starter)
  ↓
Confirmation modal
  ↓
Downgrade at next billing cycle
  ↓
Keep current features until expiry
```

---

## Payment Integration

### Smart Contract Functions

**USDC Payment:**
```typescript
const { ethereum } = window;
const provider = new ethers.providers.Web3Provider(ethereum);
const signer = provider.getSigner();

// Approve USDC spending
const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
await usdc.approve(SUBSCRIPTION_MANAGER_ADDRESS, amount);

// Subscribe
const manager = new ethers.Contract(
  SUBSCRIPTION_MANAGER_ADDRESS,
  SUBSCRIPTION_MANAGER_ABI,
  signer
);
await manager.subscribeWithUSDC(Tier.PRO);
```

**ETH Payment:**
```typescript
await manager.subscribeWithETH(Tier.PRO, {
  value: ethers.utils.parseEther("0.033")
});
```

**$FEEDS Payment:**
```typescript
// Approve $FEEDS spending
const feeds = new ethers.Contract(FEEDS_TOKEN_ADDRESS, ERC20_ABI, signer);
await feeds.approve(SUBSCRIPTION_MANAGER_ADDRESS, amount);

// Subscribe with 25% discount
await manager.subscribeWithFEEDS(Tier.PRO);
```

### Payment Method Details

| Method | Price Example (Pro) | Advantages | Gas Cost |
|--------|---------------------|------------|----------|
| **USDC** | $99.00 | Price stability, predictable | ~50k gas |
| **ETH** | ~0.033 ETH | Native token, widely held | ~40k gas |
| **$FEEDS** | $74.25 | 25% discount, best value | ~55k gas |

---

## Data Structure

### Subscription Record (Database)

```sql
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tier TEXT NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
  payment_method TEXT, -- 'usdc', 'eth', 'feeds'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  monthly_limit INTEGER NOT NULL,
  used_this_month INTEGER DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
```

### Usage Tracking

```sql
CREATE TABLE usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  oracle_address TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost NUMERIC(20, 18), -- Cost in USD (18 decimals)
  charged_from TEXT -- 'subscription', 'credits', 'overage'
);

CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_timestamp ON usage_events(timestamp);
```

---

## UI/UX Design

### Color Scheme

**Tier Indicators:**
- Current Plan: Green border (`rgb(0, 255, 136)`)
- Recommended: Pink border (`rgb(255, 0, 110)`)
- Other Plans: Gray border (`#gray-800`)

**Usage Alerts:**
- Safe (< 70%): Green (`rgb(0, 255, 136)`)
- Warning (70-90%): Yellow (`rgb(255, 200, 0)`)
- Critical (> 90%): Pink (`rgb(255, 0, 110)`)

**Payment Methods:**
- USDC: Blue accent
- ETH: Purple accent
- $FEEDS: Pink accent with "SAVE 25%" badge

### Responsive Design

**Desktop (lg):**
- 4-column tier grid
- 3-column quick actions
- Full modal width (max-w-lg)

**Tablet (md):**
- 2-column tier grid
- 2-column quick actions
- Responsive modal

**Mobile (sm):**
- 1-column layout
- Stacked payment options
- Full-width buttons

---

## Future Enhancements

### Phase 1: Core Features (Current)
- ✅ Subscription management UI
- ✅ Tier comparison
- ✅ Payment method selection
- ✅ Usage tracking display
- ⏳ Smart contract integration

### Phase 2: Advanced Features
- [ ] Auto-renewal toggle
- [ ] Billing history
- [ ] Invoice downloads (PDF)
- [ ] Payment method management
- [ ] Prepaid credits purchase
- [ ] Usage alerts/notifications

### Phase 3: Analytics & Insights
- [ ] Cost forecasting
- [ ] Usage trends graph
- [ ] Savings calculator
- [ ] Plan recommendations
- [ ] Overage predictions

### Phase 4: Enterprise Features
- [ ] Team management
- [ ] Multi-user access
- [ ] Custom contracts
- [ ] Volume discounts
- [ ] Dedicated support portal

---

## Integration Checklist

### Smart Contract Deployment

- [ ] Deploy SubscriptionManager to Base testnet
- [ ] Test all payment methods (USDC, ETH, $FEEDS)
- [ ] Verify contract on BaseScan
- [ ] Deploy to Base mainnet
- [ ] Set USDC address (Base mainnet)
- [ ] Set $FEEDS token address (after Clanker launch)
- [ ] Set treasury address (Gnosis Safe)

### Database Setup

- [ ] Create `subscriptions` table
- [ ] Create `usage_events` table
- [ ] Create `monthly_bills` table
- [ ] Create `credits` table
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create database functions for usage tracking
- [ ] Set up cron jobs for billing cycles

### Frontend Integration

- [x] Create SubscriptionManager component
- [x] Create subscription page
- [x] Add dashboard navigation
- [ ] Connect to Supabase
- [ ] Integrate Web3 wallet
- [ ] Add transaction handling
- [ ] Implement success/error states
- [ ] Add loading indicators

### Testing

- [ ] Unit tests for components
- [ ] Integration tests for payment flows
- [ ] E2E tests for upgrade journey
- [ ] Load testing for concurrent upgrades
- [ ] Security audit for smart contracts
- [ ] User acceptance testing (UAT)

---

## Error Handling

### Common Scenarios

**Insufficient Balance:**
```typescript
Error: Insufficient USDC balance
→ Show current balance
→ Link to buy USDC on Base
→ Suggest alternative payment method
```

**Transaction Rejected:**
```typescript
Error: User rejected transaction
→ Keep modal open
→ Allow retry
→ Show explanation of required approvals
```

**Network Error:**
```typescript
Error: Network timeout
→ Retry automatically (3 attempts)
→ Show user-friendly error
→ Suggest checking wallet connection
```

**Contract Error:**
```typescript
Error: Plan not active
→ Contact support
→ Log error for investigation
→ Offer alternative tiers
```

---

## Analytics Events

### Recommended Tracking

**Subscription Events:**
```javascript
// User views subscription page
analytics.track('subscription_page_viewed', {
  current_tier: 'free',
  usage_percent: 45
});

// User selects tier
analytics.track('tier_selected', {
  selected_tier: 'pro',
  current_tier: 'free'
});

// User selects payment method
analytics.track('payment_method_selected', {
  method: 'feeds',
  tier: 'pro'
});

// Subscription upgrade completed
analytics.track('subscription_upgraded', {
  from_tier: 'free',
  to_tier: 'pro',
  payment_method: 'feeds',
  amount_usd: 74.25
});
```

**Conversion Funnel:**
1. Dashboard view
2. Subscription page view
3. Tier selection
4. Payment method selection
5. Transaction initiated
6. Transaction confirmed
7. Upgrade completed

---

## Security Considerations

### Smart Contract Security

**Approval Flow:**
1. User approves token spending
2. Contract checks allowance
3. Contract transfers tokens
4. Subscription activated

**Rate Limiting:**
- Max 1 upgrade per 24 hours
- Prevent spam transactions
- Gas price limits

**Access Control:**
- Only owner can set $FEEDS token
- Only owner can update plans
- Users can only modify own subscriptions

### Frontend Security

**Input Validation:**
- Validate tier selection
- Verify payment amounts
- Check wallet connection
- Confirm network (Base)

**Transaction Safety:**
- Show transaction preview
- Require explicit confirmation
- Display gas estimates
- Verify contract addresses

---

## Support & Documentation

### User Help Resources

**FAQs:**
- How do I upgrade my plan?
- What payment methods are accepted?
- Can I cancel anytime?
- What happens when I downgrade?
- How does the $FEEDS discount work?

**Troubleshooting:**
- Transaction stuck/pending
- Wallet won't connect
- Insufficient balance errors
- Network switching issues

**Contact:**
- Email: support@feeds.network
- Discord: /feeds-support
- Twitter: @feeds_network

---

## Summary

The subscription management system provides:

✅ **User-Friendly Interface** - Clean, intuitive tier selection
✅ **Multiple Payment Options** - USDC, ETH, $FEEDS with 25% discount
✅ **Real-Time Usage Tracking** - Visual progress bars and alerts
✅ **Flexible Upgrades** - Easy tier switching with payment choice
✅ **Mobile Responsive** - Works on all devices
✅ **Smart Contract Ready** - Built for on-chain integration

The system is ready for smart contract integration and will enable seamless subscription management for FEEDS oracle users on Base network.
