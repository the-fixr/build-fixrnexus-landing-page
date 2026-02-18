'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import Link from 'next/link';
import {
  LEVY_PROGRAM_ID,
  PROTOCOL_PDA,
  fetchProtocol,
  fetchAllBounties,
  fetchLpClaim,
  buildCreateBountyInstruction,
  buildRegisterClaimInstruction,
  buildCollectInstruction,
  buildCancelInstruction,
  buildReclaimInstruction,
  ProtocolState,
  BountyState,
  LpClaimState,
} from '@/lib/solana/levy';

// ─── Theme ───────────────────────────────────────────────────────────────────

const AMBER = '#f59e0b';
const AMBER_GLOW = 'rgba(245, 158, 11, 0.25)';
const AMBER_DIM = 'rgba(245, 158, 11, 0.6)';
const AMBER_FAINT = 'rgba(245, 158, 11, 0.08)';
const BG = '#050505';
const CARD_BG = '#0a0a0a';
const BORDER = '#1a1a1a';
const BORDER_HOVER = '#2a2a2a';
const TEXT_DIM = '#666';
const TEXT_MID = '#999';

type Tab = 'bounties' | 'create' | 'my' | 'about';

// ─── CSS Keyframes (injected once) ──────────────────────────────────────────

const KEYFRAMES = `
@keyframes levyPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes levyScan { 0% { top: -2px; } 100% { top: 100%; } }
@keyframes levyFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes levyGlow { 0%, 100% { text-shadow: 0 0 8px rgba(245,158,11,0.4); } 50% { text-shadow: 0 0 20px rgba(245,158,11,0.7), 0 0 40px rgba(245,158,11,0.3); } }
@keyframes levyCursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes levySlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes levyTypewriter { from { width: 0; } to { width: 100%; } }
@keyframes levyGridPulse { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.06; } }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lamportsToSol(l: bigint): string {
  return (Number(l) / LAMPORTS_PER_SOL).toFixed(4);
}

function shortAddr(pk: PublicKey): string {
  const s = pk.toBase58();
  return s.slice(0, 4) + '...' + s.slice(-4);
}

function timeRemaining(endTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const end = Number(endTime);
  const diff = end - now;
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  return `${hrs}h ${mins}m`;
}

// ─── Tooltip Component ──────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4, cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', border: `1px solid ${TEXT_DIM}`,
        fontSize: 9, color: TEXT_DIM, lineHeight: 1, fontWeight: 700,
      }}>?</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 8, background: '#111', border: `1px solid ${AMBER_DIM}`,
          borderRadius: 6, padding: '8px 12px', fontSize: 11, color: TEXT_MID,
          whiteSpace: 'nowrap', zIndex: 100, maxWidth: 280,
          boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 8px ${AMBER_GLOW}`,
          lineHeight: 1.5,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── HUD Card Component ─────────────────────────────────────────────────────

function HudCard({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 2,
      padding: 20,
      position: 'relative',
      animation: `levyFadeIn 0.4s ease ${delay}ms both`,
      ...style,
    }}>
      {/* Corner brackets */}
      <span style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: `2px solid ${AMBER_DIM}`, borderLeft: `2px solid ${AMBER_DIM}` }} />
      <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: `2px solid ${AMBER_DIM}`, borderRight: `2px solid ${AMBER_DIM}` }} />
      <span style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: `2px solid ${AMBER_DIM}`, borderLeft: `2px solid ${AMBER_DIM}` }} />
      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: `2px solid ${AMBER_DIM}`, borderRight: `2px solid ${AMBER_DIM}` }} />
      {children}
    </div>
  );
}

// ─── Onboarding Modal ───────────────────────────────────────────────────────

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'LEVY PROTOCOL',
      lines: [
        '> Initializing mercenary liquidity protocol...',
        '',
        'Levy turns mercenary capital from a problem',
        'into an on-chain primitive.',
        '',
        'Projects post SOL bounties.',
        'LPs earn rewards for providing liquidity.',
        'Pure escrow. Pure math. No middlemen.',
      ],
    },
    {
      title: 'FOR PROJECTS',
      lines: [
        '> Loading bounty creation module...',
        '',
        '1. Deposit SOL into an escrow vault',
        '2. Specify the LP token mint (Raydium/Orca)',
        '3. Set a reward rate (lamports/LP-token/sec)',
        '4. Set a duration (how long the bounty runs)',
        '',
        'Your SOL is locked in a PDA vault.',
        'Only claimed rewards leave the vault.',
        'Unclaimed funds return to you after expiry.',
      ],
    },
    {
      title: 'FOR LPs',
      lines: [
        '> Loading claim module...',
        '',
        '1. Browse active bounties',
        '2. Register a claim on any bounty',
        '3. Provide liquidity on the target pool',
        '4. Collect rewards periodically',
        '',
        'reward = lp_balance * rate * elapsed_time',
        '',
        'The more LP tokens you hold, the more you earn.',
        'Collect as often as you want.',
      ],
    },
    {
      title: 'PROTOCOL DETAILS',
      lines: [
        '> Querying protocol parameters...',
        '',
        `Protocol fee: 5% (deducted from payouts)`,
        'Min bounty: 0.01 SOL',
        'Network: Solana (Devnet)',
        '',
        'All escrow is non-custodial.',
        'Program verified on Solscan.',
        'Built by Fixr.',
        '',
        '[ Press ENTER to begin ]',
      ],
    },
  ];

  const current = steps[step];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'levyFadeIn 0.3s ease',
      }}
      onClick={() => { if (step === steps.length - 1) onClose(); }}
    >
      <div
        style={{
          maxWidth: 520, width: '90%', background: '#0a0a0a',
          border: `1px solid ${AMBER_DIM}`, borderRadius: 2, padding: 32,
          boxShadow: `0 0 40px ${AMBER_GLOW}, 0 0 80px rgba(245,158,11,0.1)`,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner brackets */}
        <span style={{ position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTop: `2px solid ${AMBER}`, borderLeft: `2px solid ${AMBER}` }} />
        <span style={{ position: 'absolute', top: -1, right: -1, width: 16, height: 16, borderTop: `2px solid ${AMBER}`, borderRight: `2px solid ${AMBER}` }} />
        <span style={{ position: 'absolute', bottom: -1, left: -1, width: 16, height: 16, borderBottom: `2px solid ${AMBER}`, borderLeft: `2px solid ${AMBER}` }} />
        <span style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottom: `2px solid ${AMBER}`, borderRight: `2px solid ${AMBER}` }} />

        {/* Scanline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${AMBER_GLOW}, transparent)`,
          animation: 'levyScan 3s linear infinite', pointerEvents: 'none',
        }} />

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: 32, height: 3, borderRadius: 1,
              background: i <= step ? AMBER : BORDER,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Title */}
        <div style={{ color: AMBER, fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 16, animation: 'levyGlow 3s ease infinite' }}>
          {current.title}
          <span style={{ animation: 'levyCursor 1s step-end infinite', marginLeft: 2 }}>_</span>
        </div>

        {/* Content */}
        <div style={{ minHeight: 200 }}>
          {current.lines.map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('>') ? AMBER_DIM : line.startsWith('[') ? AMBER : TEXT_MID,
              fontSize: 12, lineHeight: 1.8, fontFamily: 'inherit',
              animation: `levySlideUp 0.3s ease ${i * 40}ms both`,
            }}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            style={{
              background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2,
              color: step === 0 ? TEXT_DIM : AMBER, padding: '6px 16px',
              cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11,
              opacity: step === 0 ? 0.3 : 1,
            }}
          >
            &lt; BACK
          </button>
          <button
            onClick={() => step < steps.length - 1 ? setStep(step + 1) : onClose()}
            style={{
              background: step === steps.length - 1 ? AMBER : 'transparent',
              border: `1px solid ${AMBER}`, borderRadius: 2,
              color: step === steps.length - 1 ? '#000' : AMBER,
              padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700,
            }}
          >
            {step === steps.length - 1 ? 'ENTER LEVY' : 'NEXT >'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LevyPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [tab, setTab] = useState<Tab>('bounties');
  const [protocol, setProtocol] = useState<ProtocolState | null>(null);
  const [bounties, setBounties] = useState<BountyState[]>([]);
  const [myClaims, setMyClaims] = useState<Map<string, LpClaimState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [txResult, setTxResult] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Create form
  const [poolMint, setPoolMint] = useState('');
  const [depositSol, setDepositSol] = useState('');
  const [rate, setRate] = useState('');
  const [durationHrs, setDurationHrs] = useState('');

  // (LP balance now read on-chain from token account — no manual input needed)

  // Show onboarding on first visit
  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem('levy_onboarded');
    if (!seen) setShowOnboarding(true);
  }, []);

  function dismissOnboarding() {
    setShowOnboarding(false);
    localStorage.setItem('levy_onboarded', '1');
  }

  // ─── Data fetching ──────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    try {
      const proto = await fetchProtocol(connection);
      setProtocol(proto);
      if (proto) {
        const all = await fetchAllBounties(connection, proto.totalBounties);
        setBounties(all);
        if (publicKey) {
          const claims = new Map<string, LpClaimState>();
          for (const b of all) {
            if (b.status !== 'Active') continue;
            const claim = await fetchLpClaim(connection, b.pda, publicKey);
            if (claim) claims.set(b.pda.toBase58(), claim);
          }
          setMyClaims(claims);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Levy data:', e);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refreshData();
    const iv = setInterval(refreshData, 30_000);
    return () => clearInterval(iv);
  }, [refreshData]);

  // ─── Actions ────────────────────────────────────────────────────────

  async function handleCreateBounty() {
    if (!publicKey || !protocol) return;
    try {
      setTxPending(true); setTxResult('');
      const mint = new PublicKey(poolMint);
      const deposit = BigInt(Math.round(parseFloat(depositSol) * LAMPORTS_PER_SOL));
      const r = BigInt(rate);
      const dur = BigInt(Math.round(parseFloat(durationHrs) * 3600));
      const ix = buildCreateBountyInstruction(publicKey, protocol.totalBounties, mint, deposit, r, dur);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Bounty created! tx: ${sig.slice(0, 16)}...`);
      setPoolMint(''); setDepositSol(''); setRate(''); setDurationHrs('');
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally { setTxPending(false); }
  }

  async function handleRegister(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true); setTxResult('');
      const ix = buildRegisterClaimInstruction(publicKey, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Registered on bounty #${bounty.id}!`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally { setTxPending(false); }
  }

  async function handleCollect(bounty: BountyState) {
    if (!publicKey || !protocol) return;
    try {
      setTxPending(true); setTxResult('');
      const lpTokenAccount = await getAssociatedTokenAddress(bounty.poolMint, publicKey);
      const ix = buildCollectInstruction(publicKey, bounty.id, bounty.pda, protocol.treasury, lpTokenAccount);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Collected rewards from bounty #${bounty.id}!`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally { setTxPending(false); }
  }

  async function handleCancel(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true); setTxResult('');
      const ix = buildCancelInstruction(publicKey, bounty.id, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Bounty #${bounty.id} cancelled.`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally { setTxPending(false); }
  }

  async function handleReclaim(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true); setTxResult('');
      const ix = buildReclaimInstruction(publicKey, bounty.id, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Reclaimed from bounty #${bounty.id}!`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally { setTxPending(false); }
  }

  // ─── Derived ────────────────────────────────────────────────────────

  const activeBounties = bounties.filter(b => b.status === 'Active');
  const myBounties = publicKey ? bounties.filter(b => b.creator.equals(publicKey)) : [];
  const isCreator = (b: BountyState) => publicKey && b.creator.equals(publicKey);
  const hasClaim = (b: BountyState) => myClaims.has(b.pda.toBase58());

  // ─── Styles ─────────────────────────────────────────────────────────

  const btn = (active?: boolean, disabled?: boolean): React.CSSProperties => ({
    background: active ? AMBER : 'transparent',
    color: active ? '#000' : AMBER,
    border: `1px solid ${active ? AMBER : AMBER_DIM}`,
    borderRadius: 2,
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    transition: 'all 0.15s',
    textTransform: 'uppercase' as const,
  });

  const input: React.CSSProperties = {
    background: '#080808',
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    padding: '10px 12px',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  if (!mounted) return null;

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'var(--font-jetbrains-mono), monospace', position: 'relative', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(${AMBER_FAINT} 1px, transparent 1px), linear-gradient(90deg, ${AMBER_FAINT} 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        animation: 'levyGridPulse 6s ease infinite',
      }} />

      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onClose={dismissOnboarding} />}

      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${BORDER}`, padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 10, background: 'rgba(5,5,5,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ color: TEXT_DIM, textDecoration: 'none', fontSize: 12 }}>fixr.nexus</Link>
          <span style={{ color: BORDER }}>/</span>
          <span style={{
            color: AMBER, fontWeight: 700, fontSize: 20, letterSpacing: 4,
            animation: 'levyGlow 4s ease infinite',
          }}>
            LEVY
          </span>
          <span style={{ color: TEXT_DIM, fontSize: 10, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 1 }}>mercenary liquidity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { setShowOnboarding(true); }}
            style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, color: TEXT_DIM, fontSize: 10, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            HOW IT WORKS
          </button>
          <a
            href={`https://solscan.io/account/${LEVY_PROGRAM_ID.toBase58()}?cluster=devnet`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: TEXT_DIM, fontSize: 10, textDecoration: 'none', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 10px' }}
          >
            PROGRAM
          </a>
          <WalletMultiButton style={{
            background: 'transparent', border: `1px solid ${AMBER_DIM}`, borderRadius: 2,
            color: AMBER, fontSize: 11, height: 32, fontFamily: 'inherit',
          }} />
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

        {/* ─── Hero Stats ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'BOUNTIES POSTED', tip: 'Total number of bounties ever created on Levy', value: protocol ? protocol.totalBounties.toString() : '—', color: AMBER },
            { label: 'TOTAL PAID OUT', tip: 'Cumulative SOL paid to liquidity providers', value: protocol ? lamportsToSol(protocol.totalPaid) : '—', suffix: 'SOL', color: '#fff' },
            { label: 'PROTOCOL FEE', tip: 'Fee deducted from each LP payout. Goes to protocol treasury.', value: protocol ? `${(protocol.feeBps / 100).toFixed(0)}%` : '—', color: '#fff' },
            { label: 'ACTIVE NOW', tip: 'Bounties currently accepting LP claims', value: loading ? '—' : activeBounties.length.toString(), color: '#10b981' },
          ].map((s, i) => (
            <HudCard key={i} delay={i * 80}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
                  {s.label}<Tip text={s.tip} />
                </div>
                <div style={{ color: s.color, fontSize: 24, fontWeight: 700, animation: 'levyPulse 3s ease infinite' }}>
                  {s.value}
                  {s.suffix && <span style={{ fontSize: 10, color: TEXT_DIM, marginLeft: 4 }}>{s.suffix}</span>}
                </div>
              </div>
            </HudCard>
          ))}
        </div>

        {/* ─── Tabs ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
          {([
            { key: 'bounties' as Tab, label: 'BROWSE' },
            { key: 'create' as Tab, label: 'POST BOUNTY' },
            { key: 'my' as Tab, label: 'MY BOUNTIES' },
            { key: 'about' as Tab, label: 'ABOUT' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key ? AMBER : 'transparent',
                color: tab === t.key ? '#000' : TEXT_DIM,
                border: tab === t.key ? `1px solid ${AMBER}` : `1px solid transparent`,
                borderRadius: 2,
                padding: '6px 16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: tab === t.key ? 700 : 500,
                letterSpacing: 1,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tx result */}
        {txResult && (
          <HudCard style={{
            marginBottom: 16, padding: '10px 16px',
            borderColor: txResult.startsWith('Error') ? '#ef4444' : '#10b981',
          }}>
            <span style={{ color: txResult.startsWith('Error') ? '#ef4444' : '#10b981', fontSize: 12 }}>
              {txResult.startsWith('Error') ? '> ERROR: ' : '> '}{txResult}
            </span>
          </HudCard>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', color: AMBER_DIM, padding: 60, fontSize: 12 }}>
            <span style={{ animation: 'levyPulse 1.5s ease infinite' }}>Connecting to Solana...</span>
          </div>
        )}

        {/* ─── BROWSE TAB ──────────────────────────────────────────── */}
        {!loading && tab === 'bounties' && (
          <div style={{ animation: 'levyFadeIn 0.3s ease' }}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: AMBER }}>&#9656;</span> Active bounties paying LPs for liquidity provision
              <Tip text="Each bounty escrows SOL in a PDA vault. LPs register claims and collect rewards proportional to their LP token holdings over time." />
            </div>
            {activeBounties.length === 0 ? (
              <HudCard>
                <div style={{ textAlign: 'center', color: TEXT_DIM, padding: 40 }}>
                  <div style={{ color: AMBER_DIM, fontSize: 13, marginBottom: 8 }}>No active bounties</div>
                  <div style={{ fontSize: 11 }}>Be the first to post one. Switch to the POST BOUNTY tab.</div>
                </div>
              </HudCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBounties.map((b, i) => {
                  const claimed = hasClaim(b);
                  const claim = myClaims.get(b.pda.toBase58());
                  return (
                    <HudCard key={b.pda.toBase58()} delay={i * 60}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>BOUNTY #{b.id.toString()}</span>
                          <span style={{ color: TEXT_DIM, fontSize: 10, marginLeft: 8 }}>by {shortAddr(b.creator)}</span>
                        </div>
                        <div style={{
                          color: timeRemaining(b.endTime) === 'Expired' ? '#ef4444' : '#10b981',
                          fontSize: 11, fontWeight: 700, letterSpacing: 1,
                          padding: '2px 8px', border: `1px solid ${timeRemaining(b.endTime) === 'Expired' ? '#ef444444' : '#10b98144'}`,
                          borderRadius: 2,
                        }}>
                          {timeRemaining(b.endTime)}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 14 }}>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>POOL MINT<Tip text="The LP token mint address identifying the DEX pool" /></div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{shortAddr(b.poolMint)}</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>DEPOSITED<Tip text="Total SOL the project deposited into this bounty" /></div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{lamportsToSol(b.totalDeposited)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>REMAINING<Tip text="SOL still available to be claimed by LPs" /></div>
                          <div style={{ fontSize: 12, marginTop: 4, color: AMBER }}>{lamportsToSol(b.remaining)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>RATE<Tip text="Reward rate in lamports per LP-token per second. Your payout = your_lp_balance * rate * seconds_elapsed" /></div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{b.rate.toString()} <span style={{ color: TEXT_DIM, fontSize: 9 }}>lamp/LP/s</span></div>
                        </div>
                      </div>

                      {connected && !isCreator(b) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                          {!claimed ? (
                            <>
                              <button onClick={() => handleRegister(b)} disabled={txPending} style={btn(true, txPending)}>
                                Register Claim
                              </button>
                              <span style={{ color: TEXT_DIM, fontSize: 10 }}>
                                <Tip text="Register your wallet as a claimant on this bounty. You only need to do this once per bounty." />
                              </span>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleCollect(b)} disabled={txPending} style={btn(true, txPending)}>
                                Collect Rewards
                              </button>
                              <Tip text="Your LP token balance is verified on-chain. Reward = balance * rate * time_since_last_collect" />
                              {claim && (
                                <span style={{ color: TEXT_MID, fontSize: 10, marginLeft: 8 }}>
                                  total collected: <span style={{ color: AMBER }}>{lamportsToSol(claim.totalCollected)} SOL</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {!connected && (
                        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, color: TEXT_DIM, fontSize: 10 }}>
                          <span style={{ color: AMBER_DIM }}>&#9656;</span> Connect wallet to register claims and collect rewards
                        </div>
                      )}
                    </HudCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── CREATE TAB ──────────────────────────────────────────── */}
        {!loading && tab === 'create' && (
          <div style={{ animation: 'levyFadeIn 0.3s ease' }}>
            <HudCard>
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: AMBER, fontWeight: 700, fontSize: 14, marginBottom: 6, letterSpacing: 1 }}>
                  POST A LIQUIDITY BOUNTY
                </div>
                <div style={{ color: TEXT_DIM, fontSize: 11, lineHeight: 1.6 }}>
                  Deposit SOL into an escrow vault to incentivize LPs on your token pair.
                  Your funds are locked in a non-custodial PDA. Only claimed rewards leave the vault.
                  After expiry, you reclaim any unclaimed balance.
                </div>
              </div>

              {!connected ? (
                <div style={{ color: TEXT_DIM, fontSize: 12, padding: 20, textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: 2 }}>
                  <span style={{ color: AMBER_DIM }}>&#9656;</span> Connect your Solana wallet to create a bounty
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ color: TEXT_DIM, fontSize: 10, display: 'block', marginBottom: 6, letterSpacing: 1 }}>
                      LP TOKEN MINT <Tip text="The mint address of the LP token for your pool. Find this on Raydium, Orca, or Meteora." />
                    </label>
                    <input value={poolMint} onChange={e => setPoolMint(e.target.value)} placeholder="e.g. 7Ri8MfWx...." style={input} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ color: TEXT_DIM, fontSize: 10, display: 'block', marginBottom: 6, letterSpacing: 1 }}>
                        DEPOSIT <Tip text="How much SOL to escrow. Min 0.01 SOL. This is the total reward budget." />
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type="number" step="0.01" min="0.01" value={depositSol} onChange={e => setDepositSol(e.target.value)} placeholder="0.1" style={input} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: TEXT_DIM, fontSize: 10 }}>SOL</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ color: TEXT_DIM, fontSize: 10, display: 'block', marginBottom: 6, letterSpacing: 1 }}>
                        RATE <Tip text="Lamports paid per LP-token per second. Higher rate = more attractive bounty. E.g., rate=1 means 1 lamport/LP/sec." />
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type="number" min="1" value={rate} onChange={e => setRate(e.target.value)} placeholder="1" style={input} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: TEXT_DIM, fontSize: 9 }}>lamp/LP/s</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ color: TEXT_DIM, fontSize: 10, display: 'block', marginBottom: 6, letterSpacing: 1 }}>
                        DURATION <Tip text="How long the bounty runs in hours. After this, remaining funds can be reclaimed." />
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type="number" min="1" value={durationHrs} onChange={e => setDurationHrs(e.target.value)} placeholder="24" style={input} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: TEXT_DIM, fontSize: 10 }}>hrs</span>
                      </div>
                    </div>
                  </div>

                  {/* Cost preview */}
                  {depositSol && rate && durationHrs && (
                    <div style={{ background: '#080808', border: `1px solid ${BORDER}`, borderRadius: 2, padding: 14 }}>
                      <div style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>BOUNTY PREVIEW</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div><span style={{ color: TEXT_DIM }}>Budget:</span> <span style={{ color: AMBER }}>{depositSol} SOL</span></div>
                        <div><span style={{ color: TEXT_DIM }}>Duration:</span> {durationHrs}h</div>
                        <div><span style={{ color: TEXT_DIM }}>Rate:</span> {rate} lamp/LP/s</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                    <button
                      onClick={handleCreateBounty}
                      disabled={txPending || !poolMint || !depositSol || !rate || !durationHrs}
                      style={btn(true, txPending || !poolMint || !depositSol || !rate || !durationHrs)}
                    >
                      {txPending ? '> POSTING...' : '> POST BOUNTY'}
                    </button>
                  </div>
                </div>
              )}
            </HudCard>
          </div>
        )}

        {/* ─── MY BOUNTIES TAB ─────────────────────────────────────── */}
        {!loading && tab === 'my' && (
          <div style={{ animation: 'levyFadeIn 0.3s ease' }}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: AMBER }}>&#9656;</span> Bounties you created
              <Tip text="Manage your posted bounties. Cancel before any claims, or reclaim remaining funds after expiry." />
            </div>
            {!connected ? (
              <HudCard><div style={{ textAlign: 'center', color: TEXT_DIM, padding: 40, fontSize: 12 }}>Connect wallet to view your bounties.</div></HudCard>
            ) : myBounties.length === 0 ? (
              <HudCard><div style={{ textAlign: 'center', color: TEXT_DIM, padding: 40, fontSize: 12 }}>You haven&apos;t created any bounties yet.</div></HudCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myBounties.map((b, i) => {
                  const expired = timeRemaining(b.endTime) === 'Expired';
                  return (
                    <HudCard key={b.pda.toBase58()} delay={i * 60}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>BOUNTY #{b.id.toString()}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 1,
                          color: b.status === 'Active' ? '#10b981' : b.status === 'Cancelled' ? '#ef4444' : TEXT_DIM,
                          padding: '2px 8px', border: `1px solid ${b.status === 'Active' ? '#10b98144' : b.status === 'Cancelled' ? '#ef444444' : BORDER}`,
                          borderRadius: 2, textTransform: 'uppercase',
                        }}>
                          {b.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 14 }}>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>DEPOSITED</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{lamportsToSol(b.totalDeposited)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>CLAIMED BY LPs</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{lamportsToSol(b.totalClaimed)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1 }}>REMAINING</div>
                          <div style={{ fontSize: 12, marginTop: 4, color: AMBER }}>{lamportsToSol(b.remaining)} SOL</div>
                        </div>
                      </div>

                      {b.status === 'Active' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                          {expired ? (
                            <>
                              <button onClick={() => handleReclaim(b)} disabled={txPending} style={btn(true, txPending)}>RECLAIM</button>
                              <Tip text="Bounty has expired. Reclaim any unclaimed SOL back to your wallet." />
                            </>
                          ) : b.totalClaimed === BigInt(0) ? (
                            <>
                              <button onClick={() => handleCancel(b)} disabled={txPending} style={btn(false, txPending)}>CANCEL</button>
                              <Tip text="Cancel this bounty and get your full deposit back. Only works if no LP has claimed yet." />
                            </>
                          ) : (
                            <span style={{ color: TEXT_DIM, fontSize: 10 }}>
                              <span style={{ color: AMBER_DIM }}>&#9656;</span> Ends {timeRemaining(b.endTime)} &mdash; claims in progress, reclaim available after expiry
                            </span>
                          )}
                        </div>
                      )}
                    </HudCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── ABOUT TAB ───────────────────────────────────────────── */}
        {!loading && tab === 'about' && (
          <div style={{ animation: 'levyFadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HudCard>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: 14, letterSpacing: 1, marginBottom: 16 }}>WHAT IS LEVY?</div>
              <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 2 }}>
                <p>Mercenary liquidity is DeFi&apos;s open secret. Capital flows to the highest yield, loyalty is rare, and protocols bleed incentives trying to retain LPs who will leave the moment a better farm appears.</p>
                <p style={{ marginTop: 12 }}>Levy doesn&apos;t fight this. Levy makes it a feature.</p>
                <p style={{ marginTop: 12 }}>Projects post SOL bounties specifying an LP token, a reward rate, and a duration. LPs register claims and collect rewards proportional to their holdings over time. When the bounty expires, unclaimed funds return to the project. Pure escrow. Pure math.</p>
                <p style={{ marginTop: 12 }}>No governance tokens. No vote-locking. No emissions schedules. Just a transparent marketplace where liquidity has an honest price.</p>
              </div>
            </HudCard>

            <HudCard delay={100}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: 14, letterSpacing: 1, marginBottom: 16 }}>HOW IT WORKS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ color: AMBER_DIM, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>FOR PROJECTS</div>
                  <div style={{ color: TEXT_MID, fontSize: 11, lineHeight: 1.8 }}>
                    1. Deposit SOL into escrow<br/>
                    2. Specify LP token mint + rate + duration<br/>
                    3. SOL locked in non-custodial PDA vault<br/>
                    4. LPs claim rewards as they provide liquidity<br/>
                    5. Reclaim unclaimed funds after expiry
                  </div>
                </div>
                <div>
                  <div style={{ color: AMBER_DIM, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>FOR LPs</div>
                  <div style={{ color: TEXT_MID, fontSize: 11, lineHeight: 1.8 }}>
                    1. Browse active bounties<br/>
                    2. Register a claim (one-time)<br/>
                    3. Provide liquidity on the target pool<br/>
                    4. Collect rewards: balance &times; rate &times; time<br/>
                    5. Collect as often as you want
                  </div>
                </div>
              </div>
            </HudCard>

            <HudCard delay={200}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: 14, letterSpacing: 1, marginBottom: 16 }}>PROTOCOL PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 11 }}>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>PROTOCOL FEE</div>
                  <div style={{ color: '#fff' }}>5% <span style={{ color: TEXT_DIM }}>(max 10%)</span></div>
                </div>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>MIN BOUNTY</div>
                  <div style={{ color: '#fff' }}>0.01 SOL</div>
                </div>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>NETWORK</div>
                  <div style={{ color: '#fff' }}>Solana <span style={{ color: AMBER_DIM }}>(Devnet)</span></div>
                </div>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>ESCROW TYPE</div>
                  <div style={{ color: '#fff' }}>Non-custodial PDA vaults</div>
                </div>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>FRAMEWORK</div>
                  <div style={{ color: '#fff' }}>Anchor 0.29</div>
                </div>
                <div>
                  <div style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>REWARD FORMULA</div>
                  <div style={{ color: '#fff' }}>lp_bal &times; rate &times; dt</div>
                </div>
              </div>
            </HudCard>

            <HudCard delay={300}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: 14, letterSpacing: 1, marginBottom: 16 }}>BUILT BY FIXR</div>
              <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 2 }}>
                <p>Levy was designed and deployed by <span style={{ color: AMBER }}>Fixr</span>, an autonomous builder agent, after analyzing the liquidity infrastructure landscape on Solana.</p>
                <p style={{ marginTop: 12 }}>The problem: early-stage tokens need liquidity but can&apos;t compete with established farm yields. The existing solutions (vote-escrow, bribe markets, emissions) add complexity and governance overhead.</p>
                <p style={{ marginTop: 12 }}>Levy strips it down to the primitive: SOL in, liquidity out, time-bounded, non-custodial. Six instructions. Three account types. No token required.</p>
              </div>
            </HudCard>
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/levy/terms" style={{ color: TEXT_DIM, fontSize: 10, textDecoration: 'none' }}>Terms of Use</Link>
              <Link href="/levy/privacy" style={{ color: TEXT_DIM, fontSize: 10, textDecoration: 'none' }}>Privacy Policy</Link>
              <Link href="/levy/disclaimer" style={{ color: TEXT_DIM, fontSize: 10, textDecoration: 'none' }}>Disclaimer</Link>
            </div>
            <span style={{ color: TEXT_DIM, fontSize: 9 }}>
              {LEVY_PROGRAM_ID.toBase58()}
            </span>
          </div>
          <div style={{ color: '#333', fontSize: 9, textAlign: 'center' }}>
            Levy Protocol &mdash; Devnet &mdash; Built by Fixr
          </div>
        </div>
      </div>
    </div>
  );
}
