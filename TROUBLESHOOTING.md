# Troubleshooting Oracle Management Features

## Quick Diagnostic

Run this command to check if everything is set up correctly:

```bash
node check-migration.js
```

Expected output:
```
✅ MIGRATION ALREADY RUN
The is_hidden column exists!
```

## Issue: Features Not Working

### Symptom: Hide/unhide buttons don't work

**Possible causes:**
1. Database migration not run
2. User not authenticated
3. Browser JavaScript errors

**Debug steps:**

1. **Check migration:**
   ```bash
   node check-migration.js
   ```

2. **Check browser console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for errors in red

3. **Check network tab:**
   - Open Network tab in DevTools
   - Click hide/unhide button
   - Look for failed requests to Supabase

### Symptom: Jazzicons not showing

**Possible causes:**
1. Server-side rendering issue (should be fixed now)
2. Invalid contract address
3. Component not mounted

**Debug steps:**

1. **Check if oracles have contract addresses:**
   ```javascript
   // In browser console on dashboard page
   fetch('/api/v1/oracle-list')  // If this endpoint exists
   ```

2. **Check console for errors:**
   Look for errors mentioning "jazzicon" or "window is not defined"

3. **Verify oracle has address:**
   ```bash
   # Check database
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   const fs = require('fs');
   const env = fs.readFileSync('.env.local', 'utf8');
   const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
   const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
   const supabase = createClient(url, key);
   supabase.from('oracles').select('name, contract_address').then(({data}) => {
     console.log(JSON.stringify(data, null, 2));
   });
   "
   ```

###Symptom: API Studio dropdown empty

**Possible causes:**
1. No deployed oracles (contract_address is null)
2. User not authenticated
3. Oracles belong to different user

**Debug steps:**

1. **Check if you're logged in:**
   - Look for your email/username in top right
   - If not, go to http://localhost:3000 and sign in

2. **Check if oracles are deployed:**
   ```bash
   node check-migration.js
   ```
   Look at the `contract_address` field - if it's `null`, oracle isn't deployed yet

3. **Deploy an oracle:**
   - Go to http://localhost:3000/create-oracle
   - Fill out form and deploy
   - Wait for transaction to confirm

## Manual Testing

### Test Hide/Unhide

1. Go to http://localhost:3000/dashboard
2. Find an oracle card
3. Click the eye icon (should be on the right side)
4. Oracle should fade and show "(RETIRED)"
5. Click "SHOW RETIRED" toggle at top
6. Hidden oracles should appear
7. Click eye icon again to unhide

### Test Jazzicons

1. Go to http://localhost:3000/dashboard
2. Each oracle with a `contract_address` should show a colorful circle avatar
3. Go to http://localhost:3000/api-studio
4. Select "Get Farcaster social metrics" or "Get price oracle data"
5. Oracle list should show with matching jazzicons

### Test API Studio Dropdown

1. Go to http://localhost:3000/api-studio
2. Select an endpoint that needs an oracle address
3. Should see "QUICK SELECT" section
4. Should show clickable list of your oracles
5. Click an oracle
6. Address field should populate
7. Endpoint should auto-switch for Farcaster oracles

## Common Errors

### Error: "column oracles.is_hidden does not exist"

**Solution:** Run the migration:
```bash
# Option 1: Supabase Dashboard (recommended)
# Go to https://supabase.com/dashboard → SQL Editor
# Paste contents of lib/supabase/migration-add-hidden.sql
# Click Run

# Option 2: Direct SQL (if you have access)
psql $DATABASE_URL -f lib/supabase/migration-add-hidden.sql
```

### Error: "window is not defined"

**Solution:** This was fixed in the latest Jazzicon component. Make sure you have the updated version:
```bash
cat components/Jazzicon.tsx | grep "mounted"
```

Should see `const [mounted, setMounted] = useState(false);`

### Error: "Module not found: @metamask/jazzicon"

**Solution:** Install the package:
```bash
npm install @metamask/jazzicon
```

### Error: Clicking hide button does nothing

**Possible causes:**
1. Not authenticated
2. Database permissions issue

**Solution:**
1. Check browser console for errors
2. Try signing out and back in
3. Check Supabase dashboard → Authentication → Users
4. Verify you're the owner of the oracle

## Verification Checklist

Run through this checklist to verify everything works:

- [ ] Migration ran successfully (`node check-migration.js` shows ✅)
- [ ] Logged into dashboard
- [ ] Can see oracles on dashboard
- [ ] Each oracle shows a colorful jazzicon avatar
- [ ] Can click eye icon to hide oracle
- [ ] Oracle fades and shows "(RETIRED)"
- [ ] "SHOW RETIRED" button appears
- [ ] Can toggle to show/hide retired oracles
- [ ] Can click eye icon again to unhide
- [ ] API Studio shows oracle list when selecting endpoint
- [ ] Jazzicons appear in API Studio list
- [ ] Clicking oracle in list populates address field
- [ ] Farcaster oracles auto-switch to farcaster endpoint

## Still Having Issues?

1. **Restart dev server:**
   ```bash
   # Kill server (Ctrl+C)
   npm run dev
   ```

2. **Clear browser cache:**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or open DevTools → Network tab → Check "Disable cache"

3. **Check all files are saved:**
   ```bash
   git status
   ```

4. **Verify package installed:**
   ```bash
   npm list @metamask/jazzicon
   # Should show: @metamask/jazzicon@2.0.0
   ```

5. **Check console for specific errors:**
   - Open browser DevTools (F12)
   - Console tab
   - Copy full error message
   - Search for error in this file or ORACLE_MANAGEMENT.md

## Debug Mode

Enable detailed logging:

1. **Add to dashboard page (temporarily):**
   ```javascript
   // In app/dashboard/page.tsx, add to checkUser():
   console.log('Oracles loaded:', oraclesData);
   console.log('Filtered:', filteredOracles);
   ```

2. **Add to API Studio (temporarily):**
   ```javascript
   // In app/api-studio/page.tsx, add to loadOracles():
   console.log('API Studio oracles:', data);
   ```

3. **Refresh pages and check browser console**

4. **Remove console.logs when done**

## Need More Help?

Check these files for detailed documentation:
- [ORACLE_MANAGEMENT.md](ORACLE_MANAGEMENT.md) - Full feature documentation
- [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md) - Contract security details
- [package.json](package.json) - Dependency versions
