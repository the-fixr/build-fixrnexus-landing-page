# Oracle Retirement System

## Overview

Oracles can be "retired" (hidden) by their creators without being deleted from the database. This allows creators to deprecate oracles gracefully while maintaining historical data and API call records.

## How It Works

### For Oracle Creators

**On Dashboard:**
- Click the eye icon (👁️) on any oracle card to retire it
- Click again to un-retire
- Toggle "SHOW RETIRED" button to view/hide retired oracles
- Retired oracles show "(RETIRED)" label and appear dimmed

### For Marketplace Users

**Hidden from Marketplace:**
- Retired oracles (`is_hidden = true`) are automatically excluded from `/marketplace` listings
- This prevents new users from discovering deprecated oracles

**Direct Links Still Work:**
- If someone has a direct link to a retired oracle (`/oracle/[id]`), they can still access it
- A yellow warning banner appears at the top:
  ```
  ⚠️ RETIRED ORACLE
  This oracle has been retired by its creator and is no longer actively maintained.
  The oracle may still be functional, but future updates and support are not guaranteed.
  Use at your own risk.
  ```

**Reviews Still Visible:**
- Existing reviews remain visible on retired oracles
- Users cannot submit new reviews for retired oracles (enforced by RLS policy)

## Database Implementation

### Column Added to `oracles` Table

```sql
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_oracles_hidden ON oracles(is_hidden);
```

### Marketplace Filter

```typescript
// app/api/v1/marketplace/route.ts
let query = supabase
  .from('oracles')
  .select('...')
  .eq('is_public', true)
  .eq('is_hidden', false)  // Excludes retired oracles
  .not('contract_address', 'is', null);
```

### Row-Level Security

Retired oracles can still be queried directly (for dashboard and direct links):

```sql
-- Anyone can read public oracles (including retired ones for direct access)
CREATE POLICY "Anyone can read public oracles"
  ON oracles FOR SELECT
  USING (is_public = true);

-- But reviews can only be created for non-retired public oracles
CREATE POLICY "Users can create reviews"
  ON oracle_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM oracles WHERE id = oracle_id AND is_public = true AND is_hidden = false)
  );
```

## Use Cases

### When to Retire an Oracle

✅ **Good Reasons:**
- Oracle is outdated or superseded by a newer version
- Token being tracked is no longer relevant
- Creator wants to focus support on other oracles
- Oracle has bugs that won't be fixed

❌ **Bad Reasons:**
- Temporary downtime (just let it stay inactive)
- Low usage (users may still need it)
- Testing purposes (use `is_public = false` instead)

### Difference: Retired vs Private

| Feature | Retired (`is_hidden = true`) | Private (`is_public = false`) |
|---------|------------------------------|------------------------------|
| Shows in marketplace | ❌ No | ❌ No |
| Direct link works | ✅ Yes (with warning) | ✅ Yes |
| Can submit reviews | ❌ No | ❌ No |
| Oracle still functional | ✅ Yes | ✅ Yes |
| Creator intent | "Deprecated, use at own risk" | "Internal use only" |

### Example Workflow

**Scenario:** Creator has "DEGEN-v5" and deploys improved "DEGEN-v6"

1. Creator deploys DEGEN-v6 with better performance
2. DEGEN-v6 appears in marketplace
3. Creator tests DEGEN-v6 for 1 week
4. Creator retires DEGEN-v5 using eye icon on dashboard
5. DEGEN-v5 disappears from marketplace
6. Users with direct links to DEGEN-v5 see retirement warning
7. New users discover and use DEGEN-v6
8. Historical DEGEN-v5 API call data is preserved

## Technical Notes

### API Call Tracking

Retired oracles continue to track API calls:
- `total_api_calls` keeps incrementing
- `calls_today`, `calls_this_week`, `calls_this_month` update normally
- Analytics page remains accessible

### Blockchain State

Retiring an oracle **does not**:
- Delete the smart contract (impossible on blockchain)
- Stop validators from running (if still deployed on Cloudflare)
- Prevent API calls to the contract address

Retiring an oracle **only**:
- Sets `is_hidden = true` in database
- Hides from marketplace UI
- Shows warning banner on detail page

### Future Enhancements

**Potential Improvements:**
- Add "Reason for retirement" text field
- Allow creators to specify replacement oracle
- Show "Superseded by: DEGEN-v6" link on retired oracles
- Add retirement date to oracle stats
- Email subscribers when oracle is retired
- Option to fully delete oracle (with confirmation)

## Summary

The retirement system provides a **soft deprecation** mechanism:
- Gracefully removes oracles from marketplace discovery
- Preserves historical data and existing access
- Warns users about maintenance status
- Maintains data integrity and API call records

**Key Principle:** Retirement is reversible and non-destructive. Un-retiring an oracle immediately makes it discoverable again in the marketplace.
