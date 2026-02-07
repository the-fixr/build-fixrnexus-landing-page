'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { base } from 'wagmi/chains';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const ACCENT = '#8b5cf6';
const ACCENT_GLOW = 'rgba(139, 92, 246, 0.3)';
const GREEN = '#10b981';

interface TokenConfig {
  id: string;
  name: string;
  symbol: string;
  token: `0x${string}`;
  staking: `0x${string}`;
  feeSplitter: `0x${string}`;
  description: string;
  decimals: number;
  tiers: { name: string; multiplier: string; duration: number; index: number }[];
  stakersShare: number;
  treasuryShare: number;
}

const TOKENS: TokenConfig[] = [
  {
    id: 'clawg',
    name: 'CLAWG',
    symbol: '$CLAWG',
    token: '0x06A127f0b53F83dD5d94E83D96B55a279705bB07',
    staking: '0xD8eDe592Ed90A9D56aebE321B1d2a4E3201b4c11',
    feeSplitter: '0x0eA046F39EBC7316B418bfcf0962590927B8ecB4',
    description: 'Powering clawg.network infrastructure',
    decimals: 18,
    stakersShare: 70,
    treasuryShare: 30,
    tiers: [
      { name: '1 Day', multiplier: '0.5x', duration: 86400, index: 0 },
      { name: '7 Days', multiplier: '1.0x', duration: 604800, index: 1 },
      { name: '30 Days', multiplier: '1.15x', duration: 2592000, index: 2 },
      { name: '60 Days', multiplier: '1.35x', duration: 5184000, index: 3 },
      { name: '90 Days', multiplier: '1.5x', duration: 7776000, index: 4 },
      { name: '180 Days', multiplier: '2.0x', duration: 15552000, index: 5 },
      { name: '365 Days', multiplier: '3.0x', duration: 31536000, index: 6 },
    ],
  },
  {
    id: 'fixr',
    name: 'FIXR',
    symbol: '$FIXR',
    token: '0x8cBb89d67fDA00E26aEd0Fc02718821049b41610',
    staking: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
    feeSplitter: '0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928',
    description: 'FEEDS oracle network governance',
    decimals: 18,
    stakersShare: 70,
    treasuryShare: 30,
    tiers: [
      { name: '7 Days', multiplier: '1.0x', duration: 604800, index: 0 },
      { name: '30 Days', multiplier: '1.25x', duration: 2592000, index: 1 },
      { name: '90 Days', multiplier: '1.5x', duration: 7776000, index: 2 },
      { name: '180 Days', multiplier: '2.0x', duration: 15552000, index: 3 },
    ],
  },
];

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const STAKING_ABI = [
  { name: 'totalStakedAmount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalWeightedStake', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'userWeightedStake', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getPositions', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'tuple[]', components: [{ name: 'amount', type: 'uint256' }, { name: 'weightedAmount', type: 'uint256' }, { name: 'lockTier', type: 'uint256' }, { name: 'stakedAt', type: 'uint256' }, { name: 'unlockAt', type: 'uint256' }] }] },
  { name: 'pendingRewards', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'rewardToken', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'tierIndex', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'claimRewards', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

const WETH = '0x4200000000000000000000000000000000000006' as const;

export default function HubPage() {
  const [activeToken, setActiveToken] = useState<string>('clawg');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);

  const { address, isConnected } = useAccount();
  const currentToken = TOKENS.find(t => t.id === activeToken) || TOKENS[0];

  const { data: tokenBalance } = useBalance({
    address,
    token: currentToken.token,
    chainId: base.id,
  });

  const { data: totalStaked } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'totalStakedAmount',
    chainId: base.id,
  });

  const { data: totalWeighted } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'totalWeightedStake',
    chainId: base.id,
  });

  const { data: userPositions } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'getPositions',
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { data: pendingWeth } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'pendingRewards',
    args: address ? [address, WETH] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { data: pendingToken } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'pendingRewards',
    args: address ? [address, currentToken.token] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { data: allowance } = useReadContract({
    address: currentToken.token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, currentToken.staking] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { writeContract: stake, data: stakeHash } = useWriteContract();
  const { writeContract: unstake, data: unstakeHash } = useWriteContract();
  const { writeContract: claim, data: claimHash } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isStaking } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isLoading: isUnstaking } = useWaitForTransactionReceipt({ hash: unstakeHash });
  const { isLoading: isClaiming } = useWaitForTransactionReceipt({ hash: claimHash });

  const formatNumber = (num: bigint | undefined, decimals = 18) => {
    if (!num) return '0';
    const formatted = parseFloat(formatUnits(num, decimals));
    if (formatted >= 1_000_000_000) return (formatted / 1_000_000_000).toFixed(2) + 'B';
    if (formatted >= 1_000_000) return (formatted / 1_000_000).toFixed(2) + 'M';
    if (formatted >= 1_000) return (formatted / 1_000).toFixed(2) + 'K';
    return formatted.toFixed(2);
  };

  const formatEth = (num: bigint | undefined) => {
    if (!num) return '0';
    const formatted = parseFloat(formatUnits(num, 18));
    if (formatted < 0.0001 && formatted > 0) return '<0.0001';
    return formatted.toFixed(4);
  };

  const formatTimeRemaining = (unlockAt: bigint) => {
    const now = Date.now();
    const unlock = Number(unlockAt) * 1000;
    if (now >= unlock) return 'Unlocked';
    const diff = unlock - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleApprove = () => {
    if (!stakeAmount) return;
    approve({
      address: currentToken.token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [currentToken.staking, parseUnits(stakeAmount, currentToken.decimals)],
      chainId: base.id,
    });
  };

  const handleStake = () => {
    if (!stakeAmount) return;
    stake({
      address: currentToken.staking,
      abi: STAKING_ABI,
      functionName: 'stake',
      args: [parseUnits(stakeAmount, currentToken.decimals), BigInt(selectedTier)],
      chainId: base.id,
    });
  };

  const handleUnstake = (positionId: number) => {
    unstake({
      address: currentToken.staking,
      abi: STAKING_ABI,
      functionName: 'unstake',
      args: [BigInt(positionId)],
      chainId: base.id,
    });
  };

  const handleClaim = () => {
    claim({
      address: currentToken.staking,
      abi: STAKING_ABI,
      functionName: 'claimRewards',
      chainId: base.id,
    });
  };

  const needsApproval = stakeAmount && allowance !== undefined &&
    parseUnits(stakeAmount || '0', currentToken.decimals) > (allowance || BigInt(0));

  const positions = (userPositions as any[] || []).filter((p: any) => p.amount > BigInt(0));
  const totalPendingWeth = pendingWeth || BigInt(0);
  const totalPendingToken = pendingToken || BigInt(0);

  const feeDistributionData = [
    { name: `Stakers (${currentToken.stakersShare}%)`, value: currentToken.stakersShare, color: ACCENT },
    { name: `Treasury (${currentToken.treasuryShare}%)`, value: currentToken.treasuryShare, color: '#6366f1' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
      <nav style={{ borderBottom: '1px solid #1a1a1a', background: '#050505' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/fixrpfp.png" alt="Fixr" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>TOKEN HUB</h1>
              <p style={{ fontSize: '0.7rem', color: '#666', margin: 0 }}>STAKE & EARN</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <a href="https://fixr.nexus" style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>HOME</a>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          {TOKENS.map((token) => (
            <button
              key={token.id}
              onClick={() => setActiveToken(token.id)}
              style={{
                padding: '0.75rem 1.5rem',
                border: `2px solid ${activeToken === token.id ? ACCENT : '#1a1a1a'}`,
                background: activeToken === token.id ? ACCENT_GLOW : 'transparent',
                color: activeToken === token.id ? '#fff' : '#666',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: '6px',
              }}
            >
              {token.symbol}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {currentToken.symbol}.<span style={{ color: ACCENT }}>NEXUS</span>
          </h2>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            {currentToken.description}. Stake to earn {currentToken.stakersShare}% of trading fees.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard label="TOTAL STAKED" value={formatNumber(totalStaked)} accent />
          <StatCard label="WEIGHTED STAKE" value={formatNumber(totalWeighted)} />
          <StatCard label="YOUR BALANCE" value={tokenBalance ? formatNumber(tokenBalance.value) : '0'} />
          <StatCard label="PENDING WETH" value={formatEth(totalPendingWeth)} accent />
        </div>

        {isConnected && positions.length > 0 && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Positions</h3>
              <button
                onClick={handleClaim}
                disabled={isClaiming || (totalPendingWeth === BigInt(0) && totalPendingToken === BigInt(0))}
                style={{
                  padding: '0.5rem 1rem',
                  border: `1px solid ${ACCENT}`,
                  background: 'transparent',
                  color: ACCENT,
                  cursor: isClaiming ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  borderRadius: '6px',
                  opacity: (totalPendingWeth === BigInt(0) && totalPendingToken === BigInt(0)) ? 0.5 : 1,
                }}
              >
                {isClaiming ? 'CLAIMING...' : `CLAIM ${formatEth(totalPendingWeth)} WETH`}
              </button>
            </div>
            {positions.map((pos: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #1a1a1a', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{formatNumber(pos.amount)} {currentToken.symbol.replace('$', '')}</p>
                  <p style={{ fontSize: '0.75rem', color: '#666' }}>{currentToken.tiers[Number(pos.lockTier)]?.name || 'Unknown'} lock</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>Time Left</p>
                    <p style={{ fontWeight: 600, color: Date.now() >= Number(pos.unlockAt) * 1000 ? GREEN : '#fff' }}>
                      {formatTimeRemaining(pos.unlockAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnstake(i)}
                    disabled={isUnstaking || Date.now() < Number(pos.unlockAt) * 1000}
                    style={{
                      padding: '0.5rem 1rem',
                      border: `1px solid ${Date.now() >= Number(pos.unlockAt) * 1000 ? GREEN : '#333'}`,
                      background: 'transparent',
                      color: Date.now() >= Number(pos.unlockAt) * 1000 ? GREEN : '#666',
                      cursor: Date.now() >= Number(pos.unlockAt) * 1000 ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                    }}
                  >
                    {isUnstaking ? '...' : 'UNSTAKE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
              Stake {currentToken.symbol}
            </h3>

            {!isConnected ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#666', marginBottom: '1rem' }}>Connect wallet to stake</p>
                <ConnectButton />
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.5rem' }}>AMOUNT</label>
                  <div style={{ display: 'flex', border: '1px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                    <input
                      type="text"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', color: '#fff', fontFamily: 'inherit', fontSize: '1rem', outline: 'none' }}
                    />
                    <button
                      onClick={() => tokenBalance && setStakeAmount(formatUnits(tokenBalance.value, currentToken.decimals))}
                      style={{ padding: '0.5rem 1rem', background: '#1a1a1a', border: 'none', color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}
                    >
                      MAX
                    </button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#444', marginTop: '0.25rem' }}>
                    Balance: {tokenBalance ? formatUnits(tokenBalance.value, currentToken.decimals) : '0'}
                  </p>
                </div>

                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.5rem' }}>LOCK PERIOD</label>
                  <button
                    onClick={() => setTierDropdownOpen(!tierDropdownOpen)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #1a1a1a', borderRadius: '6px', background: 'transparent', color: '#fff', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span>{currentToken.tiers[selectedTier]?.name}</span>
                    <span style={{ color: ACCENT }}>{currentToken.tiers[selectedTier]?.multiplier}</span>
                  </button>
                  {tierDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '6px', marginTop: '0.25rem', zIndex: 10 }}>
                      {currentToken.tiers.map((tier, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedTier(i); setTierDropdownOpen(false); }}
                          style={{ width: '100%', padding: '0.75rem', border: 'none', background: selectedTier === i ? '#1a1a1a' : 'transparent', color: '#fff', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <span>{tier.name}</span>
                          <span style={{ color: ACCENT }}>{tier.multiplier}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem', background: '#111', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#666' }}>Weighted stake</span>
                    <span style={{ color: ACCENT }}>
                      {((parseFloat(stakeAmount) || 0) * parseFloat(currentToken.tiers[selectedTier]?.multiplier || '1')).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={needsApproval ? handleApprove : handleStake}
                  disabled={!stakeAmount || parseFloat(stakeAmount) === 0 || isApproving || isStaking}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: `2px solid ${ACCENT}`,
                    background: ACCENT,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (!stakeAmount || isApproving || isStaking) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    borderRadius: '6px',
                    opacity: (!stakeAmount || parseFloat(stakeAmount) === 0) ? 0.5 : 1,
                  }}
                >
                  {isApproving ? 'APPROVING...' : isStaking ? 'STAKING...' : needsApproval ? 'APPROVE' : `STAKE ${currentToken.symbol}`}
                </button>
              </div>
            )}
          </div>

          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Fee Distribution</h3>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={feeDistributionData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {feeDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '6px', fontFamily: 'monospace' }} />
                  <Legend formatter={(value) => <span style={{ color: '#666', fontSize: '0.8rem' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Lock Tiers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${currentToken.tiers.length}, 1fr)`, gap: '0.75rem' }}>
            {currentToken.tiers.map((tier, i) => (
              <button
                key={i}
                onClick={() => setSelectedTier(i)}
                style={{
                  padding: '1rem',
                  border: `2px solid ${selectedTier === i ? ACCENT : '#1a1a1a'}`,
                  background: selectedTier === i ? ACCENT_GLOW : 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.25rem' }}>{tier.name.toUpperCase()}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: selectedTier === i ? ACCENT : '#fff' }}>{tier.multiplier}</p>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Contracts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <ContractLink name="Token" address={currentToken.token} />
            <ContractLink name="Staking" address={currentToken.staking} />
            <ContractLink name="Fee Splitter" address={currentToken.feeSplitter} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a' }}>
          <p style={{ fontSize: '0.8rem', color: '#444' }}>
            Built by <a href="https://fixr.nexus" style={{ color: ACCENT, textDecoration: 'none' }}>Fixr</a> · Live on Base
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: '#0a0a0a',
      border: `1px solid ${accent ? ACCENT : '#1a1a1a'}`,
      borderRadius: '8px',
      padding: '1.25rem',
    }}>
      <p style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: accent ? ACCENT : '#fff' }}>{value}</p>
    </div>
  );
}

function ContractLink({ name, address }: { name: string; address: string }) {
  return (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        border: '1px solid #1a1a1a',
        borderRadius: '8px',
        textDecoration: 'none',
        color: '#fff',
      }}
    >
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{name}</p>
        <p style={{ fontSize: '0.7rem', color: '#666' }}>{address.slice(0, 6)}...{address.slice(-4)}</p>
      </div>
      <span style={{ color: '#666' }}>→</span>
    </a>
  );
}
