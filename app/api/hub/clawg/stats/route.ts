import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const CONTRACTS = {
  token: '0x06A127f0b53F83dD5d94E83D96B55a279705bB07',
  staking: '0xD8eDe592Ed90A9D56aebE321B1d2a4E3201b4c11',
  feeSplitter: '0x0eA046F39EBC7316B418bfcf0962590927B8ecB4',
  weth: '0x4200000000000000000000000000000000000006',
};

const STAKING_ABI = [
  'function totalWeightedStake() view returns (uint256)',
  'function totalStakedAmount() view returns (uint256)',
  'function clawgToken() view returns (address)',
  'function getRewardTokens() view returns (address[])',
  'function rewardPerTokenStored(address) view returns (uint256)',
  'function getAllTiers() view returns (tuple(uint256 duration, uint256 multiplier)[])',
  'function getPositions(address) view returns (tuple(uint256 amount, uint256 weightedAmount, uint256 lockTier, uint256 stakedAt, uint256 unlockAt)[])',
  'function pendingRewards(address user, address rewardToken) view returns (uint256)',
  'function userWeightedStake(address) view returns (uint256)',
  'function expectedRewardBalance(address) view returns (uint256)',
  'function getUnsyncedFees(address) view returns (uint256)',
  'function earliestClaimTime(address) view returns (uint256)',
  'function CLAIM_DELAY() view returns (uint256)',
];

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

const FEE_SPLITTER_ABI = [
  'function stakingContract() view returns (address)',
  'function treasury() view returns (address)',
  'function getFeeTokens() view returns (address[])',
  'function pendingFees(address) view returns (uint256)',
  'function STAKERS_BPS() view returns (uint256)',
  'function TREASURY_BPS() view returns (uint256)',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('user');

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

    const stakingContract = new ethers.Contract(CONTRACTS.staking, STAKING_ABI, provider);
    const tokenContract = new ethers.Contract(CONTRACTS.token, TOKEN_ABI, provider);
    const wethContract = new ethers.Contract(CONTRACTS.weth, TOKEN_ABI, provider);
    const feeSplitterContract = new ethers.Contract(CONTRACTS.feeSplitter, FEE_SPLITTER_ABI, provider);

    const [
      totalWeightedStake,
      totalStakedAmount,
      totalSupply,
      decimals,
      symbol,
      name,
      stakingWethBalance,
      stakingClawgBalance,
      feeSplitterWethBalance,
      feeSplitterClawgBalance,
      allTiers,
      stakersBps,
      treasuryBps,
      unsyncedWeth,
      unsyncedClawg,
    ] = await Promise.all([
      stakingContract.totalWeightedStake(),
      stakingContract.totalStakedAmount(),
      tokenContract.totalSupply(),
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name(),
      wethContract.balanceOf(CONTRACTS.staking),
      tokenContract.balanceOf(CONTRACTS.staking),
      wethContract.balanceOf(CONTRACTS.feeSplitter),
      tokenContract.balanceOf(CONTRACTS.feeSplitter),
      stakingContract.getAllTiers(),
      feeSplitterContract.STAKERS_BPS(),
      feeSplitterContract.TREASURY_BPS(),
      stakingContract.getUnsyncedFees(CONTRACTS.weth).catch(() => BigInt(0)),
      stakingContract.getUnsyncedFees(CONTRACTS.token).catch(() => BigInt(0)),
    ]);

    const dec = Number(decimals);
    const totalStaked = Number(ethers.formatUnits(totalStakedAmount, dec));
    const totalWeighted = Number(ethers.formatUnits(totalWeightedStake, dec));
    const supply = Number(ethers.formatUnits(totalSupply, dec));

    const tierNames = ['1 Day', '7 Days', '30 Days', '60 Days', '90 Days', '180 Days', '365 Days'];
    const tierMultipliers = ['0.5x', '1.0x', '1.15x', '1.35x', '1.5x', '2.0x', '3.0x'];

    const tiers = allTiers.map((tier: { duration: bigint; multiplier: bigint }, i: number) => ({
      index: i,
      name: tierNames[i] || `Tier ${i}`,
      duration: Number(tier.duration),
      multiplier: Number(tier.multiplier) / 10000,
      multiplierDisplay: tierMultipliers[i] || `${Number(tier.multiplier) / 10000}x`,
    }));

    let userData = null;
    if (userAddress && ethers.isAddress(userAddress)) {
      try {
        const [
          userPositions,
          userWeighted,
          pendingWeth,
          pendingClawg,
          earliestClaim,
          claimDelay,
          userTokenBalance,
        ] = await Promise.all([
          stakingContract.getPositions(userAddress),
          stakingContract.userWeightedStake(userAddress),
          stakingContract.pendingRewards(userAddress, CONTRACTS.weth),
          stakingContract.pendingRewards(userAddress, CONTRACTS.token),
          stakingContract.earliestClaimTime(userAddress),
          stakingContract.CLAIM_DELAY(),
          tokenContract.balanceOf(userAddress),
        ]);

        const positions = userPositions.map((pos: {
          amount: bigint;
          weightedAmount: bigint;
          lockTier: bigint;
          stakedAt: bigint;
          unlockAt: bigint;
        }, i: number) => ({
          id: i,
          amount: Number(ethers.formatUnits(pos.amount, dec)),
          weightedAmount: Number(ethers.formatUnits(pos.weightedAmount, dec)),
          lockTier: Number(pos.lockTier),
          tierName: tierNames[Number(pos.lockTier)] || `Tier ${pos.lockTier}`,
          stakedAt: Number(pos.stakedAt) * 1000,
          unlockAt: Number(pos.unlockAt) * 1000,
          isUnlocked: Date.now() >= Number(pos.unlockAt) * 1000,
        })).filter((p: { amount: number }) => p.amount > 0);

        userData = {
          address: userAddress,
          positions,
          totalStaked: positions.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
          weightedStake: Number(ethers.formatUnits(userWeighted, dec)),
          pendingRewards: {
            weth: Number(ethers.formatEther(pendingWeth)),
            clawg: Number(ethers.formatUnits(pendingClawg, dec)),
          },
          earliestClaimTime: Number(earliestClaim) * 1000,
          canClaim: Date.now() >= Number(earliestClaim) * 1000,
          claimDelaySeconds: Number(claimDelay),
          tokenBalance: Number(ethers.formatUnits(userTokenBalance, dec)),
        };
      } catch (e) {
        console.error('User data fetch error:', e);
      }
    }

    return NextResponse.json({
      token: {
        address: CONTRACTS.token,
        name: String(name),
        symbol: String(symbol),
        totalSupply: supply,
        decimals: dec,
      },
      staking: {
        address: CONTRACTS.staking,
        totalStaked,
        totalWeightedStake: totalWeighted,
        tiers,
        rewardTokens: [CONTRACTS.weth, CONTRACTS.token],
        pendingFees: {
          weth: Number(ethers.formatEther(unsyncedWeth)),
          clawg: Number(ethers.formatUnits(unsyncedClawg, dec)),
        },
        accumulatedRewards: {
          weth: Number(ethers.formatEther(stakingWethBalance)),
          clawg: Number(ethers.formatUnits(stakingClawgBalance, dec)) - totalStaked,
        },
      },
      feeSplitter: {
        address: CONTRACTS.feeSplitter,
        pending: {
          weth: Number(ethers.formatEther(feeSplitterWethBalance)),
          clawg: Number(ethers.formatUnits(feeSplitterClawgBalance, dec)),
        },
        stakersShareBps: Number(stakersBps),
        treasuryShareBps: Number(treasuryBps),
      },
      user: userData,
      contracts: CONTRACTS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('CLAWG stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: String(error) },
      { status: 500 }
    );
  }
}
