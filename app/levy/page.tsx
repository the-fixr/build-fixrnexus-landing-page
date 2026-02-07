'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
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
const BG = '#050505';
const CARD_BG = '#0a0a0a';
const BORDER = '#1a1a1a';
const TEXT_DIM = '#666';

type Tab = 'bounties' | 'create' | 'my';

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

  // Create form
  const [poolMint, setPoolMint] = useState('');
  const [depositSol, setDepositSol] = useState('');
  const [rate, setRate] = useState('');
  const [durationHrs, setDurationHrs] = useState('');

  // Collect form
  const [lpBalance, setLpBalance] = useState('');

  // ─── Data fetching ──────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    try {
      const proto = await fetchProtocol(connection);
      setProtocol(proto);
      if (proto) {
        const all = await fetchAllBounties(connection, proto.totalBounties);
        setBounties(all);

        // Fetch user claims for each active bounty
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
      setTxPending(true);
      setTxResult('');
      const mint = new PublicKey(poolMint);
      const deposit = BigInt(Math.round(parseFloat(depositSol) * LAMPORTS_PER_SOL));
      const r = BigInt(rate);
      const dur = BigInt(Math.round(parseFloat(durationHrs) * 3600));

      const ix = buildCreateBountyInstruction(publicKey, protocol.totalBounties, mint, deposit, r, dur);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Bounty created! ${sig.slice(0, 12)}...`);
      setPoolMint(''); setDepositSol(''); setRate(''); setDurationHrs('');
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally {
      setTxPending(false);
    }
  }

  async function handleRegister(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true);
      setTxResult('');
      const ix = buildRegisterClaimInstruction(publicKey, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Registered on bounty #${bounty.id}!`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally {
      setTxPending(false);
    }
  }

  async function handleCollect(bounty: BountyState) {
    if (!publicKey || !protocol) return;
    try {
      setTxPending(true);
      setTxResult('');
      const bal = BigInt(lpBalance || '1');
      const ix = buildCollectInstruction(publicKey, bounty.id, bounty.pda, protocol.treasury, bal);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Collected rewards from bounty #${bounty.id}!`);
      setLpBalance('');
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally {
      setTxPending(false);
    }
  }

  async function handleCancel(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true);
      setTxResult('');
      const ix = buildCancelInstruction(publicKey, bounty.id, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Bounty #${bounty.id} cancelled.`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally {
      setTxPending(false);
    }
  }

  async function handleReclaim(bounty: BountyState) {
    if (!publicKey) return;
    try {
      setTxPending(true);
      setTxResult('');
      const ix = buildReclaimInstruction(publicKey, bounty.id, bounty.pda);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setTxResult(`Reclaimed from bounty #${bounty.id}!`);
      await refreshData();
    } catch (e: any) {
      setTxResult(`Error: ${e.message?.slice(0, 80)}`);
    } finally {
      setTxPending(false);
    }
  }

  // ─── Derived ────────────────────────────────────────────────────────

  const activeBounties = bounties.filter(b => b.status === 'Active');
  const myBounties = publicKey ? bounties.filter(b => b.creator.equals(publicKey)) : [];
  const isCreator = (b: BountyState) => publicKey && b.creator.equals(publicKey);
  const hasClaim = (b: BountyState) => myClaims.has(b.pda.toBase58());

  // ─── Styles ─────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 20,
  };

  const statBox: React.CSSProperties = {
    ...card,
    textAlign: 'center' as const,
    flex: 1,
    minWidth: 140,
  };

  const btn = (active?: boolean, disabled?: boolean): React.CSSProperties => ({
    background: active ? AMBER : 'transparent',
    color: active ? '#000' : AMBER,
    border: `1px solid ${active ? AMBER : AMBER_DIM}`,
    borderRadius: 8,
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.15s',
  });

  const input: React.CSSProperties = {
    background: '#111',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ color: TEXT_DIM, textDecoration: 'none', fontSize: 13 }}>fixr.nexus</Link>
          <span style={{ color: TEXT_DIM }}>/</span>
          <span style={{ color: AMBER, fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>LEVY</span>
          <span style={{ color: TEXT_DIM, fontSize: 11, marginLeft: 4 }}>mercenary liquidity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={`https://solscan.io/account/${LEVY_PROGRAM_ID.toBase58()}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: TEXT_DIM, fontSize: 11, textDecoration: 'none' }}
          >
            program
          </a>
          <WalletMultiButton style={{
            background: 'transparent',
            border: `1px solid ${AMBER_DIM}`,
            borderRadius: 8,
            color: AMBER,
            fontSize: 12,
            height: 36,
            fontFamily: 'inherit',
          }} />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        {/* Protocol Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={statBox}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>BOUNTIES</div>
            <div style={{ color: AMBER, fontSize: 22, fontWeight: 700 }}>
              {protocol ? protocol.totalBounties.toString() : '—'}
            </div>
          </div>
          <div style={statBox}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>TOTAL PAID</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
              {protocol ? lamportsToSol(protocol.totalPaid) : '—'}
              <span style={{ fontSize: 11, color: TEXT_DIM, marginLeft: 4 }}>SOL</span>
            </div>
          </div>
          <div style={statBox}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>PROTOCOL FEE</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
              {protocol ? `${(protocol.feeBps / 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div style={statBox}>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>ACTIVE</div>
            <div style={{ color: '#10b981', fontSize: 22, fontWeight: 700 }}>
              {loading ? '—' : activeBounties.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
          {(['bounties', 'create', 'my'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? AMBER : 'transparent',
                color: tab === t ? '#000' : TEXT_DIM,
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: tab === t ? 700 : 500,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t === 'bounties' ? 'Browse' : t === 'create' ? 'Post Bounty' : 'My Bounties'}
            </button>
          ))}
        </div>

        {/* Tx result banner */}
        {txResult && (
          <div style={{
            ...card,
            marginBottom: 16,
            padding: '10px 16px',
            borderColor: txResult.startsWith('Error') ? '#ef4444' : '#10b981',
            color: txResult.startsWith('Error') ? '#ef4444' : '#10b981',
            fontSize: 12,
          }}>
            {txResult}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', color: TEXT_DIM, padding: 40 }}>Loading protocol data...</div>
        )}

        {/* ─── BROWSE TAB ──────────────────────────────────────────── */}
        {!loading && tab === 'bounties' && (
          <div>
            {activeBounties.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: TEXT_DIM, padding: 40 }}>
                No active bounties. Be the first to post one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBounties.map((b) => {
                  const claimed = hasClaim(b);
                  const claim = myClaims.get(b.pda.toBase58());
                  return (
                    <div key={b.pda.toBase58()} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <span style={{ color: AMBER, fontWeight: 700, fontSize: 15 }}>Bounty #{b.id.toString()}</span>
                          <span style={{ color: TEXT_DIM, fontSize: 11, marginLeft: 8 }}>by {shortAddr(b.creator)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: timeRemaining(b.endTime) === 'Expired' ? '#ef4444' : '#10b981', fontSize: 12, fontWeight: 600 }}>
                            {timeRemaining(b.endTime)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>POOL MINT</div>
                          <div style={{ fontSize: 12 }}>{shortAddr(b.poolMint)}</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>DEPOSITED</div>
                          <div style={{ fontSize: 12 }}>{lamportsToSol(b.totalDeposited)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>REMAINING</div>
                          <div style={{ fontSize: 12, color: AMBER }}>{lamportsToSol(b.remaining)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>RATE</div>
                          <div style={{ fontSize: 12 }}>{b.rate.toString()} lamp/LP/s</div>
                        </div>
                      </div>

                      {/* LP actions */}
                      {connected && !isCreator(b) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                          {!claimed ? (
                            <button onClick={() => handleRegister(b)} disabled={txPending} style={btn(true, txPending)}>
                              Register Claim
                            </button>
                          ) : (
                            <>
                              <input
                                type="number"
                                placeholder="LP balance"
                                value={lpBalance}
                                onChange={e => setLpBalance(e.target.value)}
                                style={{ ...input, width: 140 }}
                              />
                              <button onClick={() => handleCollect(b)} disabled={txPending || !lpBalance} style={btn(true, txPending || !lpBalance)}>
                                Collect
                              </button>
                              {claim && (
                                <span style={{ color: TEXT_DIM, fontSize: 11, marginLeft: 8 }}>
                                  collected: {lamportsToSol(claim.totalCollected)} SOL
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {!connected && (
                        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, color: TEXT_DIM, fontSize: 11 }}>
                          Connect wallet to interact
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── CREATE TAB ──────────────────────────────────────────── */}
        {!loading && tab === 'create' && (
          <div style={card}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Post a Liquidity Bounty</div>
              <div style={{ color: TEXT_DIM, fontSize: 12 }}>Deposit SOL to incentivize LPs on your token pair.</div>
            </div>

            {!connected ? (
              <div style={{ color: TEXT_DIM, fontSize: 12 }}>Connect your wallet to create a bounty.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ color: TEXT_DIM, fontSize: 11, display: 'block', marginBottom: 4 }}>LP TOKEN MINT</label>
                  <input
                    value={poolMint}
                    onChange={e => setPoolMint(e.target.value)}
                    placeholder="Raydium/Orca LP token mint address"
                    style={input}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ color: TEXT_DIM, fontSize: 11, display: 'block', marginBottom: 4 }}>DEPOSIT (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={depositSol}
                      onChange={e => setDepositSol(e.target.value)}
                      placeholder="0.1"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ color: TEXT_DIM, fontSize: 11, display: 'block', marginBottom: 4 }}>RATE (lamports/LP/sec)</label>
                    <input
                      type="number"
                      min="1"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                      placeholder="1"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ color: TEXT_DIM, fontSize: 11, display: 'block', marginBottom: 4 }}>DURATION (hours)</label>
                    <input
                      type="number"
                      min="1"
                      value={durationHrs}
                      onChange={e => setDurationHrs(e.target.value)}
                      placeholder="24"
                      style={input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                  <button
                    onClick={handleCreateBounty}
                    disabled={txPending || !poolMint || !depositSol || !rate || !durationHrs}
                    style={btn(true, txPending || !poolMint || !depositSol || !rate || !durationHrs)}
                  >
                    {txPending ? 'Posting...' : 'Post Bounty'}
                  </button>
                  {depositSol && (
                    <span style={{ color: TEXT_DIM, fontSize: 11 }}>
                      {depositSol} SOL for {durationHrs || '?'}h at {rate || '?'} lamports/LP/sec
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── MY BOUNTIES TAB ─────────────────────────────────────── */}
        {!loading && tab === 'my' && (
          <div>
            {!connected ? (
              <div style={{ ...card, textAlign: 'center', color: TEXT_DIM, padding: 40 }}>
                Connect wallet to view your bounties.
              </div>
            ) : myBounties.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: TEXT_DIM, padding: 40 }}>
                You haven&apos;t created any bounties yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myBounties.map((b) => {
                  const expired = timeRemaining(b.endTime) === 'Expired';
                  return (
                    <div key={b.pda.toBase58()} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ color: AMBER, fontWeight: 700, fontSize: 15 }}>Bounty #{b.id.toString()}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: b.status === 'Active' ? '#10b981' : b.status === 'Cancelled' ? '#ef4444' : TEXT_DIM,
                          textTransform: 'uppercase',
                        }}>
                          {b.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>DEPOSITED</div>
                          <div style={{ fontSize: 12 }}>{lamportsToSol(b.totalDeposited)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>CLAIMED</div>
                          <div style={{ fontSize: 12 }}>{lamportsToSol(b.totalClaimed)} SOL</div>
                        </div>
                        <div>
                          <div style={{ color: TEXT_DIM, fontSize: 10 }}>REMAINING</div>
                          <div style={{ fontSize: 12, color: AMBER }}>{lamportsToSol(b.remaining)} SOL</div>
                        </div>
                      </div>

                      {b.status === 'Active' && (
                        <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                          {expired ? (
                            <button onClick={() => handleReclaim(b)} disabled={txPending} style={btn(true, txPending)}>
                              Reclaim Remaining
                            </button>
                          ) : b.totalClaimed === BigInt(0) ? (
                            <button onClick={() => handleCancel(b)} disabled={txPending} style={btn(false, txPending)}>
                              Cancel Bounty
                            </button>
                          ) : (
                            <span style={{ color: TEXT_DIM, fontSize: 11 }}>
                              Ends {timeRemaining(b.endTime)} &mdash; claims in progress
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>
            Levy Protocol &mdash; Devnet
          </span>
          <span style={{ color: TEXT_DIM, fontSize: 10 }}>
            {LEVY_PROGRAM_ID.toBase58()}
          </span>
        </div>
      </div>
    </div>
  );
}