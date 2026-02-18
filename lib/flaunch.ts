import { createFlaunch } from '@flaunch/sdk';
import { createPublicClient, http, type WalletClient, formatEther } from 'viem';
import { base } from 'viem/chains';

// Cast through `any` — Flaunch SDK bundles its own viem types which
// may diverge from the project's viem version (Base chain deposit tx type).
const publicClient = createPublicClient({ chain: base, transport: http() });

export function getFlaunchRead() {
  return createFlaunch({ publicClient: publicClient as any });
}

export function getFlaunchWrite(walletClient: WalletClient) {
  return createFlaunch({ publicClient: publicClient as any, walletClient: walletClient as any });
}

export interface LaunchParams {
  name: string;
  symbol: string;
  description: string;
  base64Image: string;
  fairLaunchPercent: number;
  fairLaunchDuration: number; // seconds
  initialMarketCapUSD: number;
  creator: `0x${string}`;
  creatorFeeAllocationPercent: number;
  websiteUrl?: string;
  twitterUrl?: string;
  discordUrl?: string;
  telegramUrl?: string;
}

export interface LaunchedToken {
  address: string;
  tokenId: string;
  name: string;
  symbol: string;
  txHash: string;
  launchedAt: number;
  description: string;
  fairLaunchPercent: number;
  fairLaunchDuration: number;
  initialMarketCapUSD: number;
  creatorFeePercent: number;
}

export async function launchToken(
  walletClient: WalletClient,
  params: LaunchParams,
): Promise<{ txHash: string; memecoin: string; tokenId: string }> {
  const flaunch = getFlaunchWrite(walletClient);
  const txHash = await flaunch.flaunchIPFS({
    name: params.name,
    symbol: params.symbol,
    metadata: {
      base64Image: params.base64Image,
      description: params.description,
      websiteUrl: params.websiteUrl,
      twitterUrl: params.twitterUrl,
      discordUrl: params.discordUrl,
      telegramUrl: params.telegramUrl,
    },
    fairLaunchPercent: params.fairLaunchPercent,
    fairLaunchDuration: params.fairLaunchDuration,
    initialMarketCapUSD: params.initialMarketCapUSD,
    creator: params.creator,
    creatorFeeAllocationPercent: params.creatorFeeAllocationPercent,
  });

  const flaunchRead = getFlaunchRead();
  const poolInfo = await flaunchRead.getPoolCreatedFromTx(txHash);

  return {
    txHash,
    memecoin: poolInfo.memecoin,
    tokenId: String(poolInfo.tokenId),
  };
}

export async function getTokenStats(coinAddress: `0x${string}`) {
  const f = getFlaunchRead();
  const [priceETH, priceUSD, marketCap, metadata, fairLaunchActive, fairLaunchDetails, bidWall] =
    await Promise.all([
      f.coinPriceInETH(coinAddress).catch(() => null),
      f.coinPriceInUSD({ coinAddress }).catch(() => null),
      f.coinMarketCapInUSD({ coinAddress }).catch(() => null),
      f.getCoinMetadata(coinAddress).catch(() => null),
      f.isFairLaunchActive(coinAddress).catch(() => null),
      f.fairLaunchInfo(coinAddress).catch(() => null),
      f.bidWallPosition(coinAddress).catch(() => null),
    ]);
  return { priceETH, priceUSD, marketCap, metadata, fairLaunchActive, fairLaunchDetails, bidWall };
}

export async function getCreatorRevenue(creatorAddress: `0x${string}`): Promise<bigint | null> {
  const f = getFlaunchRead();
  return f.creatorRevenue(creatorAddress).catch(() => null);
}

export async function getCreatorRevenueFormatted(creatorAddress: `0x${string}`): Promise<string> {
  const rev = await getCreatorRevenue(creatorAddress);
  return rev != null ? formatEther(rev) : '0';
}

export async function withdrawRevenue(
  walletClient: WalletClient,
  recipient: `0x${string}`,
): Promise<string> {
  const f = getFlaunchWrite(walletClient);
  return f.withdrawCreatorRevenue({ recipient });
}
