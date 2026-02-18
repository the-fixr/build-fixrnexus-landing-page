'use client';

import Link from 'next/link';

const AMBER = '#f59e0b';
const BG = '#050505';
const BORDER = '#1a1a1a';
const TEXT_DIM = '#666';
const TEXT_MID = '#999';

export default function TermsPage() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/levy" style={{ color: AMBER, textDecoration: 'none', fontSize: 12 }}>&lt; LEVY</Link>
        <span style={{ color: TEXT_DIM, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>TERMS OF USE</span>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 2 }}>
          <p style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 24 }}>Last updated: February 2025</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>1. ACCEPTANCE OF TERMS</h2>
          <p>By accessing or using the Levy Protocol (&quot;Protocol&quot;), you agree to be bound by these Terms of Use. If you do not agree to these terms, do not use the Protocol. The Protocol is a decentralized application deployed on the Solana blockchain.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>2. DESCRIPTION OF SERVICE</h2>
          <p>Levy is a non-custodial liquidity bounty protocol. It enables projects to escrow SOL in program-derived address (PDA) vaults to incentivize liquidity providers. The Protocol operates through immutable smart contracts on the Solana blockchain. The interface hosted at this domain provides a frontend for interacting with these contracts.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>3. ELIGIBILITY</h2>
          <p>You must be at least 18 years old and legally permitted to use decentralized finance protocols in your jurisdiction. You are solely responsible for ensuring your use of the Protocol complies with all applicable laws and regulations.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>4. NON-CUSTODIAL NATURE</h2>
          <p>The Protocol is entirely non-custodial. All funds are held in on-chain PDA vaults controlled by the Solana program. We do not hold, control, or have access to your funds, private keys, or wallet credentials at any time. Transactions are executed directly between you and the blockchain.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>5. RISKS</h2>
          <p>Use of the Protocol involves significant risks including but not limited to: smart contract vulnerabilities, blockchain network risks, loss of funds due to user error, regulatory uncertainty, and market volatility. You acknowledge and accept all such risks. The Protocol is currently deployed on Solana Devnet for testing purposes.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>6. PROTOCOL FEES</h2>
          <p>The Protocol charges a fee on LP payouts as configured in the on-chain protocol state. This fee is deducted automatically by the smart contract and sent to the protocol treasury. Fee parameters are visible on-chain and through the Protocol interface.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>7. NO WARRANTIES</h2>
          <p>The Protocol is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied. We do not guarantee uninterrupted access, error-free operation, or the accuracy of any data displayed through the interface.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>8. LIMITATION OF LIABILITY</h2>
          <p>To the maximum extent permitted by law, the Protocol developers and operators shall not be liable for any direct, indirect, incidental, consequential, or special damages arising from your use of the Protocol, including but not limited to loss of funds, profits, or data.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>9. MODIFICATIONS</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Protocol after modifications constitutes acceptance of the updated terms. Material changes will be indicated by updating the date at the top of this page.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>10. GOVERNING LAW</h2>
          <p>These terms shall be governed by and construed in accordance with applicable law, without regard to conflict of law principles. Any disputes arising from these terms or your use of the Protocol shall be resolved through binding arbitration.</p>
        </div>
      </div>
    </div>
  );
}
