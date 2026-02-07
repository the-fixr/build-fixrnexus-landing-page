# Oracle Marketplace & Review System

Complete implementation of public oracle discovery, reviews, and ratings.

## Overview

Users can now:
- **Browse** all public oracles in a searchable marketplace
- **Filter** by type, pricing, rating
- **Review** oracles they've used with star ratings
- **Vote** on helpful reviews
- **Discover** the best data feeds for their needs

Creators can:
- **Publish** oracles to the marketplace
- **Set pricing** (free, pay-per-call, subscription, donation)
- **Respond** to reviews
- **Build reputation** through quality data and support

## Database Schema

### Tables Created

#### `oracle_reviews`
User reviews and ratings for public oracles.

```sql
- id (UUID, PK)
- oracle_id (UUID, FK → oracles)
- user_id (UUID, FK → auth.users)
- rating (INTEGER 1-5) *required*
- title (TEXT) *required*
- review_text (TEXT) *required*

-- Optional subcategory ratings
- data_quality_rating (INTEGER 1-5)
- performance_rating (INTEGER 1-5)
- value_rating (INTEGER 1-5)
- support_rating (INTEGER 1-5)

-- Verification
- verified_user (BOOLEAN) - Has made 10+ API calls
- usage_count (INTEGER) - Total API calls made

-- Community
- helpful_count (INTEGER)
- unhelpful_count (INTEGER)

-- Creator response
- creator_response (TEXT)
- creator_responded_at (TIMESTAMPTZ)

-- Metadata
- created_at, updated_at

UNIQUE(oracle_id, user_id) -- One review per user
```

#### `review_votes`
Helpful/unhelpful votes on reviews.

```sql
- id (UUID, PK)
- review_id (UUID, FK → oracle_reviews)
- user_id (UUID, FK → auth.users)
- vote_type (TEXT) - 'helpful' or 'unhelpful'
- created_at

UNIQUE(review_id, user_id) -- One vote per user per review
```

#### `oracle_stats`
Cached statistics for fast marketplace queries.

```sql
- oracle_id (UUID, PK, FK → oracles)

-- Review stats
- average_rating (DECIMAL 3,2)
- total_reviews (INTEGER)
- rating_distribution (JSONB) - {"1": 0, "2": 0, ...}

-- Usage stats
- total_api_calls (INTEGER)
- unique_users (INTEGER)
- calls_last_24h, calls_last_7d, calls_last_30d

-- Performance
- avg_response_time_ms (INTEGER)
- uptime_percentage (DECIMAL 5,2)
- last_update_at (TIMESTAMPTZ)

-- Computed scores
- popularity_score (INTEGER) - For sorting
- quality_score (DECIMAL 5,2) - Weighted metric

- updated_at
```

### Extended `oracles` Table

```sql
-- Added columns:
- is_public (BOOLEAN DEFAULT TRUE) - Show in marketplace
- description (TEXT) - Oracle description
- pricing_model (TEXT) - 'free', 'pay_per_call', 'subscription', 'donation'
- price_per_call (DECIMAL 20,8) - Price in USD or ETH
- monthly_price (DECIMAL 10,2) - For subscriptions
```

### Automatic Triggers

1. **update_oracle_stats_on_review** - Updates oracle_stats when review is added/changed
2. **update_review_vote_counts** - Updates helpful/unhelpful counts when voted

## API Endpoints

### Marketplace API

#### `GET /api/v1/marketplace`

Browse and search public oracles.

**Query Parameters:**
- `type` - Filter by oracle type (price, farcaster, liquidity, custom)
- `search` - Search in name, description, token
- `minRating` - Minimum average rating (0-5)
- `pricingModel` - Filter by pricing (free, pay_per_call, subscription, donation)
- `sortBy` - Sort order (popularity, rating, newest, usage)
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "oracles": [
    {
      "id": "uuid",
      "name": "DEGEN Price Feed",
      "description": "Real-time DEGEN token price from GeckoTerminal",
      "type": "price",
      "targetToken": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      "contractAddress": "0x...",
      "pricingModel": "free",
      "stats": {
        "average_rating": 4.8,
        "total_reviews": 12,
        "total_api_calls": 45231,
        "unique_users": 87,
        "calls_last_24h": 1234
      }
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Reviews API

#### `GET /api/v1/reviews/[oracleId]`

Get all reviews for an oracle.

**Query Parameters:**
- `limit` - Results per page (default: 10)
- `offset` - Pagination offset
- `sortBy` - Sort order (helpful, recent, rating)

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Excellent oracle, very reliable",
      "review_text": "Been using this for 2 months...",
      "verified_user": true,
      "usage_count": 523,
      "helpful_count": 15,
      "created_at": "2024-01-15T10:30:00Z",
      "profiles": {
        "username": "alice.eth"
      }
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 10,
    "offset": 0
  }
}
```

#### `POST /api/v1/reviews/[oracleId]`

Submit a review for an oracle.

**Authentication:** Required (Supabase Auth)

**Body:**
```json
{
  "rating": 5,
  "title": "Great oracle!",
  "review_text": "Very accurate data and fast updates",
  "data_quality_rating": 5,
  "performance_rating": 5,
  "value_rating": 5,
  "support_rating": 4
}
```

**Validation:**
- `rating`: Required, 1-5
- `title`: Required, min 3 chars
- `review_text`: Required, min 10 chars
- Subcategory ratings: Optional, 1-5
- User can only review each oracle once
- Oracle must be public
- Verified badge if user has 10+ API calls

**Response:**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "rating": 5,
    "verified_user": true,
    "usage_count": 45,
    ...
  }
}
```

## Pages

### `/marketplace` - Public Oracle Marketplace

**Features:**
- Search bar with live search
- Filters:
  - Oracle type (Price, Farcaster, Liquidity, Custom)
  - Pricing model (Free, Pay-per-call, Subscription, Donation)
  - Minimum rating (3+, 4+, 4.5+)
- Sort by:
  - Popularity (default)
  - Rating
  - Newest
  - Most used
- Oracle cards showing:
  - Jazzicon
  - Name & type
  - Description
  - Target token
  - Star rating + review count
  - Usage statistics
  - Pricing
- Click card → Oracle detail page

### `/oracle/[id]` - Oracle Detail & Reviews

**Features:**
- Full oracle information:
  - Jazzicon + name
  - Description
  - Type & target token
  - Star rating with review count
- Quick stats:
  - Total API calls
  - Update frequency
  - Consensus threshold
  - Pricing
- Action buttons:
  - "Try in API Studio" → `/api-studio`
  - "View on BaseScan" → BaseScan link
- Reviews section:
  - "Write a Review" button
  - Review form (rating, title, text)
  - Review list sorted by helpful votes
  - Verified user badges
  - Helpful vote counts

## Components

### `StarRating.tsx`

Reusable star rating component.

**Props:**
```typescript
{
  rating: number; // 0-5
  onChange?: (rating: number) => void; // For interactive ratings
  size?: number; // Star size in pixels (default: 20)
  readonly?: boolean; // Disable clicks (default: false)
  showCount?: number; // Show review count (optional)
}
```

**Usage:**
```tsx
// Display only
<StarRating rating={4.5} readonly showCount={12} />

// Interactive
<StarRating
  rating={userRating}
  onChange={(rating) => setUserRating(rating)}
  size={32}
/>
```

## Row-Level Security

### `oracle_reviews`

**SELECT:** Anyone can read reviews
**INSERT:** Authenticated users can create reviews for public oracles
**UPDATE:** Users can update their own reviews
**UPDATE:** Oracle creators can add responses to reviews
**DELETE:** Users can delete their own reviews

### `review_votes`

**SELECT:** Anyone can read votes
**INSERT:** Authenticated users can vote
**UPDATE:** Users can change their votes
**DELETE:** Users can remove their votes

### `oracle_stats`

**SELECT:** Anyone can read stats (public data)

## How to Use

### 1. Run the Migration

```bash
node run-migration-reviews.js
```

Copy the SQL and paste into Supabase SQL Editor.

### 2. Make Oracles Public

By default, new oracles are public. To manually control:

```sql
-- Make an oracle public
UPDATE oracles
SET
  is_public = true,
  description = 'Real-time DEGEN token price from GeckoTerminal',
  pricing_model = 'free'
WHERE id = 'your-oracle-id';
```

### 3. Browse Marketplace

Visit `http://localhost:3000/marketplace`

**Features:**
- Search for "DEGEN" or other tokens
- Filter by type (Price feeds)
- Filter by pricing (Free only)
- Sort by popularity or rating
- Click oracle to view details

### 4. Leave a Review

1. Click on an oracle
2. Click "WRITE A REVIEW"
3. Select star rating (1-5)
4. Enter title and review text
5. Submit

**Verified Badge:**
- Appears if you've made 10+ API calls to that oracle
- Automatically calculated from `api_calls` table

## Pricing Models

### Free
```sql
pricing_model = 'free'
price_per_call = NULL
monthly_price = NULL
```

Display: **FREE** (green)

### Pay-per-call
```sql
pricing_model = 'pay_per_call'
price_per_call = 0.0001 -- USD or ETH
monthly_price = NULL
```

Display: **$0.0001/call** (yellow)

### Subscription
```sql
pricing_model = 'subscription'
price_per_call = NULL
monthly_price = 29.00
```

Display: **$29/month** (blue)

### Donation
```sql
pricing_model = 'donation'
price_per_call = NULL
monthly_price = NULL
```

Display: **Donation** (purple)

## Stats Calculation

Oracle stats are automatically updated via database triggers.

### Average Rating

```sql
AVG(rating) FROM oracle_reviews WHERE oracle_id = ?
```

### Rating Distribution

```json
{
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 8,
  "5": 15
}
```

### Popularity Score

Currently not implemented. Suggested formula:

```
popularity_score =
  (average_rating * 20) +
  (log10(total_api_calls + 1) * 10) +
  (total_reviews * 5) +
  (unique_users * 2)
```

### Quality Score

Currently not implemented. Suggested formula:

```
quality_score =
  (average_rating * 0.4) +
  (uptime_percentage / 20) +
  (verified_review_percentage * 0.2)
```

## Future Enhancements

### Voting on Reviews (TODO)

Add buttons to vote helpful/unhelpful:

```typescript
const handleVote = async (reviewId: string, voteType: 'helpful' | 'unhelpful') => {
  await fetch(`/api/v1/reviews/${reviewId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote_type: voteType })
  });
};
```

### Creator Responses (TODO)

Allow oracle creators to respond to reviews:

```typescript
const handleRespond = async (reviewId: string, response: string) => {
  await fetch(`/api/v1/reviews/${reviewId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ creator_response: response })
  });
};
```

### Badges & Achievements

- ⭐ **Highly Rated** - 4.5+ stars, 10+ reviews
- 🔥 **Trending** - High recent usage growth
- ⚡ **Fast** - <50ms avg response time
- 💎 **Premium** - Paid oracle
- 🎯 **Accurate** - High data quality ratings
- 👥 **Popular** - 100+ unique users

### Advanced Filtering

- Date range (oracles created in last week/month)
- Update frequency (real-time, 1min, 5min, etc.)
- Chain filter (when multi-chain support added)
- Creator filter (by specific creator)

### Sorting Options

- Most reviewed
- Best value (price/quality ratio)
- Recently updated
- Fastest response time

## Example Workflow

### User Journey

1. Visit `/marketplace`
2. Search "DEGEN price"
3. Filter: Type = Price, Pricing = Free
4. Sort by Rating
5. Click "DEGEN-v6" oracle
6. See 4.8★ rating, 12 reviews
7. Read reviews from verified users
8. Click "TRY IN API STUDIO"
9. Test the oracle with sample queries
10. Return to oracle page
11. Click "WRITE A REVIEW"
12. Rate 5 stars, write review
13. Submit → Review appears instantly

### Creator Journey

1. Deploy oracle via `/create-oracle`
2. Oracle automatically public
3. Users discover in `/marketplace`
4. Users test and review oracle
5. Creator sees review on oracle page
6. Creator responds to review (TODO)
7. High ratings → more discovery
8. More users → more reviews → higher popularity

## Troubleshooting

### Oracle Not Appearing in Marketplace

**Check:**
```sql
SELECT is_public, contract_address FROM oracles WHERE id = 'your-oracle-id';
```

**Fix:**
- `is_public` must be `true`
- `contract_address` must not be null (oracle must be deployed)

### Can't Submit Review

**Error: "You have already reviewed this oracle"**
- One review per user per oracle
- Update your existing review instead

**Error: "Cannot review private oracles"**
- Oracle `is_public` must be `true`

**Error: "Authentication required"**
- User must be logged in via Supabase Auth

### Reviews Not Showing

**Check:**
```sql
SELECT COUNT(*) FROM oracle_reviews WHERE oracle_id = 'your-oracle-id';
```

**Check RLS:**
- Reviews have public read access
- Verify Supabase RLS policies are enabled

### Stats Not Updating

**Check trigger:**
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_oracle_stats';
```

**Manual refresh:**
```sql
SELECT update_oracle_stats_on_review();
```

## Summary

You now have a complete marketplace and review system:

✅ **Database:** Reviews, votes, and stats tables with automatic triggers
✅ **APIs:** Marketplace discovery and review submission endpoints
✅ **UI:** Beautiful marketplace page with filters and oracle detail pages
✅ **Components:** Reusable star rating component
✅ **Security:** Row-level security policies
✅ **Verification:** Verified user badges for active users
✅ **Stats:** Automatic calculation of ratings and usage metrics

Run the migration and start building your oracle marketplace!
