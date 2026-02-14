/**
 * Fixr API Documentation Page
 * Matches the landing page theme: camo bg, floating black boxes, Rajdhani + mono
 */

export function generateDocsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fixr API Docs</title>
  <meta name="description" content="API documentation for Fixr - Token analysis, builder feeds, and more.">
  <meta property="og:title" content="Fixr API Documentation">
  <meta property="og:description" content="Integrate with Fixr's API for token analysis, builder tracking, security audits, and more.">
  <meta property="og:image" content="https://fixr.nexus/fixrpfp.png">
  <link rel="icon" href="https://fixr.nexus/fixrpfp.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #030303;
      --surface: rgba(0, 0, 0, 0.7);
      --surface-inner: rgba(0, 0, 0, 0.5);
      --border: rgba(255, 255, 255, 0.06);
      --text: #fff;
      --text-muted: #999;
      --text-dim: #555;
      --accent: #FF006E;
      --accent-glow: rgba(255, 0, 110, 0.15);
      --green: #10b981;
      --orange: #f59e0b;
      --blue: #3b82f6;
      --red: #ef4444;
    }

    body {
      font-family: 'Rajdhani', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
      position: relative;
    }

    /* Camo Background */
    .camo-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }

    .camo-bg svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .camo-grain {
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-repeat: repeat;
      background-size: 128px 128px;
      opacity: 0.03;
      pointer-events: none;
    }

    .camo-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%);
      pointer-events: none;
    }

    /* PFP Watermark */
    .pfp-watermark {
      position: fixed;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .pfp-watermark img {
      width: 350px;
      height: 350px;
      border-radius: 50%;
      opacity: 0.04;
    }

    @media (min-width: 768px) {
      .pfp-watermark img { width: 450px; height: 450px; }
    }

    .container {
      position: relative;
      z-index: 10;
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 1rem;
      text-decoration: none;
      color: inherit;
    }

    .logo img {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid var(--border);
    }

    .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .logo-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .header-links {
      display: flex;
      gap: 1rem;
    }

    .header-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all 0.2s;
      backdrop-filter: blur(8px);
      background: var(--surface);
    }

    .header-link:hover {
      color: var(--text);
      border-color: var(--accent);
    }

    .header-link.accent {
      background: rgba(255, 0, 110, 0.1);
      border-color: rgba(255, 0, 110, 0.2);
      color: var(--accent);
    }

    .header-link.accent:hover {
      background: rgba(255, 0, 110, 0.2);
    }

    /* Intro */
    .intro {
      margin-bottom: 3rem;
    }

    .intro h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      font-weight: 700;
    }

    .intro p {
      font-size: 1.1rem;
      color: var(--text-muted);
      max-width: 700px;
    }

    .base-url {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.75rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
      backdrop-filter: blur(12px);
    }

    .base-url code {
      color: var(--accent);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }

    /* Floating Box */
    .floating-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    /* Section */
    .section {
      margin-bottom: 3rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .section-header h2 {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .section-line {
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    /* Tier Cards */
    .tier-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 800px) {
      .tier-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 500px) {
      .tier-grid { grid-template-columns: 1fr; }
    }

    .tier-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
      backdrop-filter: blur(12px);
    }

    .tier-card.highlight {
      border-color: var(--accent);
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .tier-name {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    .tier-amount {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 0.25rem;
    }

    .tier-limit {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* Endpoint Cards */
    .endpoint-group {
      margin-bottom: 2rem;
    }

    .endpoint-group-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      padding-left: 0.5rem;
      border-left: 2px solid var(--accent);
    }

    .endpoint {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 0.75rem;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      cursor: pointer;
    }

    .endpoint-header:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .method {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .method.get { background: rgba(16, 185, 129, 0.15); color: var(--green); }
    .method.post { background: rgba(59, 130, 246, 0.15); color: var(--blue); }
    .method.put { background: rgba(245, 158, 11, 0.15); color: var(--orange); }
    .method.delete { background: rgba(239, 68, 68, 0.15); color: var(--red); }

    .endpoint-path {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.85rem;
      flex: 1;
    }

    .endpoint-desc {
      font-size: 0.85rem;
      color: var(--text-dim);
    }

    .endpoint-body {
      display: none;
      padding: 1.25rem;
      border-top: 1px solid var(--border);
      background: var(--surface-inner);
    }

    .endpoint.open .endpoint-body {
      display: block;
    }

    .endpoint-section {
      margin-bottom: 1.25rem;
    }

    .endpoint-section:last-child {
      margin-bottom: 0;
    }

    .endpoint-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    /* Code blocks */
    pre {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      background: rgba(10, 10, 10, 0.8);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.5;
    }

    code {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }

    .code-inline {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      background: rgba(10, 10, 10, 0.6);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.82em;
      color: var(--accent);
    }

    /* Auth section */
    .auth-methods {
      display: grid;
      gap: 1rem;
    }

    .auth-method {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .auth-method-title {
      font-size: 1.05rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .auth-method-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    /* x402 */
    .x402-flow {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
      margin: 1.5rem 0;
    }

    @media (max-width: 700px) {
      .x402-flow { grid-template-columns: 1fr; }
    }

    .flow-step {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
      position: relative;
      backdrop-filter: blur(12px);
    }

    .flow-step::after {
      content: '\\2192';
      position: absolute;
      right: -1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
    }

    .flow-step:last-child::after {
      display: none;
    }

    @media (max-width: 700px) {
      .flow-step::after {
        content: '\\2193';
        right: auto;
        bottom: -1rem;
        top: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    }

    .flow-num {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.7rem;
      color: var(--accent);
      margin-bottom: 0.25rem;
    }

    .flow-text {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    tr:last-child td {
      border-bottom: none;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
      font-size: 0.85rem;
      color: var(--text-dim);
    }

    .footer a {
      color: var(--accent);
      text-decoration: none;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
  </style>
</head>
<body>
  <!-- Camo Background -->
  <div class="camo-bg">
    <svg preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="camo-1">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="1" result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
          <feComponentTransfer in="gray" result="threshold">
            <feFuncA type="discrete" tableValues="0 0 0 0 1 1 0 0"/>
          </feComponentTransfer>
        </filter>
        <filter id="camo-2">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="42" result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
          <feComponentTransfer in="gray" result="threshold">
            <feFuncA type="discrete" tableValues="0 0 0 1 1 0 0 0"/>
          </feComponentTransfer>
        </filter>
        <filter id="camo-red">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="77" result="noise"/>
          <feComponentTransfer in="noise" result="threshold">
            <feFuncR type="discrete" tableValues="0 0 0 1 1 0 0 0"/>
            <feFuncG type="discrete" tableValues="0 0 0 0 0 0 0 0"/>
            <feFuncB type="discrete" tableValues="0 0 0 0 0 0 0 0"/>
            <feFuncA type="discrete" tableValues="0 0 0 1 1 0 0 0"/>
          </feComponentTransfer>
        </filter>
        <filter id="camo-red-2">
          <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="123" result="noise"/>
          <feComponentTransfer in="noise" result="threshold">
            <feFuncR type="discrete" tableValues="0 0 1 1 0 0 0 0"/>
            <feFuncG type="discrete" tableValues="0 0 0 0 0 0 0 0"/>
            <feFuncB type="discrete" tableValues="0 0 0 0 0 0 0 0"/>
            <feFuncA type="discrete" tableValues="0 0 1 1 0 0 0 0"/>
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#111" filter="url(#camo-1)" opacity="0.25"/>
      <rect width="100%" height="100%" fill="#161616" filter="url(#camo-2)" opacity="0.15"/>
      <rect width="100%" height="100%" fill="#990000" filter="url(#camo-red)" opacity="0.1"/>
      <rect width="100%" height="100%" fill="#800000" filter="url(#camo-red-2)" opacity="0.07"/>
    </svg>
    <div class="camo-grain"></div>
    <div class="camo-vignette"></div>
  </div>

  <!-- PFP Watermark -->
  <div class="pfp-watermark">
    <img src="https://fixr.nexus/fixrpfp.png" alt="">
  </div>

  <div class="container">
    <!-- Header -->
    <div class="header">
      <a href="https://fixr.nexus" class="logo">
        <img src="https://fixr.nexus/fixrpfp.png" alt="Fixr">
        <div>
          <div class="logo-text">FIXR</div>
          <div class="logo-sub">API Docs</div>
        </div>
      </a>
      <div class="header-links">
        <a href="https://fixr.nexus" class="header-link">Home</a>
        <a href="https://fixr.nexus/hub" class="header-link accent">Hub</a>
        <a href="https://farcaster.xyz/fixr" class="header-link" target="_blank">Farcaster</a>
      </div>
    </div>

    <!-- Intro -->
    <div class="intro">
      <h1>API Documentation</h1>
      <p>Integrate with Fixr's API for token analysis, builder tracking, security audits, and more. Access is tiered by FIXR staking or pay-per-call via x402.</p>
      <div class="base-url">
        Base URL: <code>https://agent.fixr.nexus</code>
      </div>
    </div>

    <!-- Access Tiers -->
    <div class="section">
      <div class="section-header">
        <h2>Access Tiers</h2>
        <div class="section-line"></div>
      </div>
      <div class="tier-grid">
        <div class="tier-card">
          <div class="tier-name">Free</div>
          <div class="tier-amount">0</div>
          <div class="tier-limit">10 req/min</div>
        </div>
        <div class="tier-card">
          <div class="tier-name">Builder</div>
          <div class="tier-amount">1M+</div>
          <div class="tier-limit">20 req/min</div>
        </div>
        <div class="tier-card">
          <div class="tier-name">Pro</div>
          <div class="tier-amount">10M+</div>
          <div class="tier-limit">50 req/min</div>
        </div>
        <div class="tier-card highlight">
          <div class="tier-name">Elite</div>
          <div class="tier-amount">50M+</div>
          <div class="tier-limit">Unlimited</div>
        </div>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-muted);">
        Stake FIXR tokens to unlock higher rate limits. Or pay $0.01 USDC per call via x402.
      </p>
    </div>

    <!-- Authentication -->
    <div class="section">
      <div class="section-header">
        <h2>Authentication</h2>
        <div class="section-line"></div>
      </div>
      <div class="auth-methods">
        <div class="auth-method">
          <div class="auth-method-title">Wallet Header</div>
          <div class="auth-method-desc">Simple - just pass your wallet address</div>
          <pre>X-Wallet-Address: 0xYourWalletAddress</pre>
        </div>
        <div class="auth-method">
          <div class="auth-method-title">x402 Payment (Base)</div>
          <div class="auth-method-desc">Pay $0.01 USDC per call on Base - no staking required</div>
          <pre>X-Payment-TxHash: 0xTransactionHash</pre>
        </div>
        <div class="auth-method">
          <div class="auth-method-title">x402 Payment (Solana)</div>
          <div class="auth-method-desc">Pay $0.01 USDC per call on Solana - no staking required</div>
          <pre>X-Payment-Chain: solana
X-Payment-TxHash: YourSolanaSignature</pre>
        </div>
      </div>
    </div>

    <!-- x402 Flow -->
    <div class="section">
      <div class="section-header">
        <h2>x402 Pay-Per-Call</h2>
        <div class="section-line"></div>
      </div>
      <p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 1rem;">
        Pay $0.01 USDC on <strong style="color:#fff">Base</strong> or <strong style="color:#fff">Solana</strong> to access premium endpoints. Each transaction is single-use.
      </p>
      <div class="x402-flow">
        <div class="flow-step">
          <div class="flow-num">1</div>
          <div class="flow-text">Request API</div>
        </div>
        <div class="flow-step">
          <div class="flow-num">2</div>
          <div class="flow-text">Get 402</div>
        </div>
        <div class="flow-step">
          <div class="flow-num">3</div>
          <div class="flow-text">Send USDC</div>
        </div>
        <div class="flow-step">
          <div class="flow-num">4</div>
          <div class="flow-text">Retry + TxHash</div>
        </div>
        <div class="flow-step">
          <div class="flow-num">5</div>
          <div class="flow-text">Success</div>
        </div>
      </div>

      <p style="font-size: 0.9rem; color: var(--text-muted); margin: 1.5rem 0 0.75rem; font-weight: 600;">Base (EVM)</p>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>Token</td>
          <td><code class="code-inline">USDC</code> on Base (Chain ID 8453)</td>
        </tr>
        <tr>
          <td>USDC Address</td>
          <td><code class="code-inline">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code></td>
        </tr>
        <tr>
          <td>Recipient</td>
          <td><code class="code-inline">0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4</code></td>
        </tr>
        <tr>
          <td>Amount</td>
          <td><code class="code-inline">10000</code> (0.01 USDC, 6 decimals)</td>
        </tr>
        <tr>
          <td>Header</td>
          <td><code class="code-inline">X-Payment-TxHash: 0x...</code></td>
        </tr>
      </table>

      <p style="font-size: 0.9rem; color: var(--text-muted); margin: 1.5rem 0 0.75rem; font-weight: 600;">Solana</p>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>Token</td>
          <td><code class="code-inline">USDC</code> on Solana (mainnet-beta)</td>
        </tr>
        <tr>
          <td>USDC Mint</td>
          <td><code class="code-inline">EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code></td>
        </tr>
        <tr>
          <td>Recipient</td>
          <td><code class="code-inline">96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU</code></td>
        </tr>
        <tr>
          <td>Amount</td>
          <td><code class="code-inline">10000</code> (0.01 USDC, 6 decimals)</td>
        </tr>
        <tr>
          <td>Headers</td>
          <td><code class="code-inline">X-Payment-Chain: solana</code> + <code class="code-inline">X-Payment-TxHash: &lt;sig&gt;</code></td>
        </tr>
      </table>
    </div>

    <!-- Endpoints -->
    <div class="section">
      <div class="section-header">
        <h2>Endpoints</h2>
        <div class="section-line"></div>
      </div>

      <!-- Token Analysis -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">Token Analysis</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/token/analyze</span>
            <span class="endpoint-desc">Full token analysis</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>POST /api/token/analyze
Content-Type: application/json

{ "address": "0xTokenAddress" }</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "analysis": {
    "token": { "name": "...", "symbol": "...", "totalSupply": "..." },
    "security": { "isHoneypot": false, "riskScore": 25 },
    "liquidity": { "usd": 150000, "locked": true },
    "holders": { "count": 1234, "topHolders": [...] }
  }
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/token/honeypot/:address</span>
            <span class="endpoint-desc">Quick honeypot check</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "isHoneypot": false,
  "reason": null,
  "buyTax": 0,
  "sellTax": 5
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/token/whales/:address</span>
            <span class="endpoint-desc">Top token holders</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "topHolders": [
    { "address": "0x...", "balance": "1000000", "percentage": 10.5 }
  ]
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Builder Feed -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">Builder Feed</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/builders/casts</span>
            <span class="endpoint-desc">Recent builder casts</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Query Params</div>
              <pre>?category=shipped|insight|discussion
&limit=20</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/builders/top</span>
            <span class="endpoint-desc">Top builders by ships</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "builders": [
    { "fid": 123, "username": "builder", "shipCount": 15 }
  ]
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/builders/profile/:id</span>
            <span class="endpoint-desc">Builder profile by FID/username</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "fid": 123,
  "username": "builder",
  "displayName": "Builder Name",
  "ships": [...],
  "stats": { ... }
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Access -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">Access & Stats</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/access/tier?wallet=0x...</span>
            <span class="endpoint-desc">Check your staking tier</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "tier": "BUILDER",
  "stakedAmount": "1500000000000000000000000",
  "rateLimit": "20/min",
  "nextTier": { "tier": "PRO", "required": "10M FIXR" }
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/access/payment</span>
            <span class="endpoint-desc">Get x402 payment info</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "x402": {
    "version": 2,
    "pricePerCall": "$0.01 USDC",
    "chains": {
      "base": { "token": "0x833589...", "recipient": "0xBe2Cc..." },
      "solana": { "mint": "EPjFWdd5...", "recipient": "96vRDB..." }
    },
    "headers": { "payment": "X-Payment-TxHash", "chain": "X-Payment-Chain" }
  }
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- v1 API - Security & Analysis -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">Security & Analysis (v1 API)</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/v1/security/audit</span>
            <span class="endpoint-desc">Smart contract security audit</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>POST /api/v1/security/audit
Content-Type: application/json

{ "address": "0xContractAddress", "network": "base" }</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "audit": {
    "address": "0x...",
    "network": "base",
    "vulnerabilities": [...],
    "riskScore": 25,
    "suggestions": [...]
  }
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/v1/wallet/intel</span>
            <span class="endpoint-desc">Wallet intelligence & risk</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>{ "address": "0xWalletAddress", "network": "base" }</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "wallet": "0x...",
  "intel": {
    "riskScore": 15,
    "deployerHistory": [...],
    "activityAnalysis": {...}
  }
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/v1/rug/detect/:address</span>
            <span class="endpoint-desc">Real-time rug detection</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "token": "0x...",
  "isRug": false,
  "riskLevel": "low",
  "indicators": [...]
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/v1/sentiment/:symbol</span>
            <span class="endpoint-desc">Farcaster sentiment analysis</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "symbol": "DEGEN",
  "sentiment": "bullish",
  "mentions": 156,
  "bankrMentions": {...}
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- v1 API - Reputation -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">Reputation Scores (v1 API)</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/v1/reputation/ethos/:fid</span>
            <span class="endpoint-desc">Ethos reputation score</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "fid": 2574393,
  "ethos": {
    "score": 85,
    "level": "high",
    "factors": [...]
  }
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/v1/reputation/talent/:wallet</span>
            <span class="endpoint-desc">Talent Protocol score</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "wallet": "0x...",
  "passport": {
    "score": 72,
    "credentials": [...]
  },
  "analysis": {...}
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/api/v1/builder/:id</span>
            <span class="endpoint-desc">Full builder profile</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "builder": {
    "fid": 123,
    "username": "builder",
    "ships": [...],
    "reputation": {...}
  }
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- v1 API - AI Generation -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">AI Generation (v1 API)</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/v1/generate/image</span>
            <span class="endpoint-desc">AI image generation</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>{ "prompt": "futuristic city", "style": "cyberpunk" }</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "imageUrl": "https://...",
  "mimeType": "image/png"
}</pre>
            </div>
          </div>
        </div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/v1/generate/video</span>
            <span class="endpoint-desc">AI video generation</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>{
  "prompt": "rocket launching into space",
  "duration": 5,
  "aspectRatio": "16:9"
}</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "taskId": "...",
  "status": "processing"
}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- v1 API - GitHub -->
      <div class="endpoint-group">
        <div class="endpoint-group-title">GitHub Analysis (v1 API)</div>

        <div class="endpoint" onclick="this.classList.toggle('open')">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/api/v1/github/analyze</span>
            <span class="endpoint-desc">Repository analysis</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-section">
              <div class="endpoint-section-title">Request</div>
              <pre>{ "owner": "the-fixr", "repo": "project", "branch": "main" }</pre>
            </div>
            <div class="endpoint-section">
              <div class="endpoint-section-title">Response</div>
              <pre>{
  "success": true,
  "repository": "the-fixr/project",
  "analysis": {
    "summary": "...",
    "issues": [...],
    "suggestions": [...]
  }
}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contracts -->
    <div class="section">
      <div class="section-header">
        <h2>Contracts</h2>
        <div class="section-line"></div>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.75rem; font-weight: 600;">Base (EVM)</p>
      <table>
        <tr>
          <th>Contract</th>
          <th>Address</th>
        </tr>
        <tr>
          <td>FixrStaking</td>
          <td><code class="code-inline">0x39DbBa2CdAF7F668816957B023cbee1841373F5b</code></td>
        </tr>
        <tr>
          <td>FixrFeeSplitter</td>
          <td><code class="code-inline">0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928</code></td>
        </tr>
        <tr>
          <td>Treasury</td>
          <td><code class="code-inline">0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4</code></td>
        </tr>
        <tr>
          <td>USDC</td>
          <td><code class="code-inline">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code></td>
        </tr>
      </table>

      <p style="font-size: 0.9rem; color: var(--text-muted); margin: 1.5rem 0 0.75rem; font-weight: 600;">Solana</p>
      <table>
        <tr>
          <th>Account</th>
          <th>Address</th>
        </tr>
        <tr>
          <td>Treasury</td>
          <td><code class="code-inline">96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU</code></td>
        </tr>
        <tr>
          <td>USDC Mint</td>
          <td><code class="code-inline">EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code></td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Built by <a href="https://fixr.nexus">Fixr</a> · <a href="https://github.com/the-fixr">GitHub</a></p>
    </div>
  </div>
</body>
</html>`;
}
