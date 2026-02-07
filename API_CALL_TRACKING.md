# API Call Tracking System

Complete implementation of API call tracking, counting, and visualization for oracles.

## Overview

This system automatically tracks every API call made to your oracle endpoints and provides real-time analytics and visualizations.

## What's Included

### 1. Database Schema

**New Table: `api_calls`**
- Tracks every API request with full metadata
- Fields: oracle_id, user_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent
- Indexed for fast queries by oracle, user, and date

**Extended Table: `oracles`**
- Added cached counters for performance:
  - `total_api_calls` - Lifetime call count
  - `calls_today` - Resets daily
  - `calls_this_week` - Resets weekly
  - `calls_this_month` - Resets monthly
  - `last_call_at` - Timestamp of most recent call

**Automatic Triggers**
- Database trigger auto-increments counters on each API call
- No manual counter management needed

**Row-Level Security**
- Users can only view their own oracle API calls
- Service role can insert tracking records

### 2. Tracking Middleware

**File: `/lib/track-api-call.ts`**
- Utility function for tracking API calls
- Automatically captures request metadata
- Non-blocking (won't fail API requests if tracking fails)
- Tracks: response time, status code, IP address, user agent

**Integrated Into:**
- `/app/api/v1/oracle/[address]/route.ts` - Price oracle endpoint
- `/app/api/v1/farcaster/[address]/route.ts` - Farcaster oracle endpoint

Every API call is automatically tracked with:
- Precise response time in milliseconds
- HTTP status code (200, 400, 500, etc.)
- Client IP address (for usage pattern analysis)
- User agent (for identifying API clients)

### 3. Statistics API

**Endpoint: `/api/v1/stats/[oracleId]`**

Returns comprehensive statistics for an oracle:

```typescript
{
  oracle: {
    id: string,
    name: string,
    address: string
  },
  stats: {
    totalCalls: number,
    callsToday: number,
    callsThisWeek: number,
    callsThisMonth: number,
    lastCallAt: string,
    avgResponseTimeMs: number,
    successRate: number  // Percentage
  },
  history: {
    last7Days: [
      { date: string, calls: number }
    ]
  }
}
```

### 4. Visualization Component

**Component: `/components/OracleApiStats.tsx`**

Beautiful React component that displays:
- **Total Calls** - Lifetime API requests
- **Today's Calls** - Real-time daily count
- **Average Response Time** - Performance metric in milliseconds
- **Success Rate** - Percentage of successful API calls
- **7-Day Chart** - Visual bar chart showing call volume trends
- **This Week/Month** - Aggregated statistics

Features:
- Auto-refreshing data
- Hover tooltips on chart bars
- Color-coded metrics (blue for activity, green for success)
- Loading and error states
- Responsive design

### 5. Dashboard Integration

**Updated: `/app/dashboard/page.tsx`**

Each oracle card now shows:
- Total API calls badge with activity icon
- Today's calls in green if active
- Chart icon button to view detailed statistics

Quick actions:
- Click oracle card → Open in API Studio
- Click chart icon → View detailed stats page
- Click eye icon → Hide/unhide oracle

### 6. Dedicated Stats Page

**Page: `/app/oracle-stats/[oracleId]/page.tsx`**

Full-page analytics view with:
- Oracle details (name, type, contract address)
- Full OracleApiStats component
- Quick actions:
  - Test in API Studio
  - View on BaseScan
- Back to dashboard navigation

## How to Use

### Step 1: Run the Migration

```bash
node run-migration-api-calls.js
```

This will show you the SQL to run in Supabase dashboard.

Or copy the SQL directly from:
```bash
cat lib/supabase/migration-add-api-calls.sql
```

Then paste into Supabase SQL Editor and run.

### Step 2: Deploy Your App

```bash
npm run dev
```

API tracking is now active!

### Step 3: View Statistics

**On Dashboard:**
1. Go to `/dashboard`
2. See call counts on each oracle card
3. Click the chart icon for detailed stats

**Dedicated Stats Page:**
1. Click chart icon on any oracle
2. View full analytics with 7-day history
3. See response times and success rates

**In API Studio:**
1. Make test API calls
2. Calls are automatically tracked
3. Return to dashboard to see updated counts

## API Usage Examples

### Query Oracle Stats Programmatically

```javascript
// Fetch stats for an oracle
const response = await fetch(`/api/v1/stats/${oracleId}`);
const data = await response.json();

console.log(`Total calls: ${data.stats.totalCalls}`);
console.log(`Avg response: ${data.stats.avgResponseTimeMs}ms`);
console.log(`Success rate: ${data.stats.successRate}%`);

// 7-day history
data.history.last7Days.forEach(day => {
  console.log(`${day.date}: ${day.calls} calls`);
});
```

### Make Tracked API Calls

```javascript
// Every call to these endpoints is automatically tracked:

// Price oracle
const priceData = await fetch(`/api/v1/oracle/${oracleAddress}`);

// Farcaster oracle
const socialData = await fetch(`/api/v1/farcaster/${oracleAddress}`);

// Check updated stats
const stats = await fetch(`/api/v1/stats/${oracleId}`);
```

## Database Queries

### Get Call History for an Oracle

```sql
SELECT
  endpoint,
  status_code,
  response_time_ms,
  created_at
FROM api_calls
WHERE oracle_id = 'your-oracle-id'
ORDER BY created_at DESC
LIMIT 100;
```

### Get Today's Call Count

```sql
SELECT COUNT(*) as calls_today
FROM api_calls
WHERE oracle_id = 'your-oracle-id'
  AND created_at >= CURRENT_DATE;
```

### Average Response Time

```sql
SELECT AVG(response_time_ms) as avg_response
FROM api_calls
WHERE oracle_id = 'your-oracle-id'
  AND created_at >= NOW() - INTERVAL '7 days';
```

### Success Rate

```sql
SELECT
  COUNT(*) FILTER (WHERE status_code = 200) * 100.0 / COUNT(*) as success_rate
FROM api_calls
WHERE oracle_id = 'your-oracle-id'
  AND created_at >= NOW() - INTERVAL '7 days';
```

## Performance Considerations

### Cached Counters
- Counters on `oracles` table are updated via database triggers
- Fast reads without aggregation queries
- Suitable for displaying on dashboard with many oracles

### Periodic Counter Resets
- Daily/weekly/monthly counters can be reset via cron job
- Function provided: `reset_oracle_call_periods()`
- Schedule in Supabase dashboard or external cron service

### Query Optimization
- All queries use indexed columns
- 7-day lookups are fast (indexed on created_at)
- Response time calculations cache in memory

## Future Enhancements

Potential additions to this system:

1. **Billing Integration**
   - Charge per API call based on subscription tier
   - Overage warnings and automatic billing
   - Invoice generation with call breakdowns

2. **Rate Limiting**
   - Enforce call limits per tier
   - Return 429 Too Many Requests when exceeded
   - Grace periods and soft limits

3. **Advanced Analytics**
   - Call patterns by hour/day of week
   - Geographic distribution of callers
   - Most popular oracles dashboard
   - Anomaly detection (sudden spikes/drops)

4. **Alerting**
   - Email when oracle exceeds X calls/day
   - Slack notifications for errors
   - Performance degradation alerts

5. **Export & Reporting**
   - CSV export of call history
   - Monthly usage reports
   - API call invoices

## Troubleshooting

### Calls Not Being Tracked

1. **Check Migration Status**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_name = 'api_calls';
   ```

2. **Verify Service Role Key**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
   - Check logs for tracking errors

3. **Test Tracking Directly**
   ```javascript
   import { trackApiCall } from '@/lib/track-api-call';

   await trackApiCall({
     oracleAddress: '0x...',
     endpoint: '/test',
     statusCode: 200,
     responseTimeMs: 100
   });
   ```

### Counters Not Updating

1. **Check Trigger Exists**
   ```sql
   SELECT trigger_name
   FROM information_schema.triggers
   WHERE event_object_table = 'api_calls';
   ```

2. **Manually Refresh Counters**
   ```sql
   UPDATE oracles
   SET total_api_calls = (
     SELECT COUNT(*) FROM api_calls WHERE oracle_id = oracles.id
   );
   ```

### Stats Not Loading

1. Check browser console for errors
2. Verify oracle ID is correct
3. Ensure user owns the oracle (RLS policies)
4. Check if oracle has `contract_address` set

## Files Created/Modified

### New Files
- ✅ `/lib/supabase/migration-add-api-calls.sql` - Database migration
- ✅ `/lib/track-api-call.ts` - Tracking utility
- ✅ `/app/api/v1/stats/[oracleId]/route.ts` - Stats API endpoint
- ✅ `/components/OracleApiStats.tsx` - Visualization component
- ✅ `/app/oracle-stats/[oracleId]/page.tsx` - Dedicated stats page
- ✅ `/run-migration-api-calls.js` - Migration helper script
- ✅ `/API_CALL_TRACKING.md` - This documentation

### Modified Files
- ✅ `/app/api/v1/oracle/[address]/route.ts` - Added tracking
- ✅ `/app/api/v1/farcaster/[address]/route.ts` - Added tracking
- ✅ `/app/dashboard/page.tsx` - Added call count display & stats button

## Summary

You now have a complete, production-ready API call tracking system that:
- ✅ Automatically tracks every API request
- ✅ Shows real-time call counts on dashboard
- ✅ Provides detailed analytics with 7-day history
- ✅ Measures response times and success rates
- ✅ Uses database triggers for performance
- ✅ Includes beautiful visualizations
- ✅ Ready for billing integration

All you need to do is run the migration SQL in your Supabase dashboard, and the system will start tracking immediately!
