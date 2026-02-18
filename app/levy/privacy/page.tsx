'use client';

import Link from 'next/link';

const AMBER = '#f59e0b';
const BG = '#050505';
const BORDER = '#1a1a1a';
const TEXT_DIM = '#666';
const TEXT_MID = '#999';

export default function PrivacyPage() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/levy" style={{ color: AMBER, textDecoration: 'none', fontSize: 12 }}>&lt; LEVY</Link>
        <span style={{ color: TEXT_DIM, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>PRIVACY POLICY</span>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 2 }}>
          <p style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 24 }}>Last updated: February 2025</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>1. INFORMATION WE COLLECT</h2>
          <p>The Levy Protocol interface does not collect, store, or process personal information. We do not require account creation, email addresses, names, or any personally identifiable information to use the Protocol.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>2. BLOCKCHAIN DATA</h2>
          <p>All transactions on the Solana blockchain are public by nature. Your wallet address and transaction history are visible on the blockchain and through block explorers. This data is not collected by us but is inherent to blockchain technology.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>3. LOCAL STORAGE</h2>
          <p>The interface uses browser localStorage to remember your onboarding status (whether you have seen the introductory walkthrough). This data is stored locally on your device and is not transmitted to any server.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>4. WALLET CONNECTIONS</h2>
          <p>When you connect a wallet (Phantom, Solflare, etc.), the connection is established directly between your browser and the wallet extension. We do not have access to your private keys, seed phrases, or wallet credentials.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>5. RPC REQUESTS</h2>
          <p>The interface makes RPC calls to Solana network nodes to read blockchain data and submit transactions. These requests may be processed by third-party RPC providers who have their own privacy policies. Your IP address may be visible to these providers.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>6. ANALYTICS</h2>
          <p>The interface may use anonymized, privacy-respecting analytics to understand usage patterns. No personal data or wallet addresses are included in analytics data.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>7. THIRD-PARTY SERVICES</h2>
          <p>The interface is hosted on Vercel and may use their infrastructure. The interface links to Solscan for block explorer functionality. These services have their own privacy policies.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>8. DATA RETENTION</h2>
          <p>Since we do not collect personal data, there is no data to retain or delete. Blockchain transactions are permanent and immutable by design.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>9. CHANGES TO THIS POLICY</h2>
          <p>We may update this privacy policy periodically. Changes will be reflected by the date at the top of this page.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>10. CONTACT</h2>
          <p>For privacy inquiries, reach out through the channels listed on fixr.nexus.</p>
        </div>
      </div>
    </div>
  );
}
