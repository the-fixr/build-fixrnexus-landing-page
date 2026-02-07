'use client';

import Link from 'next/link';

const AMBER = '#f59e0b';
const BG = '#050505';
const BORDER = '#1a1a1a';
const TEXT_DIM = '#666';
const TEXT_MID = '#999';

export default function DisclaimerPage() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/levy" style={{ color: AMBER, textDecoration: 'none', fontSize: 12 }}>&lt; LEVY</Link>
        <span style={{ color: TEXT_DIM, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>DISCLAIMER</span>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 2 }}>
          <p style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 24 }}>Last updated: February 2025</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>1. GENERAL DISCLAIMER</h2>
          <p>The Levy Protocol is provided on an &quot;as is&quot; and &quot;as available&quot; basis. The information presented through the interface is for informational purposes only and does not constitute financial advice, investment advice, trading advice, or any other sort of advice. You should not treat any of the content as such.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>2. NO FINANCIAL ADVICE</h2>
          <p>Nothing contained in the Levy Protocol interface constitutes a solicitation, recommendation, endorsement, or offer to buy or sell any digital assets, securities, or other financial instruments. All trading and liquidity provision involves risk. You are solely responsible for determining whether any investment, strategy, or related transaction is appropriate for you based on your personal objectives, financial circumstances, and risk tolerance.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>3. PROTOCOL RISKS</h2>
          <p>Interacting with decentralized protocols on Solana involves inherent risks including but not limited to: smart contract vulnerabilities, economic exploits, impermanent loss, oracle manipulation, network congestion, validator downtime, and total loss of deposited funds. The Protocol has not been formally audited. Use at your own risk.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>4. NO WARRANTIES</h2>
          <p>The developers and contributors make no warranties, express or implied, regarding the Protocol&apos;s security, reliability, accuracy, or fitness for a particular purpose. There is no guarantee that the Protocol will operate without interruption or error, or that defects will be corrected.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>5. LIMITATION OF LIABILITY</h2>
          <p>In no event shall the developers, contributors, or affiliated parties be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from your use of or inability to use the Protocol, including but not limited to loss of funds, loss of data, or loss of profits.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>6. EXPERIMENTAL SOFTWARE</h2>
          <p>The Levy Protocol is experimental software deployed on the Solana blockchain. It has not undergone a formal security audit. The code is open source and available for review. Users are encouraged to review the source code and understand the mechanics before interacting with the Protocol.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>7. REGULATORY UNCERTAINTY</h2>
          <p>The regulatory status of decentralized protocols, digital assets, and blockchain technology is unclear or unsettled in many jurisdictions. It is your responsibility to determine whether your use of the Protocol complies with applicable laws and regulations in your jurisdiction.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>8. THIRD-PARTY RISKS</h2>
          <p>The Protocol interacts with third-party services including Solana validators, RPC providers, and wallet extensions. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party services.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>9. PRICE AND MARKET RISKS</h2>
          <p>Digital asset prices are highly volatile. The value of SOL and any tokens involved in bounties may fluctuate significantly. Past performance is not indicative of future results. You may lose some or all of your deposited funds.</p>

          <h2 style={{ color: AMBER, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>10. ACKNOWLEDGMENT</h2>
          <p>By using the Levy Protocol, you acknowledge that you have read this disclaimer, understand the risks involved, and accept full responsibility for your interactions with the Protocol.</p>
        </div>
      </div>
    </div>
  );
}
