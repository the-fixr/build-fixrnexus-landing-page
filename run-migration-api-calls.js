// Script to check if API calls migration is needed and provide instructions
const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('                 API CALL TRACKING MIGRATION');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('This migration adds comprehensive API call tracking to your oracles.\n');

console.log('📊 FEATURES INCLUDED:\n');
console.log('  ✓ api_calls table - Tracks every API request');
console.log('  ✓ Call counters on oracles table (total, today, week, month)');
console.log('  ✓ Automatic counter increment via database triggers');
console.log('  ✓ Response time tracking');
console.log('  ✓ Success rate monitoring');
console.log('  ✓ Row-level security policies\n');

console.log('🚀 TO RUN THIS MIGRATION:\n');
console.log('1. Go to https://supabase.com/dashboard');
console.log('2. Select your project');
console.log('3. Click "SQL Editor" in the left sidebar');
console.log('4. Click "New Query"');
console.log('5. Copy and paste the SQL below');
console.log('6. Click "Run" or press Cmd+Enter\n');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('                         SQL TO RUN');
console.log('═══════════════════════════════════════════════════════════════════\n');

const sql = fs.readFileSync(
  path.join(__dirname, 'lib/supabase/migration-add-api-calls.sql'),
  'utf8'
);

console.log(sql);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                     AFTER MIGRATION');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('✨ WHAT YOU GET:\n');
console.log('  1. Dashboard shows API call counts for each oracle');
console.log('  2. Click the chart icon on any oracle to see detailed stats');
console.log('  3. View 7-day history, response times, and success rates');
console.log('  4. All API calls automatically tracked in real-time\n');

console.log('🧪 TO TEST:\n');
console.log('  1. Deploy your app: npm run dev');
console.log('  2. Make API calls to: /api/v1/oracle/[address]');
console.log('  3. View stats on dashboard or /oracle-stats/[oracleId]\n');

console.log('📝 NOTE: API call tracking starts AFTER running this migration.');
console.log('    Historical data from before the migration will not be available.\n');

console.log('═══════════════════════════════════════════════════════════════════\n');
