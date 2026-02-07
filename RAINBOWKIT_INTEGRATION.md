# RainbowKit Integration Guide

## Overview

FEEDS now uses RainbowKit for Web3 wallet connections instead of direct `window.ethereum` calls. This provides a better UX with support for multiple wallet providers and a polished connection interface.

---

## Installation

```bash
npm install @rainbow-me/rainbowkit --legacy-peer-deps
```

**Note:** `--legacy-peer-deps` is required due to wagmi v3 compatibility.

**Installed Versions:**
- @rainbow-me/rainbowkit: ^2.2.10
- wagmi: ^2.19.5
- viem: ^2.44.4

---

## Configuration

### 1. Wagmi Config ([lib/wagmi/config.ts](lib/wagmi/config.ts))

Updated to include multiple wallet connectors:

```typescript
import { http, createConfig } from 'wagmi';
import { base, mainnet } from 'wagmi/chains';
import {
  injected,
  walletConnect,
  coinbaseWallet,
  metaMask
} from 'wagmi/connectors';

export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    injected(),           // Generic injected wallet
    metaMask(),           // MetaMask
    coinbaseWallet({      // Coinbase Wallet
      appName: 'FEEDS',
    }),
    walletConnect({       // WalletConnect protocol
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    }),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});
```

**Supported Wallets:**
- MetaMask
- Coinbase Wallet
- WalletConnect-compatible wallets (Rainbow, Trust, etc.)
- Any injected provider

### 2. WagmiProviders ([lib/wagmi/WagmiProviders.tsx](lib/wagmi/WagmiProviders.tsx))

Wrapped with RainbowKitProvider:

```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from './config';
import { useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';

export function WagmiProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'rgb(255, 0, 110)',      // FEEDS pink
            accentColorForeground: 'black',       // Text on accent
            borderRadius: 'none',                 // Terminal style
            fontStack: 'system',                  // Monospace
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Theme Customization:**
- Accent color matches FEEDS branding (pink: `rgb(255, 0, 110)`)
- No border radius for terminal aesthetic
- System font stack for consistency

---

## Component Updates

### SignupWizard Component ([components/SignupWizard.tsx](components/SignupWizard.tsx))

**Before (window.ethereum):**
```typescript
const handleWalletConnect = async () => {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  if (accounts.length > 0) {
    setStep('complete');
  }
};
```

**After (RainbowKit + wagmi):**
```typescript
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const { isConnected, address } = useAccount();

// In render:
{isConnected ? (
  <>
    <div className="mb-4 p-3 border border-[rgb(0,255,136)]">
      <p className="text-sm font-bold">✓ Wallet Connected</p>
      <p className="text-xs font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
    </div>
    <button onClick={() => setStep('complete')}>
      CONTINUE
    </button>
  </>
) : (
  <ConnectButton.Custom>
    {({ openConnectModal }) => (
      <button onClick={openConnectModal}>
        CONNECT WALLET
      </button>
    )}
  </ConnectButton.Custom>
)}
```

**Benefits:**
- Automatic wallet detection
- Multi-wallet support (MetaMask, Coinbase, WalletConnect)
- Network switching UI
- Error handling built-in
- Consistent UX across app

### Dashboard Component ([app/dashboard/page.tsx](app/dashboard/page.tsx))

Added ConnectButton to navigation:

```typescript
import { ConnectButton } from '@rainbow-me/rainbowkit';

// In nav header:
<ConnectButton
  chainStatus="icon"
  showBalance={false}
  accountStatus={{
    smallScreen: 'avatar',
    largeScreen: 'full',
  }}
/>
```

**Features:**
- Shows connected wallet address
- Network indicator icon
- Click to manage connection
- Responsive display (avatar on mobile, full address on desktop)

---

## Usage Patterns

### Basic Connection Check

```typescript
import { useAccount } from 'wagmi';

function Component() {
  const { isConnected, address, chainId } = useAccount();

  if (!isConnected) {
    return <div>Please connect wallet</div>;
  }

  return <div>Connected: {address}</div>;
}
```

### ConnectButton Integration

**Standard Button:**
```typescript
import { ConnectButton } from '@rainbow-me/rainbowkit';

<ConnectButton />
```

**Custom Button:**
```typescript
<ConnectButton.Custom>
  {({
    account,
    chain,
    openAccountModal,
    openChainModal,
    openConnectModal,
    mounted,
  }) => {
    const connected = mounted && account && chain;

    return (
      <button
        onClick={connected ? openAccountModal : openConnectModal}
        className="custom-button"
      >
        {connected ? account.displayName : 'Connect Wallet'}
      </button>
    );
  }}
</ConnectButton.Custom>
```

### Network Switching

```typescript
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';

function Component() {
  const { switchChain } = useSwitchChain();

  const handleSwitchToBase = () => {
    switchChain({ chainId: base.id });
  };

  return <button onClick={handleSwitchToBase}>Switch to Base</button>;
}
```

### Transaction Signing

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

function Component() {
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSubscribe = () => {
    writeContract({
      address: SUBSCRIPTION_MANAGER_ADDRESS,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'subscribeWithUSDC',
      args: [Tier.PRO],
    });
  };

  return (
    <button onClick={handleSubscribe} disabled={isLoading}>
      {isLoading ? 'Subscribing...' : 'Subscribe'}
    </button>
  );
}
```

---

## Environment Variables

Required for WalletConnect support:

```env
# .env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Get Project ID:**
1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create new project
3. Copy Project ID
4. Add to .env.local

---

## Styling & Theming

### Global CSS Import

RainbowKit styles are imported in WagmiProviders:

```typescript
import '@rainbow-me/rainbowkit/styles.css';
```

### Custom Theme

Applied in RainbowKitProvider:

```typescript
theme={darkTheme({
  accentColor: 'rgb(255, 0, 110)',    // Primary action color
  accentColorForeground: 'black',     // Text on accent
  borderRadius: 'none',               // Sharp corners
  fontStack: 'system',                // System fonts
})}
```

**Available Theme Options:**
- `accentColor` - Primary button and highlight color
- `accentColorForeground` - Text color on accent backgrounds
- `borderRadius` - Button/modal corner radius
- `fontStack` - Font family ('rounded' | 'system')
- `overlayBlur` - Backdrop blur effect

### CSS Overrides

For further customization, override in globals.css:

```css
/* Example: Customize wallet modal */
.iekbcc0 {
  background: black !important;
  border: 2px solid rgb(255, 0, 110) !important;
}

/* Example: Customize buttons */
button[class*="ConnectButton"] {
  font-family: 'JetBrains Mono', monospace !important;
}
```

---

## Migration Checklist

### Completed ✅

- [x] Install @rainbow-me/rainbowkit
- [x] Update wagmi config with multiple connectors
- [x] Wrap app with RainbowKitProvider
- [x] Apply custom theme matching FEEDS design
- [x] Update SignupWizard to use wagmi hooks
- [x] Add ConnectButton to dashboard
- [x] Remove window.ethereum TypeScript declarations

### TODO ⏳

- [ ] Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
- [ ] Test all wallet connections (MetaMask, Coinbase, WalletConnect)
- [ ] Implement network switching to Base
- [ ] Add wallet connection to subscription upgrade flow
- [ ] Test transaction signing with smart contracts
- [ ] Add wallet connection guards to protected features

---

## Troubleshooting

### Issue: "Module not found: Can't resolve '@rainbow-me/rainbowkit'"

**Solution:**
```bash
npm install @rainbow-me/rainbowkit --legacy-peer-deps
```

### Issue: Wallet won't connect

**Check:**
1. WalletConnect Project ID is set in .env.local
2. Wallet extension is installed and unlocked
3. User is on correct network (Base)
4. Browser has injected provider

**Debug:**
```typescript
const { connector, isConnecting, error } = useAccount();
console.log('Connector:', connector);
console.log('Is Connecting:', isConnecting);
console.log('Error:', error);
```

### Issue: Network mismatch

**Solution:** Add network switching:
```typescript
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';

const { switchChain } = useSwitchChain();

useEffect(() => {
  if (chainId !== base.id) {
    switchChain({ chainId: base.id });
  }
}, [chainId]);
```

### Issue: Styles not loading

**Check:**
1. `import '@rainbow-me/rainbowkit/styles.css'` is present
2. Import is in a client component
3. Clear Next.js cache: `rm -rf .next`

---

## Best Practices

### 1. Always Check Connection State

```typescript
const { isConnected, isConnecting } = useAccount();

if (isConnecting) return <div>Connecting...</div>;
if (!isConnected) return <ConnectButton />;
```

### 2. Handle Network Switching

```typescript
const { chain } = useAccount();

if (chain?.id !== base.id) {
  return <div>Please switch to Base network</div>;
}
```

### 3. Graceful Error Handling

```typescript
const { error } = useAccount();

if (error) {
  return <div>Connection error: {error.message}</div>;
}
```

### 4. Use ConnectButton.Custom for Brand Consistency

```typescript
<ConnectButton.Custom>
  {({ openConnectModal }) => (
    <button className="feeds-button" onClick={openConnectModal}>
      CONNECT
    </button>
  )}
</ConnectButton.Custom>
```

---

## Resources

**RainbowKit:**
- [Documentation](https://www.rainbowkit.com/docs/introduction)
- [Examples](https://github.com/rainbow-me/rainbowkit/tree/main/examples)
- [Theming Guide](https://www.rainbowkit.com/docs/theming)

**Wagmi:**
- [Documentation](https://wagmi.sh/)
- [Hooks Reference](https://wagmi.sh/react/hooks)
- [Migration Guide](https://wagmi.sh/react/guides/migrate-from-v1-to-v2)

**WalletConnect:**
- [Cloud Dashboard](https://cloud.walletconnect.com/)
- [Documentation](https://docs.walletconnect.com/)

---

## Summary

RainbowKit integration provides:

✅ **Multi-Wallet Support** - MetaMask, Coinbase, WalletConnect, and more
✅ **Better UX** - Polished connection modal with wallet icons
✅ **Network Switching** - Built-in UI for chain switching
✅ **Custom Theming** - Matches FEEDS terminal aesthetic
✅ **TypeScript Support** - Full type safety with wagmi hooks
✅ **React Hooks** - `useAccount`, `useConnect`, `useDisconnect`, etc.
✅ **Responsive Design** - Works on desktop and mobile

The migration from `window.ethereum` to RainbowKit + wagmi provides a more robust, user-friendly wallet connection experience while maintaining the FEEDS brand identity.
