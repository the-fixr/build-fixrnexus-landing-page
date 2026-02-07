# FEEDS.REVIEW - Setup Guide

Complete guide to setting up authentication, database, and email functionality.

## Table of Contents
1. [Supabase Setup](#supabase-setup)
2. [Resend Setup](#resend-setup)
3. [Environment Variables](#environment-variables)
4. [Wagmi/Viem Configuration](#wagmi-viem-configuration)
5. [Testing](#testing)

---

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: feeds-review (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to your users
5. Wait for the project to be created (~2 minutes)

### 2. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `/lib/supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run" to execute the schema

This will create:
- `profiles` table for user data
- `wallet_connections` table for multi-wallet support
- `notification_preferences` table for user preferences
- Row Level Security (RLS) policies
- Automatic trigger to create profile on signup

### 3. Get Your API Keys

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (save as `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (save as `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role key** (save as `SUPABASE_SERVICE_ROLE_KEY`) ⚠️ Keep this secret!

### 4. Configure Email Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize the confirmation email to match your brand

---

## Resend Setup

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. In the Resend dashboard, go to **API Keys**
2. Click "Create API Key"
3. Name it: `feeds-review-production`
4. Copy the API key (save as `RESEND_API_KEY`)

### 3. Configure Sending Domain (Optional but Recommended)

**For Production:**
1. Go to **Domains** → **Add Domain**
2. Enter your domain (e.g., `feeds.review`)
3. Add the DNS records to your domain provider:
   - SPF record
   - DKIM records
4. Wait for verification (~5-10 minutes)
5. Set `RESEND_FROM_EMAIL=noreply@feeds.review`

**For Development:**
- Resend provides a free `onboarding@resend.dev` email
- Use `RESEND_FROM_EMAIL=onboarding@resend.dev` for testing
- Note: Emails will only go to your verified email addresses

---

## Environment Variables

### 1. Create `.env.local` File

Copy the example file:
```bash
cp .env.local.example .env.local
```

### 2. Fill in Your Values

Edit `.env.local` with your actual values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@feeds.review

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your domain in production
```

### 3. Verify Environment Variables

Create a test file to verify:
```bash
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

---

## Wagmi/Viem Configuration

### 1. Create Wagmi Config

Create `/lib/wagmi/config.ts`:

```typescript
import { http, createConfig } from 'wagmi';
import { base, mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' // Get from cloud.walletconnect.com
    }),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
```

### 2. Get WalletConnect Project ID

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Sign up and create a new project
3. Copy the Project ID
4. Add to your wagmi config

### 3. Wrap App with Providers

Update `/app/layout.tsx`:

```typescript
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi/config';

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
```

---

## Testing

### 1. Test Authentication

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Click "CONNECT" button

4. Fill in signup form:
   - Username: testuser
   - Email: your-email@example.com
   - Password: testpass123

5. Check for:
   - ✅ Success message appears
   - ✅ Welcome email arrives in inbox
   - ✅ User created in Supabase (check Auth → Users)
   - ✅ Profile created (check Table Editor → profiles)
   - ✅ Notification preferences created (check notification_preferences)

### 2. Test Wallet Connection

1. Install MetaMask or another Web3 wallet

2. Make sure you're on Base network

3. After signing in, connect your wallet

4. Verify:
   - ✅ Wallet address appears in database (wallet_connections table)
   - ✅ Can set primary wallet
   - ✅ Can connect multiple wallets

### 3. Test Notification Preferences

1. Navigate to settings page (you'll need to create this route)

2. Toggle notification preferences

3. Click "SAVE PREFERENCES"

4. Verify:
   - ✅ Preferences saved to database
   - ✅ Success message appears
   - ✅ Preferences persist on page reload

---

## Common Issues

### Supabase Issues

**Problem**: "Invalid API key"
- ✅ Check that you copied the correct key
- ✅ Verify `.env.local` has correct variable names
- ✅ Restart dev server after changing env vars

**Problem**: "Row Level Security policy violation"
- ✅ Make sure RLS policies were created correctly
- ✅ Check that user is authenticated
- ✅ Verify `auth.uid()` matches the user_id in tables

### Resend Issues

**Problem**: "API key not found"
- ✅ Verify RESEND_API_KEY is in `.env.local`
- ✅ Check that key starts with `re_`
- ✅ Restart dev server

**Problem**: "Email not sending in development"
- ✅ Use `onboarding@resend.dev` for testing
- ✅ Check Resend dashboard for delivery logs
- ✅ Verify recipient email is verified in Resend

### Wagmi/Wallet Issues

**Problem**: "Connector not found"
- ✅ Make sure MetaMask or another wallet is installed
- ✅ Check that wagmi config is properly set up
- ✅ Verify WagmiProvider wraps your app

**Problem**: "Wrong network"
- ✅ Switch to Base network in your wallet
- ✅ Add Base network if not available (chainid 8453)

---

## Oracle Infrastructure Status

### ✅ Deployed Smart Contracts (Base Mainnet)

- **OracleRegistry**: `0x9262cDe71f1271Ea542545C7A379E112f904439b`
  - [View on BaseScan](https://basescan.org/address/0x9262cDe71f1271Ea542545C7A379E112f904439b)

- **OracleFactory**: `0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6`
  - [View on BaseScan](https://basescan.org/address/0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6)

### ✅ Deployed Validators (Cloudflare Workers)

All 5 validators deployed with health check endpoints:

1. Validator 1: `0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4`
   - https://feeds-validator-1.see21289.workers.dev
   - Health: https://feeds-validator-1.see21289.workers.dev/health

2. Validator 2: `0xdd97618068a90c54F128ffFdfc49aa7847A52316`
   - https://feeds-validator-2.see21289.workers.dev
   - Health: https://feeds-validator-2.see21289.workers.dev/health

3. Validator 3: `0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C`
   - https://feeds-validator-3.see21289.workers.dev
   - Health: https://feeds-validator-3.see21289.workers.dev/health

4. Validator 4: `0xeC4119bCF8378d683dc223056e07c23E5998b8a6`
   - https://feeds-validator-4.see21289.workers.dev
   - Health: https://feeds-validator-4.see21289.workers.dev/health

5. Validator 5: `0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c`
   - https://feeds-validator-5.see21289.workers.dev
   - Health: https://feeds-validator-5.see21289.workers.dev/health

### 🚀 Web Application Pages

- **Landing Page** (`/`) - Real-time validator status
- **Dashboard** (`/dashboard`) - User oracle management
- **Create Oracle** (`/create-oracle`) - AI-powered oracle setup
- **Health Monitor** (`/health`) - Detailed validator network status

### ⚠️ CRITICAL: Fund Validators

Each validator needs ~0.01 ETH on Base network for gas:

```
0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4
0xdd97618068a90c54F128ffFdfc49aa7847A52316
0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C
0xeC4119bCF8378d683dc223056e07c23E5998b8a6
0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c
```

## Next Steps

After completing setup:

1. ✅ Create a settings/dashboard page
2. ✅ Implement protected routes
3. ✅ Add oracle creation functionality
4. ✅ Set up oracle registry smart contract
5. ✅ Deploy validators with health monitoring
6. ⏳ Fund validator wallets
7. ⏳ Test oracle creation end-to-end
8. ⏳ Deploy to production

---

## Production Checklist

Before deploying to production:

- [ ] Set up custom domain for Resend
- [ ] Update `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Enable rate limiting on Supabase
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure CORS if needed
- [ ] Set up database backups
- [ ] Review RLS policies
- [ ] Test all flows end-to-end
- [ ] Set up CI/CD pipeline

---

## Support

For issues or questions:
- Check Supabase docs: https://supabase.com/docs
- Check Resend docs: https://resend.com/docs
- Check Wagmi docs: https://wagmi.sh
