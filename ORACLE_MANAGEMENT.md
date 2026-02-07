# Oracle Management Features

## New Features Added

### 1. Hide/Retire Oracles ✅

You can now hide oracles from the main dashboard view without deleting them. Hidden oracles are marked as "RETIRED" and can be shown/hidden with a toggle.

**How to use:**
- Click the eye icon (👁️) on any oracle card to hide it
- Click "SHOW RETIRED" toggle to view hidden oracles
- Click the eye-off icon on hidden oracles to unhide them

**Benefits:**
- Keep your active oracles organized
- Preserve historical oracles without cluttering the UI
- Easily restore hidden oracles when needed

### 2. Jazzicon Avatars ✅

Each oracle now has a unique visual identifier (jazzicon) generated from its contract address.

**Benefits:**
- Quickly identify oracles at a glance
- Visual differentiation between similar oracle names
- Consistent across dashboard and API Studio

### 3. Improved API Studio Dropdown ✅

The API Studio now shows ALL deployed oracles in a better UI:
- Clickable list instead of plain dropdown
- Shows jazzicons for visual identification
- Displays retired status
- Only shows oracles with valid contract addresses
- Auto-switches endpoint type based on oracle type

---

## Database Migration Required

Before using the hide/retire feature, you need to add the `is_hidden` column to your database.

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: `ozzlbctzerobxcwlqtzr`
3. Click "SQL Editor" in the left sidebar
4. Click "New query"
5. Paste this SQL:

```sql
-- Add is_hidden column to oracles table for soft-hiding oracles in UI
ALTER TABLE oracles ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add index for faster queries filtering hidden oracles
CREATE INDEX IF NOT EXISTS idx_oracles_hidden ON oracles(is_hidden);

-- Add comment
COMMENT ON COLUMN oracles.is_hidden IS 'When true, oracle is hidden from main UI but still accessible via direct link';
```

6. Click "Run" or press Cmd+Enter

### Option 2: Via Migration Script

```bash
cd /Users/chadneal/Desktop/feeds.review
./lib/supabase/run-migration.sh
```

### Option 3: Manual psql

If you have direct database access:

```bash
psql $DATABASE_URL -f lib/supabase/migration-add-hidden.sql
```

---

## Component Architecture

### New Components

**[/components/Jazzicon.tsx](components/Jazzicon.tsx)**
- React component wrapping @metamask/jazzicon
- Generates deterministic SVG avatars from addresses
- Props: `address`, `diameter`, `className`

### Updated Components

**[/app/dashboard/page.tsx](app/dashboard/page.tsx)**
- Added `showHidden` state for toggle
- Added `filteredOracles` computed value
- Added `toggleHideOracle()` function to update database
- Integrated Jazzicon component
- Added hide/unhide button with eye icons
- Shows "RETIRED" label on hidden oracles

**[/app/api-studio/page.tsx](app/api-studio/page.tsx)**
- Changed dropdown to clickable list
- Filters oracles to only those with `contract_address`
- Shows all oracles (including hidden ones)
- Integrated Jazzicon component
- Auto-selects endpoint type based on oracle type

---

## Usage Examples

### Dashboard

```typescript
// Hide an oracle
await supabase
  .from('oracles')
  .update({ is_hidden: true })
  .eq('id', oracleId);

// Show hidden oracles
const [showHidden, setShowHidden] = useState(false);
const filteredOracles = showHidden
  ? oracles
  : oracles.filter(o => !o.is_hidden);
```

### API Studio

```typescript
// Load only deployed oracles
const { data } = await supabase
  .from('oracles')
  .select('*')
  .eq('user_id', user.id)
  .not('contract_address', 'is', null)
  .order('created_at', { ascending: false });
```

### Jazzicon

```tsx
import Jazzicon from '@/components/Jazzicon';

<Jazzicon
  address="0xc4f7822a9DeCB9d15aadBc079D2c052C229E24dB"
  diameter={32}
  className="my-custom-class"
/>
```

---

## Testing

After running the migration, test the features:

### 1. Test Hide/Unhide

```bash
# Start dev server
npm run dev

# Open dashboard
open http://localhost:3000/dashboard

# Try:
# - Click eye icon to hide an oracle
# - Toggle "SHOW RETIRED" to see hidden oracles
# - Click eye icon on hidden oracle to unhide it
```

### 2. Test Jazzicons

```bash
# Check dashboard - each oracle should have a unique colored circle avatar
# Check API Studio - oracles in the list should have matching avatars
```

### 3. Test API Studio Dropdown

```bash
# Open API Studio
open http://localhost:3000/api-studio

# Try:
# - Select "Get Farcaster social metrics" endpoint
# - Check that all deployed oracles appear in the list
# - Click an oracle to select it
# - Verify the address field updates
# - Verify endpoint auto-switches for Farcaster oracles
```

---

## Troubleshooting

### "oracles.is_hidden column does not exist"

**Solution:** Run the database migration (see above)

### "Jazzicon not rendering"

**Possible causes:**
1. `@metamask/jazzicon` not installed → Run `npm install`
2. Invalid address passed to component → Check console for errors
3. SSR issue → Component is marked `'use client'`

**Debug:**
```javascript
// Check if jazzicon is installed
npm list @metamask/jazzicon

// Should show:
// @metamask/jazzicon@2.0.0
```

### "Oracle not showing in API Studio dropdown"

**Possible causes:**
1. Oracle doesn't have `contract_address` → Only deployed oracles show
2. User not authenticated → Login required
3. Oracle belongs to different user → Only user's oracles show

**Debug:**
```javascript
// Check oracle in database
const { data } = await supabase
  .from('oracles')
  .select('id, name, contract_address, user_id')
  .eq('id', 'YOUR_ORACLE_ID')
  .single();

console.log(data);
// contract_address should be non-null
// user_id should match your logged-in user
```

---

## API Changes

### Database Schema

**New column:**
```sql
oracles.is_hidden BOOLEAN DEFAULT FALSE
```

**New index:**
```sql
idx_oracles_hidden ON oracles(is_hidden)
```

### Query Filters

**Dashboard (show only visible oracles):**
```typescript
const filteredOracles = oracles.filter(o => !o.is_hidden);
```

**API Studio (show only deployed):**
```typescript
.not('contract_address', 'is', null)
```

---

## Package Dependencies

**New:**
- `@metamask/jazzicon@2.0.0` - Generates deterministic avatars

**Existing:**
- `lucide-react` - Added `Eye` and `EyeOff` icons
- `@supabase/supabase-js` - Database operations
- `next` - React framework
- `react` - UI library

---

## Future Enhancements

Potential improvements for later:

1. **Bulk operations** - Hide/unhide multiple oracles at once
2. **Archive reasons** - Add a note when retiring an oracle
3. **Restore wizard** - Easy way to clone retired oracles
4. **Export/Import** - Backup and restore oracle configurations
5. **Oracle groups** - Organize oracles into folders/tags
6. **Search/Filter** - Search oracles by name, type, token, etc.

---

## File Changes Summary

### New Files
- ✅ `components/Jazzicon.tsx` - Jazzicon component
- ✅ `lib/supabase/migration-add-hidden.sql` - Database migration
- ✅ `lib/supabase/run-migration.sh` - Migration script
- ✅ `ORACLE_MANAGEMENT.md` - This documentation

### Modified Files
- ✅ `app/dashboard/page.tsx` - Added hide/unhide + jazzicons
- ✅ `app/api-studio/page.tsx` - Improved dropdown + jazzicons
- ✅ `package.json` - Added @metamask/jazzicon

### Database Changes
- ✅ `oracles` table - Added `is_hidden` column
- ✅ Added index on `is_hidden` for performance

---

## Questions?

If you encounter issues:
1. Check the troubleshooting section above
2. Verify the migration was run successfully
3. Check browser console for errors
4. Check Supabase logs in the dashboard

**Related Documentation:**
- [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md) - Oracle contract security
- [TRULY_FIXED.md](TRULY_FIXED.md) - Oracle deployment fixes
- [SETUP.md](SETUP.md) - Initial project setup
