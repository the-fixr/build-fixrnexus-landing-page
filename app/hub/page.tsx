'use client';

import { useState, useEffect, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, maxUint256 } from 'viem';
import { base } from 'wagmi/chains';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { NATIVE_MINT, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import {
  CLAWG_STAKING_PROGRAM_ID,
  CLAWG_MINT,
  STATE_PDA,
  CLAWG_VAULT,
  WSOL_VAULT,
  LOCK_TIERS,
  fetchStakingState,
  fetchUserAccount,
  buildStakeInstruction,
  buildUnstakeInstruction,
  buildClaimRewardsInstruction,
  getUserPDA,
  StakingState,
  UserStakingAccount,
} from '@/lib/solana/clawg-staking';

const ACCENT = '#8b5cf6';
const ACCENT_GLOW = 'rgba(139, 92, 246, 0.3)';
const GREEN = '#10b981';
const SOLANA_GREEN = '#14F195';

type Chain = 'base' | 'solana';

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
  logoUrl?: string;
  active: boolean;
}

const BASE_TOKENS: TokenConfig[] = [
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
    logoUrl: '/clawg-logo.png',
    active: true,
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
    description: 'FIXR autonomous builder agent',
    decimals: 18,
    stakersShare: 70,
    treasuryShare: 30,
    active: false,
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
  const [activeChain, setActiveChain] = useState<Chain>('base');
  const [activeToken, setActiveToken] = useState<string>('clawg');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);

  // Base/EVM hooks
  const { address, isConnected } = useAccount();
  const currentToken = BASE_TOKENS.find(t => t.id === activeToken) || BASE_TOKENS[0];

  const { data: tokenBalance } = useBalance({
    address,
    token: currentToken.token,
    chainId: base.id,
    query: { enabled: activeChain === 'base' },
  });

  const { data: totalStaked } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'totalStakedAmount',
    chainId: base.id,
    query: { enabled: activeChain === 'base' },
  });

  const { data: totalWeighted } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'totalWeightedStake',
    chainId: base.id,
    query: { enabled: activeChain === 'base' },
  });

  const { data: userPositions } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'getPositions',
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: !!address && activeChain === 'base' },
  });

  const { data: pendingWeth } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'pendingRewards',
    args: address ? [address, WETH] : undefined,
    chainId: base.id,
    query: { enabled: !!address && activeChain === 'base' },
  });

  const { data: pendingToken } = useReadContract({
    address: currentToken.staking,
    abi: STAKING_ABI,
    functionName: 'pendingRewards',
    args: address ? [address, currentToken.token] : undefined,
    chainId: base.id,
    query: { enabled: !!address && activeChain === 'base' },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: currentToken.token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, currentToken.staking] : undefined,
    chainId: base.id,
    query: { enabled: !!address && activeChain === 'base' },
  });

  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { writeContract: stake, data: stakeHash } = useWriteContract();
  const { writeContract: unstake, data: unstakeHash } = useWriteContract();
  const { writeContract: claim, data: claimHash } = useWriteContract();

  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isStaking } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isLoading: isUnstaking } = useWaitForTransactionReceipt({ hash: unstakeHash });
  const { isLoading: isClaiming } = useWaitForTransactionReceipt({ hash: claimHash });

  // Solana hooks
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected: solanaConnected } = useWallet();

  const [solanaState, setSolanaState] = useState<StakingState | null>(null);
  const [solanaUserAccount, setSolanaUserAccount] = useState<UserStakingAccount | null>(null);
  const [solanaBalance, setSolanaBalance] = useState<bigint>(BigInt(0));
  const [solanaDecimals, setSolanaDecimals] = useState<number>(6);
  const [solanaLoading, setSolanaLoading] = useState(false);

  // Fetch Solana data
  useEffect(() => {
    if (activeChain !== 'solana') return;

    const fetchSolanaData = async () => {
      // Fetch balance independently so it works even if staking program isn't initialized
      if (publicKey) {
        try {
          // Use getParsedTokenAccountsByOwner - more robust than ATA lookup
          const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: CLAWG_MINT,
          });
          let total = BigInt(0);
          for (const { account } of accounts.value) {
            const parsed = account.data.parsed?.info?.tokenAmount;
            if (parsed?.amount) total += BigInt(parsed.amount);
            if (parsed?.decimals !== undefined) setSolanaDecimals(parsed.decimals);
          }
          setSolanaBalance(total);
        } catch (err) {
          console.error('Error fetching CLAWG balance:', err);
          setSolanaBalance(BigInt(0));
        }
      }

      // Fetch staking state separately
      try {
        const state = await fetchStakingState(connection);
        setSolanaState(state);

        if (publicKey) {
          const userAccount = await fetchUserAccount(connection, publicKey);
          setSolanaUserAccount(userAccount);
        }
      } catch (err) {
        console.error('Error fetching Solana staking data:', err);
      }
    };

    fetchSolanaData();
    const interval = setInterval(fetchSolanaData, 30000);
    return () => clearInterval(interval);
  }, [activeChain, connection, publicKey]);

  useEffect(() => {
    document.title = 'Fixr Token Hub';
  }, []);

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  const formatNumber = (num: bigint | undefined, decimals = 18) => {
    if (!num) return '0';
    const formatted = parseFloat(formatUnits(num, decimals));
    if (formatted >= 1_000_000_000) return (formatted / 1_000_000_000).toFixed(2) + 'B';
    if (formatted >= 1_000_000) return (formatted / 1_000_000).toFixed(2) + 'M';
    if (formatted >= 1_000) return (formatted / 1_000).toFixed(2) + 'K';
    return formatted.toFixed(2);
  };

  const formatSol = (lamports: bigint | undefined) => {
    if (!lamports) return '0';
    const sol = Number(lamports) / LAMPORTS_PER_SOL;
    if (sol < 0.0001 && sol > 0) return '<0.0001';
    return sol.toFixed(4);
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

  // Base handlers
  const handleApprove = () => {
    if (!stakeAmount) return;
    approve({
      address: currentToken.token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [currentToken.staking, maxUint256],
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

  // Solana handlers
  const handleSolanaStake = async () => {
    if (!publicKey || !stakeAmount) return;

    setSolanaLoading(true);
    try {
      const amount = BigInt(Math.floor(parseFloat(stakeAmount) * Math.pow(10, solanaDecimals)));
      const ix = await buildStakeInstruction(publicKey, amount, selectedTier);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
      setStakeAmount('');
    } catch (err) {
      console.error('Stake error:', err);
    }
    setSolanaLoading(false);
  };

  const handleSolanaClaim = async () => {
    if (!publicKey) return;

    setSolanaLoading(true);
    try {
      const tx = new Transaction();

      // Ensure user has WSOL ATA (needed for SOL rewards)
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, publicKey);
      const wsolAccount = await connection.getAccountInfo(wsolAta);
      if (!wsolAccount) {
        tx.add(createAssociatedTokenAccountInstruction(
          publicKey, wsolAta, publicKey, NATIVE_MINT
        ));
      }

      const ix = await buildClaimRewardsInstruction(publicKey);
      tx.add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
    } catch (err) {
      console.error('Claim error:', err);
    }
    setSolanaLoading(false);
  };

  const handleSolanaUnstake = async (positionId: number) => {
    if (!publicKey) return;

    setSolanaLoading(true);
    try {
      const ix = await buildUnstakeInstruction(publicKey, positionId);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig);
    } catch (err) {
      console.error('Unstake error:', err);
    }
    setSolanaLoading(false);
  };

  const needsApproval = activeChain === 'base' && stakeAmount && allowance !== undefined &&
    parseUnits(stakeAmount || '0', currentToken.decimals) > (allowance || BigInt(0));

  const basePositions = (userPositions as any[] || []).filter((p: any) => p.amount > BigInt(0));
  const solanaPositions = solanaUserAccount?.positions.filter(p => p.isActive) || [];

  const totalPendingWeth = pendingWeth || BigInt(0);
  const totalPendingToken = pendingToken || BigInt(0);

  // Calculate actual pending rewards (on-chain stored values only update on interaction)
  const REWARD_PRECISION = BigInt(1_000_000_000_000); // 1e12, matches program
  const solanaPendingClawg = useMemo(() => {
    if (!solanaState || !solanaUserAccount) return BigInt(0);
    const stored = solanaUserAccount.pendingRewards[0] || BigInt(0);
    const globalRpt = solanaState.rewardPerTokenStored[0] || BigInt(0);
    const userPaid = solanaUserAccount.rewardPerTokenPaid[0] || BigInt(0);
    const weight = solanaUserAccount.totalWeightedStake;
    if (globalRpt <= userPaid) return stored;
    return stored + (weight * (globalRpt - userPaid)) / REWARD_PRECISION;
  }, [solanaState, solanaUserAccount]);

  const solanaPendingWsol = useMemo(() => {
    if (!solanaState || !solanaUserAccount) return BigInt(0);
    const stored = solanaUserAccount.pendingRewards[1] || BigInt(0);
    const globalRpt = solanaState.rewardPerTokenStored[1] || BigInt(0);
    const userPaid = solanaUserAccount.rewardPerTokenPaid[1] || BigInt(0);
    const weight = solanaUserAccount.totalWeightedStake;
    if (globalRpt <= userPaid) return stored;
    return stored + (weight * (globalRpt - userPaid)) / REWARD_PRECISION;
  }, [solanaState, solanaUserAccount]);

  const feeDistributionData = [
    { name: `Stakers (70%)`, value: 70, color: ACCENT },
    { name: `Treasury (30%)`, value: 30, color: '#6366f1' },
  ];

  const tiers = activeChain === 'base' ? currentToken.tiers : LOCK_TIERS;
  const isWalletConnected = activeChain === 'base' ? isConnected : solanaConnected;

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
            {activeChain === 'base' ? (
              <ConnectButton showBalance={false} />
            ) : (
              <WalletMultiButton style={{ background: SOLANA_GREEN, color: '#000', borderRadius: '6px', fontFamily: 'inherit', fontSize: '0.9rem' }} />
            )}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        {/* Chain Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveChain('base')}
            style={{
              padding: '0.75rem 2rem',
              border: `2px solid ${activeChain === 'base' ? '#0052FF' : '#1a1a1a'}`,
              background: activeChain === 'base' ? 'rgba(0, 82, 255, 0.15)' : 'transparent',
              color: activeChain === 'base' ? '#fff' : '#666',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 111 111" fill="none"><circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF"/><path d="M54.921 82c-14.912 0-27-12.088-27-27s12.088-27 27-27c13.012 0 23.904 9.237 26.44 21.5H96c-2.704-20.68-20.502-36.5-42.079-36.5-23.472 0-42.5 19.028-42.5 42.5s19.028 42.5 42.5 42.5c21.577 0 39.375-15.82 42.079-36.5H81.36c-2.536 12.263-13.428 21.5-26.44 21.5z" fill="#fff"/></svg>
            Base
          </button>
          <button
            onClick={() => setActiveChain('solana')}
            style={{
              padding: '0.75rem 2rem',
              border: `2px solid ${activeChain === 'solana' ? SOLANA_GREEN : '#1a1a1a'}`,
              background: activeChain === 'solana' ? 'rgba(20, 241, 149, 0.15)' : 'transparent',
              color: activeChain === 'solana' ? '#fff' : '#666',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 397 311" fill="none"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill={SOLANA_GREEN}/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill={SOLANA_GREEN}/><path d="M332.4 120.6c-2.4-2.4-5.7-3.8-9.2-3.8H5.8c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill={SOLANA_GREEN}/></svg>
            Solana
          </button>
        </div>

        {/* Token Tabs (Base only for now) */}
        {activeChain === 'base' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
            {BASE_TOKENS.map((token) => (
              <button
                key={token.id}
                onClick={() => token.active && setActiveToken(token.id)}
                disabled={!token.active}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: `2px solid ${!token.active ? '#222' : activeToken === token.id ? ACCENT : '#1a1a1a'}`,
                  background: activeToken === token.id ? ACCENT_GLOW : 'transparent',
                  color: !token.active ? '#333' : activeToken === token.id ? '#fff' : '#666',
                  fontWeight: 600,
                  cursor: token.active ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  borderRadius: '6px',
                  opacity: token.active ? 1 : 0.5,
                  position: 'relative',
                }}
              >
                {token.symbol}
                {!token.active && <span style={{ fontSize: '0.6rem', display: 'block', color: '#444' }}>SOON</span>}
              </button>
            ))}
          </div>
        )}

        {/* Token Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <img
              src={activeChain === 'solana' ? '/dexlogo.png' : '/clawg-logo.png'}
              alt="CLAWG"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                boxShadow: `0 0 20px ${activeChain === 'solana' ? 'rgba(20, 241, 149, 0.3)' : ACCENT_GLOW}`,
              }}
            />
            <h2 style={{ fontSize: '3rem', fontWeight: 700, margin: 0 }}>
              $CLAWG
            </h2>
            <span style={{
              padding: '0.25rem 0.75rem',
              background: activeChain === 'solana' ? 'rgba(20, 241, 149, 0.2)' : 'rgba(0, 82, 255, 0.2)',
              color: activeChain === 'solana' ? SOLANA_GREEN : '#0052FF',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}>
              {activeChain === 'solana' ? 'SOLANA' : 'BASE'}
            </span>
          </div>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            Powering clawg.network infrastructure. Stake to earn 70% of trading fees.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {activeChain === 'base' ? (
            <>
              <StatCard label="TOTAL STAKED" value={formatNumber(totalStaked)} accent />
              <StatCard label="WEIGHTED STAKE" value={formatNumber(totalWeighted)} />
              <StatCard label="YOUR BALANCE" value={tokenBalance ? formatNumber(tokenBalance.value) : '0'} />
              <StatCard label="PENDING WETH" value={formatEth(totalPendingWeth)} accent />
              <StatCard label="PENDING CLAWG" value={formatNumber(totalPendingToken)} accent />
            </>
          ) : (
            <>
              <StatCard label="TOTAL STAKED" value={formatNumber(solanaState?.totalStakedAmount, solanaDecimals)} accent solana />
              <StatCard label="WEIGHTED STAKE" value={formatNumber(solanaState?.totalWeightedStake, solanaDecimals)} solana />
              <StatCard label="YOUR BALANCE" value={formatNumber(solanaBalance, solanaDecimals)} solana />
              <StatCard label="PENDING WSOL" value={formatSol(solanaPendingWsol)} accent solana />
              <StatCard label="PENDING CLAWG" value={formatNumber(solanaPendingClawg, solanaDecimals)} accent solana />
            </>
          )}
        </div>

        {/* User Positions */}
        {isWalletConnected && ((activeChain === 'base' && basePositions.length > 0) || (activeChain === 'solana' && (solanaPositions.length > 0 || solanaPendingClawg > BigInt(0) || solanaPendingWsol > BigInt(0)))) && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Positions</h3>
              <button
                onClick={activeChain === 'base' ? handleClaim : handleSolanaClaim}
                disabled={isClaiming || solanaLoading}
                style={{
                  padding: '0.5rem 1rem',
                  border: `1px solid ${activeChain === 'solana' ? SOLANA_GREEN : ACCENT}`,
                  background: 'transparent',
                  color: activeChain === 'solana' ? SOLANA_GREEN : ACCENT,
                  cursor: (isClaiming || solanaLoading) ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  borderRadius: '6px',
                }}
              >
                {(isClaiming || solanaLoading) ? 'CLAIMING...' : 'CLAIM REWARDS'}
              </button>
            </div>
            {activeChain === 'base' ? (
              basePositions.map((pos: any, i: number) => (
                <PositionRow
                  key={i}
                  amount={pos.amount}
                  tier={currentToken.tiers[Number(pos.lockTier)]?.name || 'Unknown'}
                  unlockAt={pos.unlockAt}
                  onUnstake={() => handleUnstake(i)}
                  isLoading={isUnstaking}
                  decimals={18}
                  chain="base"
                />
              ))
            ) : (
              solanaPositions.map((pos, i: number) => (
                <PositionRow
                  key={i}
                  amount={pos.amount}
                  tier={LOCK_TIERS[pos.lockTier]?.name || 'Unknown'}
                  unlockAt={pos.unlockAt}
                  onUnstake={() => handleSolanaUnstake(i)}
                  isLoading={solanaLoading}
                  decimals={solanaDecimals}
                  chain="solana"
                />
              ))
            )}
          </div>
        )}

        {/* Stake and Fee Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
              Stake $CLAWG
            </h3>

            {!isWalletConnected ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#666', marginBottom: '1rem' }}>Connect wallet to stake</p>
                {activeChain === 'base' ? (
                  <ConnectButton />
                ) : (
                  <WalletMultiButton style={{ background: SOLANA_GREEN, color: '#000', borderRadius: '6px', fontFamily: 'inherit' }} />
                )}
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
                      onClick={() => {
                        if (activeChain === 'base' && tokenBalance) {
                          setStakeAmount(formatUnits(tokenBalance.value, currentToken.decimals));
                        } else if (activeChain === 'solana') {
                          setStakeAmount((Number(solanaBalance) / Math.pow(10, solanaDecimals)).toString());
                        }
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#1a1a1a', border: 'none', color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}
                    >
                      MAX
                    </button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#444', marginTop: '0.25rem' }}>
                    Balance: {activeChain === 'base'
                      ? (tokenBalance ? formatUnits(tokenBalance.value, currentToken.decimals) : '0')
                      : (Number(solanaBalance) / Math.pow(10, solanaDecimals)).toFixed(2)
                    }
                  </p>
                </div>

                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.5rem' }}>LOCK PERIOD</label>
                  <button
                    onClick={() => setTierDropdownOpen(!tierDropdownOpen)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #1a1a1a', borderRadius: '6px', background: 'transparent', color: '#fff', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span>{tiers[selectedTier]?.name}</span>
                    <span style={{ color: activeChain === 'solana' ? SOLANA_GREEN : ACCENT }}>{tiers[selectedTier]?.multiplier}</span>
                  </button>
                  {tierDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '6px', marginTop: '0.25rem', zIndex: 10 }}>
                      {tiers.map((tier, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedTier(i); setTierDropdownOpen(false); }}
                          style={{ width: '100%', padding: '0.75rem', border: 'none', background: selectedTier === i ? '#1a1a1a' : 'transparent', color: '#fff', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <span>{tier.name}</span>
                          <span style={{ color: activeChain === 'solana' ? SOLANA_GREEN : ACCENT }}>{tier.multiplier}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem', background: '#111', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#666' }}>Weighted stake</span>
                    <span style={{ color: activeChain === 'solana' ? SOLANA_GREEN : ACCENT }}>
                      {((parseFloat(stakeAmount) || 0) * parseFloat(tiers[selectedTier]?.multiplier || '1')).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={activeChain === 'base' ? (needsApproval ? handleApprove : handleStake) : handleSolanaStake}
                  disabled={!stakeAmount || parseFloat(stakeAmount) === 0 || isApproving || isStaking || solanaLoading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: `2px solid ${activeChain === 'solana' ? SOLANA_GREEN : ACCENT}`,
                    background: activeChain === 'solana' ? SOLANA_GREEN : ACCENT,
                    color: activeChain === 'solana' ? '#000' : '#fff',
                    fontWeight: 600,
                    cursor: (!stakeAmount || isApproving || isStaking || solanaLoading) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    borderRadius: '6px',
                    opacity: (!stakeAmount || parseFloat(stakeAmount) === 0) ? 0.5 : 1,
                  }}
                >
                  {isApproving ? 'APPROVING...' : isStaking || solanaLoading ? 'STAKING...' : needsApproval ? 'APPROVE' : 'STAKE $CLAWG'}
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

        {/* Lock Tiers */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Lock Tiers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiers.length}, 1fr)`, gap: '0.75rem' }}>
            {tiers.map((tier, i) => (
              <button
                key={i}
                onClick={() => setSelectedTier(i)}
                style={{
                  padding: '1rem',
                  border: `2px solid ${selectedTier === i ? (activeChain === 'solana' ? SOLANA_GREEN : ACCENT) : '#1a1a1a'}`,
                  background: selectedTier === i ? (activeChain === 'solana' ? 'rgba(20, 241, 149, 0.15)' : ACCENT_GLOW) : 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.25rem' }}>{tier.name.toUpperCase()}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: selectedTier === i ? (activeChain === 'solana' ? SOLANA_GREEN : ACCENT) : '#fff' }}>{tier.multiplier}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Contracts */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Contracts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {activeChain === 'base' ? (
              <>
                <ContractLink name="Token" address={currentToken.token} explorer="basescan" />
                <ContractLink name="Staking" address={currentToken.staking} explorer="basescan" />
                <ContractLink name="Fee Splitter" address={currentToken.feeSplitter} explorer="basescan" />
              </>
            ) : (
              <>
                <ContractLink name="Token" address={CLAWG_MINT.toBase58()} explorer="solscan" />
                <ContractLink name="Staking" address={CLAWG_STAKING_PROGRAM_ID.toBase58()} explorer="solscan" />
                <ContractLink name="State" address={STATE_PDA.toBase58()} explorer="solscan" />
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a' }}>
          <p style={{ fontSize: '0.8rem', color: '#444' }}>
            Built by <a href="https://fixr.nexus" style={{ color: ACCENT, textDecoration: 'none' }}>Fixr</a> · Live on {activeChain === 'base' ? 'Base' : 'Solana'}
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = false, solana = false }: { label: string; value: string; accent?: boolean; solana?: boolean }) {
  const accentColor = solana ? SOLANA_GREEN : ACCENT;
  return (
    <div style={{
      background: '#0a0a0a',
      border: `1px solid ${accent ? accentColor : '#1a1a1a'}`,
      borderRadius: '8px',
      padding: '1.25rem',
    }}>
      <p style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: accent ? accentColor : '#fff' }}>{value}</p>
    </div>
  );
}

function PositionRow({
  amount,
  tier,
  unlockAt,
  onUnstake,
  isLoading,
  decimals,
  chain,
}: {
  amount: bigint;
  tier: string;
  unlockAt: bigint;
  onUnstake: () => void;
  isLoading: boolean;
  decimals: number;
  chain: Chain;
}) {
  const now = Date.now();
  const unlock = Number(unlockAt) * 1000;
  const isUnlocked = now >= unlock;

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

  const formatAmount = (num: bigint) => {
    const formatted = Number(num) / Math.pow(10, decimals);
    if (formatted >= 1_000_000) return (formatted / 1_000_000).toFixed(2) + 'M';
    if (formatted >= 1_000) return (formatted / 1_000).toFixed(2) + 'K';
    return formatted.toFixed(2);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #1a1a1a', borderRadius: '8px', marginBottom: '0.5rem' }}>
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{formatAmount(amount)} CLAWG</p>
        <p style={{ fontSize: '0.75rem', color: '#666' }}>{tier} lock</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: '#666' }}>Time Left</p>
          <p style={{ fontWeight: 600, color: isUnlocked ? GREEN : '#fff' }}>
            {formatTimeRemaining(unlockAt)}
          </p>
        </div>
        <button
          onClick={onUnstake}
          disabled={isLoading || !isUnlocked}
          style={{
            padding: '0.5rem 1rem',
            border: `1px solid ${isUnlocked ? GREEN : '#333'}`,
            background: 'transparent',
            color: isUnlocked ? GREEN : '#666',
            cursor: isUnlocked ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            borderRadius: '6px',
            fontSize: '0.8rem',
          }}
        >
          {isLoading ? '...' : 'UNSTAKE'}
        </button>
      </div>
    </div>
  );
}

function ContractLink({ name, address, explorer }: { name: string; address: string; explorer: 'basescan' | 'solscan' }) {
  const url = explorer === 'basescan'
    ? `https://basescan.org/address/${address}`
    : `https://solscan.io/account/${address}`;

  return (
    <a
      href={url}
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