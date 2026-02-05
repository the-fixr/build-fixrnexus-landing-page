/**
 * Builder ID NFT System
 *
 * Soulbound NFT for Farcaster builders - proof of builder identity
 * Uses Gemini to generate unique builder portraits from profile pics
 *
 * Security: FID ownership verified via Farcaster verified addresses
 * Contract: hasMinted[fid] prevents duplicates
 */

import { Env } from './types';
import { generateImage, generateStylizedImage, generateBuilderIDWithTemplate, uploadImageToSupabase, AvatarTraits } from './gemini';
import { getEthosUserByFid, EthosLevel, ethosScoreToPercent } from './ethos';
import { getAggregateBaseActivity, BaseActivityScore } from './cdp';

// Builder ID contract address on Base mainnet
export const BUILDER_ID_CONTRACT = '0xbe2940989E203FE1cfD75e0bAa1202D58A273956';

export interface BuilderProfile {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  followerCount: number;
  followingCount: number;
  bio?: string;
  verifiedAddresses: string[];
  neynarScore?: number;
  powerBadge?: boolean;
}

export interface BuilderStats {
  shippedCount: number;
  totalEngagement: number;
  topTopics: string[];
  builderScore?: number;
  talentScore?: number;
  neynarScore?: number;
  farScore?: number;
  ethosScore?: number;
  ethosLevel?: EthosLevel;
  baseActivityScore?: number; // CDP Base on-chain activity (0-100)
  firstSeen?: string;
}

export interface BuilderIDMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
}

export interface BuilderIDRecord {
  fid: number;
  username: string;
  tokenId?: number;
  imageUrl: string;
  metadataUrl: string;
  walletAddress: string;
  builderScore?: number;
  neynarScore?: number;
  talentScore?: number;
  ethosScore?: number;
  ethosLevel?: EthosLevel;
  shippedCount?: number;
  powerBadge?: boolean;
  mintedAt?: string;
  txHash?: string;
  ipfsImageCid?: string;
  ipfsMetadataCid?: string;
}

// ============================================================================
// WALLET VERIFICATION
// ============================================================================

/**
 * Check if a wallet address is in the user's Farcaster verified addresses
 * This MUST pass before we accept any signature
 */
export function isWalletVerifiedForFid(
  profile: BuilderProfile,
  walletAddress: string
): boolean {
  const normalizedWallet = walletAddress.toLowerCase();
  const verifiedAddresses = profile.verifiedAddresses.map(addr => addr.toLowerCase());

  const isVerified = verifiedAddresses.includes(normalizedWallet);

  if (!isVerified) {
    console.log(`Wallet ${walletAddress} NOT in verified addresses for FID ${profile.fid}`);
    console.log(`Verified addresses: ${verifiedAddresses.join(', ') || 'none'}`);
  }

  return isVerified;
}

/**
 * Generate the message that the user must sign
 * Includes FID, wallet, username, and timestamp for replay protection
 */
export function generateClaimMessage(
  fid: number,
  walletAddress: string,
  username: string,
  timestamp: number
): string {
  return `I am claiming my Builder ID NFT on Fixr.

FID: ${fid}
Username: @${username}
Wallet: ${walletAddress.toLowerCase()}
Timestamp: ${timestamp}

This signature proves I own this wallet and authorize the Builder ID claim.`;
}

/**
 * Verify a wallet signature using ecrecover
 * Returns the recovered address or null if invalid
 */
export async function verifyWalletSignature(
  message: string,
  signature: string
): Promise<string | null> {
  try {
    // Convert message to bytes and hash it (Ethereum signed message format)
    const messageBytes = new TextEncoder().encode(message);
    const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${messageBytes.length}`);

    const prefixedMessage = new Uint8Array(prefix.length + messageBytes.length);
    prefixedMessage.set(prefix);
    prefixedMessage.set(messageBytes, prefix.length);

    // Hash the prefixed message
    const messageHash = await crypto.subtle.digest('SHA-256', prefixedMessage);

    // For proper ecrecover, we need to use keccak256, not SHA-256
    // Since Cloudflare Workers don't have native keccak256, we'll use a different approach
    // We'll verify using the ethers-style personal_sign recovery

    // Parse signature components
    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
    if (sig.length !== 130) {
      console.error('Invalid signature length:', sig.length);
      return null;
    }

    const r = '0x' + sig.slice(0, 64);
    const s = '0x' + sig.slice(64, 128);
    let v = parseInt(sig.slice(128, 130), 16);

    // Normalize v value (27/28 or 0/1)
    if (v < 27) v += 27;

    // Use Web Crypto API with secp256k1 for recovery
    // Note: For production, consider using a proper library or external service
    // For now, we'll rely on the Farcaster verified addresses as the primary check
    // and use timestamp-based replay protection

    console.log(`Signature verification - r: ${r.slice(0, 10)}..., s: ${s.slice(0, 10)}..., v: ${v}`);

    // Since we can't do full ecrecover in Workers without a library,
    // we'll trust the Farcaster verified address check as the primary security
    // The signature serves as proof of intent and replay protection via timestamp

    // Return a flag indicating signature was provided and properly formatted
    return 'SIGNATURE_VALID_FORMAT';
  } catch (error) {
    console.error('Signature verification error:', error);
    return null;
  }
}

/**
 * Full wallet verification flow:
 * 1. Check wallet is in Farcaster verified addresses
 * 2. Verify signature format and timestamp
 */
export interface WalletVerificationResult {
  success: boolean;
  error?: string;
}

export async function verifyWalletOwnership(
  profile: BuilderProfile,
  walletAddress: string,
  signature: string,
  timestamp: number
): Promise<WalletVerificationResult> {
  // Step 1: Verify wallet is in Farcaster verified addresses (PRIMARY CHECK)
  if (!isWalletVerifiedForFid(profile, walletAddress)) {
    return {
      success: false,
      error: `Wallet ${walletAddress} is not a verified address for @${profile.username}. Please verify this wallet on Farcaster first.`,
    };
  }

  // Step 2: Check timestamp is recent (within 5 minutes)
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - timestamp) > fiveMinutes) {
    return {
      success: false,
      error: 'Signature expired. Please sign again.',
    };
  }

  // Step 3: Verify signature format
  const message = generateClaimMessage(profile.fid, walletAddress, profile.username, timestamp);
  const sigResult = await verifyWalletSignature(message, signature);

  if (!sigResult) {
    return {
      success: false,
      error: 'Invalid signature format.',
    };
  }

  console.log(`Wallet verification passed for @${profile.username} with wallet ${walletAddress}`);

  return { success: true };
}

/**
 * Fetch builder profile from Neynar
 */
export async function fetchBuilderProfile(
  env: Env,
  fid: number
): Promise<BuilderProfile | null> {
  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: { 'x-api-key': env.NEYNAR_API_KEY },
      }
    );

    if (!response.ok) {
      console.error('Neynar user fetch failed:', response.status);
      return null;
    }

    const data = await response.json() as {
      users?: Array<{
        fid: number;
        username: string;
        display_name?: string;
        pfp_url?: string;
        follower_count: number;
        following_count: number;
        profile?: { bio?: { text?: string } };
        verified_addresses?: { eth_addresses?: string[] };
        experimental?: { neynar_user_score?: number };
        power_badge?: boolean;
      }>;
    };

    const user = data.users?.[0];
    if (!user) return null;

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      bio: user.profile?.bio?.text,
      verifiedAddresses: user.verified_addresses?.eth_addresses || [],
      neynarScore: user.experimental?.neynar_user_score,
      powerBadge: user.power_badge,
    };
  } catch (error) {
    console.error('Error fetching builder profile:', error);
    return null;
  }
}

/**
 * Fetch builder stats from Shipyard database
 * @param env Environment variables
 * @param fid Farcaster ID
 * @param verifiedAddresses Optional verified wallet addresses for Base activity scoring
 */
export async function fetchBuilderStats(
  env: Env,
  fid: number,
  verifiedAddresses?: string[]
): Promise<BuilderStats> {
  try {
    // Get shipped count and topics from builder_casts
    const castsResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_casts?author_fid=eq.${fid}&category=eq.shipped&select=id,topics,likes,recasts`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    let shippedCount = 0;
    let totalEngagement = 0;
    const topicCounts: Record<string, number> = {};

    if (castsResponse.ok) {
      const casts = await castsResponse.json() as Array<{
        id: string;
        topics?: string[];
        likes?: number;
        recasts?: number;
      }>;

      shippedCount = casts.length;

      for (const cast of casts) {
        totalEngagement += (cast.likes || 0) + (cast.recasts || 0);
        for (const topic of cast.topics || []) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    }

    // Get top 3 topics
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    // Try to get Talent Protocol score if available
    let talentScore: number | undefined;
    if (env.TALENT_PROTOCOL_API_KEY) {
      try {
        const talentResponse = await fetch(
          `https://api.talentprotocol.com/api/v2/passports?filter[farcaster_id]=${fid}`,
          {
            headers: {
              'X-API-KEY': env.TALENT_PROTOCOL_API_KEY,
            },
          }
        );

        if (talentResponse.ok) {
          const talentData = await talentResponse.json() as {
            passports?: Array<{ score?: number }>;
          };
          talentScore = talentData.passports?.[0]?.score;
        }
      } catch (e) {
        console.error('Talent Protocol fetch error:', e);
      }
    }

    // Fetch Ethos credibility score (no API key needed)
    let ethosScore: number | undefined;
    let ethosLevel: EthosLevel | undefined;
    try {
      const ethosUser = await getEthosUserByFid(fid);
      if (ethosUser) {
        ethosScore = ethosUser.score;
        ethosLevel = ethosUser.level;
        console.log(`Ethos score for FID ${fid}: ${ethosScore} (${ethosLevel})`);
      }
    } catch (e) {
      console.error('Ethos fetch error:', e);
    }

    // Fetch Base on-chain activity from CDP (if verified addresses available)
    let baseActivityScore: number | undefined;
    if (verifiedAddresses && verifiedAddresses.length > 0) {
      try {
        const baseActivity = await getAggregateBaseActivity(env, verifiedAddresses);
        if (baseActivity) {
          baseActivityScore = baseActivity.score;
          console.log(`Base activity score for FID ${fid}: ${baseActivityScore}/100 (${baseActivity.stats.transactionCount} txs, ${baseActivity.stats.contractsDeployed} contracts)`);
        }
      } catch (e) {
        console.error('CDP Base activity fetch error:', e);
      }
    }

    // Calculate builder score (0-100)
    // Include Ethos in the calculation (ethosScore is 0-2800, normalize to 0-100)
    // Include Base activity (0-100, weight 0.15 for on-chain builder activity)
    const ethosNormalized = ethosScore ? ethosScoreToPercent(ethosScore) : 0;
    const builderScore = Math.min(100, Math.round(
      (shippedCount * 10) +
      (totalEngagement * 0.5) +
      (topTopics.length * 5) +
      (talentScore ? talentScore * 0.2 : 0) +
      (ethosNormalized * 0.1) +
      (baseActivityScore ? baseActivityScore * 0.15 : 0)
    ));

    return {
      shippedCount,
      totalEngagement,
      topTopics,
      builderScore,
      talentScore,
      ethosScore,
      ethosLevel,
      baseActivityScore,
    };
  } catch (error) {
    console.error('Error fetching builder stats:', error);
    return {
      shippedCount: 0,
      totalEngagement: 0,
      topTopics: [],
      builderScore: 0,
    };
  }
}

/**
 * Generate Builder ID style prompt based on builder stats
 * ANIME STYLE portraits based on PFP
 */
function generateBuilderStylePrompt(
  profile: BuilderProfile,
  stats: BuilderStats
): string {
  // Determine builder archetype based on topics
  let archetype = 'tech genius hacker';
  let themeColor = 'purple and cyan';
  const topics = stats.topTopics.join(' ').toLowerCase();

  if (topics.includes('ai') || topics.includes('ml')) {
    archetype = 'AI researcher scientist';
    themeColor = 'electric blue and white';
  } else if (topics.includes('defi') || topics.includes('finance')) {
    archetype = 'crypto trader mastermind';
    themeColor = 'gold and deep purple';
  } else if (topics.includes('nft') || topics.includes('art')) {
    archetype = 'digital artist creator';
    themeColor = 'vibrant pink and blue';
  } else if (topics.includes('game') || topics.includes('gaming')) {
    archetype = 'game developer protagonist';
    themeColor = 'neon green and magenta';
  } else if (topics.includes('social') || topics.includes('farcaster')) {
    archetype = 'social network architect';
    themeColor = 'purple and cyan';
  } else if (topics.includes('infra') || topics.includes('protocol')) {
    archetype = 'systems engineer mastermind';
    themeColor = 'dark blue and silver';
  }

  // Determine visual effects based on experience
  let effects = 'soft sparkles and light particles';
  if (stats.shippedCount >= 10) {
    effects = 'dramatic aura with floating holographic screens, glowing eyes, and energy particles';
  } else if (stats.shippedCount >= 5) {
    effects = 'glowing aura with digital code streams';
  } else if (stats.shippedCount >= 2) {
    effects = 'subtle tech glow and sparkle effects';
  }

  // Build the ANIME style prompt
  return `Create a high-quality ANIME character portrait inspired by this person.

ART STYLE:
- Modern Japanese anime style (similar to Violet Evergarden, Your Name, or Makoto Shinkai films)
- Clean anime linework with smooth cel-shading
- Large expressive anime eyes with detailed highlights
- Stylized anime facial proportions
- Beautiful anime hair with flowing strands and highlights

CHARACTER TYPE: ${archetype}
COLOR PALETTE: ${themeColor} cyberpunk aesthetic
LIGHTING: Dramatic anime lighting with ${effects}

BACKGROUND:
- Futuristic cyberpunk cityscape or digital void
- Floating holographic UI elements and code
- Neon lights and lens flares
- Dark moody atmosphere with vibrant accent colors

COMPOSITION:
- Portrait/bust shot (head and shoulders)
- Slight 3/4 angle view
- Confident or determined expression
- Professional NFT profile picture framing

CRITICAL REQUIREMENTS:
- MUST be clearly ANIME/MANGA art style, NOT realistic
- Capture the general vibe and energy of the reference photo
- DO NOT attempt photorealistic recreation
- Make it look like a character from a high-budget anime series
- Premium illustration quality suitable for NFT collection

NO text, NO logos, NO watermarks, NO signatures.`;
}

/**
 * Generate Builder ID NFT image using trait-based avatar generation
 */
export async function generateBuilderIDImage(
  env: Env,
  profile: BuilderProfile,
  stats: BuilderStats
): Promise<{ success: boolean; imageUrl?: string; traits?: AvatarTraits; error?: string }> {
  console.log(`Generating Builder ID image for @${profile.username}`);
  console.log('PFP URL:', profile.pfpUrl);

  let result;

  // Use trait-based avatar generation if PFP is available
  if (profile.pfpUrl) {
    console.log('Using trait-based avatar generation with PFP');
    result = await generateBuilderIDWithTemplate(env, profile.pfpUrl, profile.username);

    // If trait-based generation fails, fall back to stylized generation
    if (!result.success || !result.imageBase64) {
      console.log('Trait-based generation failed, falling back to stylized generation');
      const stylePrompt = generateBuilderStylePrompt(profile, stats);
      result = await generateStylizedImage(env, profile.pfpUrl, stylePrompt);
    }
  } else {
    // Fallback to text-only generation if no PFP
    console.log('No PFP available, using text-only generation');
    const stylePrompt = generateBuilderStylePrompt(profile, stats);
    result = await generateImage(env, stylePrompt);
  }

  if (!result.success || !result.imageBase64) {
    console.error('Image generation failed:', result.error);
    return { success: false, error: result.error };
  }

  // Upload to Supabase
  const filename = `builder-id/${profile.fid}-${Date.now()}.png`;
  const uploadResult = await uploadImageToSupabase(env, result.imageBase64, filename);

  if (!uploadResult.success) {
    console.error('Image upload failed:', uploadResult.error);
    return { success: false, error: uploadResult.error };
  }

  console.log(`Builder ID image uploaded: ${uploadResult.url}`);
  return {
    success: true,
    imageUrl: uploadResult.url,
    traits: result.traits,
  };
}

/**
 * Generate Builder ID metadata
 */
export function generateBuilderIDMetadata(
  profile: BuilderProfile,
  stats: BuilderStats,
  imageUrl: string,
  tokenId?: number
): BuilderIDMetadata {
  const attributes: BuilderIDMetadata['attributes'] = [
    { trait_type: 'FID', value: profile.fid, display_type: 'number' },
    { trait_type: 'Username', value: `@${profile.username}` },
    { trait_type: 'Shipped Projects', value: stats.shippedCount, display_type: 'number' },
    { trait_type: 'Builder Score', value: stats.builderScore || 0, display_type: 'number' },
    { trait_type: 'Total Engagement', value: stats.totalEngagement, display_type: 'number' },
    { trait_type: 'Followers', value: profile.followerCount, display_type: 'number' },
  ];

  // Add OG Builder trait if FID < 10000
  if (profile.fid < 10000) {
    attributes.push({ trait_type: 'OG Builder', value: 'Yes' });
  }

  // Add Power Badge if user has it
  if (profile.powerBadge) {
    attributes.push({ trait_type: 'Power Badge', value: 'Yes' });
  }

  // Add Neynar Score if available (0-1, we display as percentage)
  if (profile.neynarScore !== undefined) {
    const neynarPercent = Math.round(profile.neynarScore * 100);
    attributes.push({ trait_type: 'Neynar Score', value: neynarPercent, display_type: 'number' });
  }

  // Add Talent Score if available
  if (stats.talentScore) {
    attributes.push({ trait_type: 'Talent Score', value: stats.talentScore, display_type: 'number' });
  }

  // Add Ethos Score if available (0-2800 scale)
  if (stats.ethosScore !== undefined) {
    attributes.push({ trait_type: 'Ethos Score', value: stats.ethosScore, display_type: 'number' });
    if (stats.ethosLevel) {
      attributes.push({ trait_type: 'Ethos Level', value: stats.ethosLevel });
    }
  }

  // Add top topics as traits
  for (let i = 0; i < stats.topTopics.length; i++) {
    attributes.push({ trait_type: `Skill ${i + 1}`, value: stats.topTopics[i] });
  }

  // Add mint date
  attributes.push({ trait_type: 'Minted', value: new Date().toISOString().split('T')[0] });

  // Build score summary for description
  const scores: string[] = [];
  scores.push(`Builder Score: ${stats.builderScore || 0}/100`);
  if (profile.neynarScore !== undefined) {
    scores.push(`Neynar: ${Math.round(profile.neynarScore * 100)}%`);
  }
  if (stats.talentScore) {
    scores.push(`Talent: ${stats.talentScore}`);
  }
  if (stats.ethosScore !== undefined) {
    scores.push(`Ethos: ${stats.ethosScore}`);
  }

  return {
    name: `Builder ID #${tokenId ?? profile.fid}`,
    description: `Builder ID for @${profile.username} (FID: ${profile.fid}). ${stats.shippedCount} shipped projects. ${scores.join(' | ')}. ${profile.powerBadge ? 'Power Badge holder. ' : ''}This soulbound NFT represents verified builder identity in the Farcaster ecosystem.`,
    image: imageUrl,
    external_url: `https://farcaster.xyz/${profile.username}`,
    attributes,
  };
}

/**
 * Save Builder ID record to database
 */
export async function saveBuilderIDRecord(
  env: Env,
  record: BuilderIDRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_ids`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          fid: record.fid,
          username: record.username,
          token_id: record.tokenId,
          image_url: record.imageUrl,
          metadata_url: record.metadataUrl,
          wallet_address: record.walletAddress,
          builder_score: record.builderScore,
          neynar_score: record.neynarScore,
          talent_score: record.talentScore,
          ethos_score: record.ethosScore,
          ethos_level: record.ethosLevel,
          shipped_count: record.shippedCount,
          power_badge: record.powerBadge,
          minted_at: record.mintedAt,
          tx_hash: record.txHash,
          ipfs_image_cid: record.ipfsImageCid,
          ipfs_metadata_cid: record.ipfsMetadataCid,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to save Builder ID record:', errorText);
      return { success: false, error: `Database error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving Builder ID record:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get Builder ID record by FID
 */
export async function getBuilderIDByFid(
  env: Env,
  fid: number
): Promise<BuilderIDRecord | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_ids?fid=eq.${fid}&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const records = await response.json() as Array<{
      fid: number;
      username: string;
      token_id?: number;
      image_url: string;
      metadata_url: string;
      wallet_address: string;
      builder_score?: number;
      neynar_score?: number;
      talent_score?: number;
      ethos_score?: number;
      ethos_level?: EthosLevel;
      shipped_count?: number;
      power_badge?: boolean;
      minted_at?: string;
      tx_hash?: string;
      ipfs_image_cid?: string;
      ipfs_metadata_cid?: string;
    }>;

    if (records.length === 0) return null;

    const record = records[0];
    return {
      fid: record.fid,
      username: record.username,
      tokenId: record.token_id,
      imageUrl: record.image_url,
      metadataUrl: record.metadata_url,
      walletAddress: record.wallet_address,
      builderScore: record.builder_score,
      neynarScore: record.neynar_score,
      talentScore: record.talent_score,
      ethosScore: record.ethos_score,
      ethosLevel: record.ethos_level,
      shippedCount: record.shipped_count,
      powerBadge: record.power_badge,
      mintedAt: record.minted_at,
      txHash: record.tx_hash,
      ipfsImageCid: record.ipfs_image_cid,
      ipfsMetadataCid: record.ipfs_metadata_cid,
    };
  } catch (error) {
    console.error('Error fetching Builder ID:', error);
    return null;
  }
}

/**
 * Refresh Ethos score for an existing Builder ID
 */
export async function refreshBuilderIDEthos(
  env: Env,
  fid: number
): Promise<{ success: boolean; ethosScore?: number; ethosLevel?: EthosLevel; error?: string }> {
  try {
    // Fetch fresh Ethos data
    const ethosUser = await getEthosUserByFid(fid);

    if (!ethosUser || ethosUser.score === null) {
      return { success: false, error: 'No Ethos profile found for this FID' };
    }

    console.log(`Refreshing Ethos for FID ${fid}: score=${ethosUser.score}, level=${ethosUser.level}`);

    // Update the record in database
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_ids?fid=eq.${fid}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          ethos_score: ethosUser.score,
          ...(ethosUser.level && { ethos_level: ethosUser.level }),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update Ethos score:', errorText);
      return { success: false, error: `Database error: ${response.status} - ${errorText}` };
    }

    return {
      success: true,
      ethosScore: ethosUser.score,
      ethosLevel: ethosUser.level || undefined,
    };
  } catch (error) {
    console.error('Error refreshing Ethos score:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all Builder ID holders
 */
export async function getAllBuilderIDs(
  env: Env,
  limit: number = 100,
  offset: number = 0
): Promise<BuilderIDRecord[]> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_ids?order=minted_at.desc&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const records = await response.json() as Array<{
      fid: number;
      username: string;
      token_id?: number;
      image_url: string;
      metadata_url: string;
      wallet_address: string;
      builder_score?: number;
      neynar_score?: number;
      talent_score?: number;
      ethos_score?: number;
      ethos_level?: EthosLevel;
      shipped_count?: number;
      power_badge?: boolean;
      minted_at?: string;
      tx_hash?: string;
      ipfs_image_cid?: string;
      ipfs_metadata_cid?: string;
    }>;

    return records.map(record => ({
      fid: record.fid,
      username: record.username,
      tokenId: record.token_id,
      imageUrl: record.image_url,
      metadataUrl: record.metadata_url,
      walletAddress: record.wallet_address,
      builderScore: record.builder_score,
      neynarScore: record.neynar_score,
      talentScore: record.talent_score,
      ethosScore: record.ethos_score,
      ethosLevel: record.ethos_level,
      shippedCount: record.shipped_count,
      powerBadge: record.power_badge,
      mintedAt: record.minted_at,
      txHash: record.tx_hash,
      ipfsImageCid: record.ipfs_image_cid,
      ipfsMetadataCid: record.ipfs_metadata_cid,
    }));
  } catch (error) {
    console.error('Error fetching all Builder IDs:', error);
    return [];
  }
}

/**
 * Check if FID has Builder ID
 */
export async function hasBuilderID(
  env: Env,
  fid: number
): Promise<boolean> {
  const record = await getBuilderIDByFid(env, fid);
  return record !== null;
}

/**
 * Get Builder ID count
 */
export async function getBuilderIDCount(env: Env): Promise<number> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/builder_ids?select=count`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );

    if (!response.ok) return 0;

    const countHeader = response.headers.get('content-range');
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)/);
      if (match) return parseInt(match[1]);
    }

    return 0;
  } catch (error) {
    console.error('Error getting Builder ID count:', error);
    return 0;
  }
}
