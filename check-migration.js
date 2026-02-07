// Quick script to check if is_hidden column exists in Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

async function checkMigration() {
  console.log('Checking if is_hidden column exists...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Try to query is_hidden column
    const { data, error } = await supabase
      .from('oracles')
      .select('id, name, is_hidden, contract_address')
      .limit(1);

    if (error) {
      if (error.message.includes('is_hidden') || error.message.includes('column')) {
        console.log('❌ MIGRATION NOT RUN');
        console.log('\nThe is_hidden column does not exist in the oracles table.');
        console.log('\nYou need to run the migration. Follow these steps:\n');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Click "SQL Editor"');
        console.log('4. Paste the SQL from: lib/supabase/migration-add-hidden.sql');
        console.log('5. Click "Run"\n');
        console.log('SQL to run:');
        console.log('─'.repeat(60));
        const sql = fs.readFileSync('./lib/supabase/migration-add-hidden.sql', 'utf8');
        console.log(sql);
        console.log('─'.repeat(60));
      } else {
        console.error('Unexpected error:', error);
      }
      process.exit(1);
    }

    console.log('✅ MIGRATION ALREADY RUN');
    console.log('\nThe is_hidden column exists!');
    if (data && data.length > 0) {
      console.log('\nSample oracle:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    console.log('\nYou can now use the hide/unhide feature.');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkMigration();
