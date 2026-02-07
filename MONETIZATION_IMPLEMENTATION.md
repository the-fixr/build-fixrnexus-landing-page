# FEEDS Monetization - Beta Mode

## Current Status: BETA (All Free)

During beta, **all oracles and features are free**. The focus is on:
1. Building the user base
2. Gathering usage analytics
3. Validating product-market fit

Monetization decisions will be made after beta based on user feedback and usage patterns.

## What's Implemented for Beta

### 1. Oracle Visibility & Description ([create-oracle/page.tsx](app/create-oracle/page.tsx))

Creators can:
- Add a description to their oracle
- Choose whether to list in the public marketplace

### 2. Usage Tracking

The `oracle_stats` table tracks:
- Total API calls per oracle
- Calls in last 24h/7d
- Average rating and reviews
- Popularity score (for marketplace sorting)

### 3. Database Schema ([migrations/001_add_pricing_and_api_keys.sql](lib/supabase/migrations/001_add_pricing_and_api_keys.sql))

Added to `oracles` table:
- `is_public` - Whether oracle appears in marketplace
- `is_hidden` - For retired oracles
- `description` - Oracle description text
- `pricing_model` - Stored but not enforced (default: 'free')
- `price_per_call` - Stored but not enforced
- `monthly_price` - Stored but not enforced

## What's NOT Enforced During Beta

- **No payment gating** - All API calls succeed regardless of pricing model
- **No API keys required** - Anyone can call any oracle API
- **No subscription checks** - Access is not restricted
- **No billing** - Nothing is charged

## Migration

Run this SQL in Supabase to add the beta fields:

```sql
-- See lib/supabase/migrations/001_add_pricing_and_api_keys.sql
```

## Future Monetization (Post-Beta)

When ready to monetize, decide between:

1. **Platform Subscription Model**
   - Users pay FEEDS for API access tiers
   - Creators get exposure but no direct payment

2. **Creator Marketplace Model**
   - Creators set their own prices
   - Users pay per oracle
   - Platform takes % cut

3. **Hybrid Model**
   - Platform subscription for API access
   - Premium oracles with creator payments

### Future Tables Needed

When monetization is implemented:
- `api_keys` - For authenticated API access
- `oracle_subscriptions` - For paid oracle access
- `api_usage` - For detailed usage logging and billing
- `creator_earnings` - For revenue tracking
- `platform_subscriptions` - For platform tier access

## Revenue Model Decision Factors

Collect this data during beta to inform the decision:
- Which oracles get the most usage?
- What's the typical usage pattern per user?
- Are users willing to pay? (survey)
- What price points make sense?
- Do creators want to monetize?
