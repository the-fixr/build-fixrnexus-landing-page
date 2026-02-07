import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Contract addresses
const CONTRACTS = {
  feeSplitter: '0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928',
  staking: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
  token: '0x8cBb89d67fDA00E26aEd0Fc02718821049b41610',
  weth: '0x4200000000000000000000000000000000000006',
};

// ABIs (minimal)
const STAKING_ABI = [
  'function totalWeightedStake() view returns (uint256)',
  'function fixrToken() view returns (address)',
  'function getRewardTokens() view returns (address[])',
  'function rewardPerTokenStored(address) view returns (uint256)',
];

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const FEE_SPLITTER_ABI = [
  'function stakingContract() view returns (address)',
  'function treasury() view returns (address)',
  'function getWhitelistedTokens() view returns (address[])',
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

    const stakingContract = new ethers.Contract(CONTRACTS.staking, STAKING_ABI, provider);
    const tokenContract = new ethers.Contract(CONTRACTS.token, TOKEN_ABI, provider);
    const wethContract = new ethers.Contract(CONTRACTS.weth, TOKEN_ABI, provider);
    const feeSplitterContract = new ethers.Contract(CONTRACTS.feeSplitter, FEE_SPLITTER_ABI, provider);

    // Fetch data in parallel
    const [
      totalWeightedStake,
      totalSupply,
      decimals,
      stakingWethBalance,
      feeSplitterWethBalance,
      rewardTokens,
    ] = await Promise.all([
      stakingContract.totalWeightedStake(),
      tokenContract.totalSupply(),
      tokenContract.decimals(),
      wethContract.balanceOf(CONTRACTS.staking),
      wethContract.balanceOf(CONTRACTS.feeSplitter),
      stakingContract.getRewardTokens(),
    ]);

    // Format values
    const totalStaked = Number(ethers.formatUnits(totalWeightedStake, decimals));
    const supply = Number(ethers.formatUnits(totalSupply, decimals));
    const pendingFees = Number(ethers.formatEther(feeSplitterWethBalance));
    const distributedToStaking = Number(ethers.formatEther(stakingWethBalance));

    // Calculate tier distribution (would need to iterate positions in production)
    const tierDistribution = [
      { name: '7 Days', multiplier: '1.0x', staked: totalStaked, percentage: 100 },
      { name: '30 Days', multiplier: '1.25x', staked: 0, percentage: 0 },
      { name: '90 Days', multiplier: '1.5x', staked: 0, percentage: 0 },
      { name: '180 Days', multiplier: '2.0x', staked: 0, percentage: 0 },
    ];

    return NextResponse.json({
      token: {
        address: CONTRACTS.token,
        totalSupply: supply,
        decimals: Number(decimals),
      },
      staking: {
        address: CONTRACTS.staking,
        totalStaked,
        totalWeightedStake: totalStaked,
        stakersCount: 1, // Would need event indexing for accurate count
        rewardTokens: rewardTokens.map((t: string) => t),
        tierDistribution,
      },
      fees: {
        splitterAddress: CONTRACTS.feeSplitter,
        pendingDistribution: pendingFees,
        totalDistributedToStakers: distributedToStaking,
        stakersShareBps: 7000,
        treasuryShareBps: 3000,
      },
      contracts: CONTRACTS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Hub stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: String(error) },
      { status: 500 }
    );
  }
}
