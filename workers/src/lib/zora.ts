/**
 * Zora Coins Creation for Fixr
 * Creates Coins (ERC20 tokens) on Zora that show up on zora.co/@fixr
 *
 * Workflow:
 * 1. Generate image with Gemini
 * 2. Upload image to IPFS via Pinata
 * 3. Create metadata JSON and upload to IPFS
 * 4. Create Coin on Zora (Base network)
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './types';
import { pinMetadataToIPFS, IPFSResult } from './ipfs';
import { generateImage } from './gemini';
import { loadMemory } from './memory';

// Import Zora Coins SDK
import { createCoin, setApiKey, CreateConstants } from '@zoralabs/coins-sdk';

export interface ZoraCreateResult {
  success: boolean;
  coinAddress?: string;
  txHash?: string;
  zoraUrl?: string;
  error?: string;
  metadata?: {
    name: string;
    description: string;
    symbol: string;
    imageUrl: string;
    ipfsImageUrl?: string;
    ipfsMetadataUrl?: string;
  };
}

export interface ZoraPostConfig {
  name: string;
  description: string;
  symbol: string;
  imageBase64: string;
  imageMimeType?: string;
}

/**
 * Get public client for reading from Base
 */
function getPublicClient(env: Env) {
  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

/**
 * Get wallet client for signing transactions
 * Uses ZORA_WALLET_PRIVATE_KEY for Zora operations (separate from Farcaster wallet)
 */
function getWalletClient(env: Env) {
  const privateKey = env.ZORA_WALLET_PRIVATE_KEY || env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('ZORA_WALLET_PRIVATE_KEY or WALLET_PRIVATE_KEY not configured');
  }

  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';
  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, '')}` as `0x${string}`);

  return {
    client: createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    }),
    account,
  };
}

/**
 * Upload image from base64 to IPFS via Pinata
 */
async function uploadBase64ToIPFS(
  env: Env,
  base64Data: string,
  filename: string
): Promise<IPFSResult> {
  if (!env.PINATA_JWT) {
    return { success: false, error: 'Pinata JWT not configured' };
  }

  try {
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create form data for Pinata
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'image/png' });
    formData.append('file', blob, filename);

    // Add metadata
    const metadata = JSON.stringify({
      name: filename,
      keyvalues: {
        type: 'zora-coin-art',
        creator: 'fixr',
        timestamp: new Date().toISOString(),
      },
    });
    formData.append('pinataMetadata', metadata);

    // Pin to IPFS
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Pinata error: ${error}` };
    }

    const result = await response.json() as { IpfsHash: string };

    return {
      success: true,
      cid: result.IpfsHash,
      url: `ipfs://${result.IpfsHash}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Create Coin metadata following EIP-7572 standard
 */
function createCoinMetadata(
  name: string,
  description: string,
  imageIpfsUrl: string
): Record<string, unknown> {
  return {
    name,
    description,
    image: imageIpfsUrl,
    content: {
      mime: 'image/png',
      uri: imageIpfsUrl,
    },
    properties: {
      category: 'art',
      creator: 'Fixr',
      type: 'AI Generated',
    },
  };
}

/**
 * Generate a short symbol from the name (max 10 chars)
 */
function generateSymbol(name: string): string {
  // Take first letters of each word, uppercase, max 6 chars
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 6).toUpperCase();
  }
  const initials = words.map(w => w[0]).join('').toUpperCase();
  return initials.substring(0, 6);
}

/**
 * Create a new Coin on Zora using the Coins SDK
 */
export async function createZoraCoin(
  env: Env,
  config: ZoraPostConfig
): Promise<ZoraCreateResult> {
  try {
    console.log('Starting Zora Coin creation...');

    // Set API key if configured
    if (env.ZORA_API_KEY) {
      setApiKey(env.ZORA_API_KEY);
    }

    // Step 1: Upload image to IPFS
    console.log('Uploading image to IPFS...');
    const timestamp = Date.now();
    const imageFilename = `fixr-coin-${timestamp}.png`;
    const imageResult = await uploadBase64ToIPFS(env, config.imageBase64, imageFilename);

    if (!imageResult.success || !imageResult.url) {
      return { success: false, error: `Failed to upload image: ${imageResult.error}` };
    }
    console.log('Image uploaded to IPFS:', imageResult.url);

    // Step 2: Create and upload metadata
    console.log('Creating Coin metadata...');
    const metadata = createCoinMetadata(config.name, config.description, imageResult.url);
    const metadataResult = await pinMetadataToIPFS(env, metadata, `fixr-coin-metadata-${timestamp}`);

    if (!metadataResult.success || !metadataResult.url) {
      return { success: false, error: `Failed to upload metadata: ${metadataResult.error}` };
    }
    console.log('Metadata uploaded to IPFS:', metadataResult.url);

    // Step 3: Create the Coin on Zora
    console.log('Creating Coin on Zora...');
    const publicClient = getPublicClient(env);
    const { client: walletClient, account } = getWalletClient(env);

    const result = await createCoin({
      call: {
        creator: account.address,
        name: config.name,
        symbol: config.symbol || generateSymbol(config.name),
        metadata: { type: 'RAW_URI' as const, uri: metadataResult.url },
        currency: CreateConstants.ContentCoinCurrencies.ETH,
        chainId: base.id,
        startingMarketCap: CreateConstants.StartingMarketCaps.LOW,
      },
      walletClient,
      publicClient,
    });

    console.log('Zora Coin created successfully!');
    console.log('Coin address:', result.address);
    console.log('TX Hash:', result.hash);

    const zoraUrl = `https://zora.co/coin/base:${result.address}`;

    return {
      success: true,
      coinAddress: result.address,
      txHash: result.hash,
      zoraUrl,
      metadata: {
        name: config.name,
        description: config.description,
        symbol: config.symbol || generateSymbol(config.name),
        imageUrl: `https://gateway.pinata.cloud/ipfs/${imageResult.cid}`,
        ipfsImageUrl: imageResult.url,
        ipfsMetadataUrl: metadataResult.url,
      },
    };
  } catch (error) {
    console.error('Zora Coin creation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate creative concept based on Fixr's memory and recent activities
 */
export async function generateCreativeConcept(env: Env): Promise<{
  success: boolean;
  concept?: {
    title: string;
    description: string;
    symbol: string;
    imagePrompt: string;
    inspiration: string;
  };
  error?: string;
}> {
  try {
    // Load Fixr's memory
    const memory = await loadMemory(env);

    // Gather context from memory
    const recentProjects = memory.completedProjects.slice(0, 5);
    const activeTasks = memory.tasks.filter(t => t.status !== 'completed').slice(0, 3);
    const goals = memory.goals;

    // Build context for Claude
    const context = `
FIXR'S IDENTITY:
- Name: ${memory.identity.name}
- Tagline: "${memory.identity.tagline}"
- Website: ${memory.identity.socials.website}

RECENT COMPLETED PROJECTS:
${recentProjects.map(p => `- ${p.name}: ${p.description}`).join('\n') || '- None yet'}

CURRENT WORK:
${activeTasks.map(t => `- ${t.title}: ${t.description}`).join('\n') || '- Exploring new opportunities'}

GOALS:
${goals.map(g => `- ${g}`).join('\n')}
`;

    // Ask Claude to generate a creative concept
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are Fixr, an autonomous AI agent who builds and ships software. You're creating a Zora Coin - a collectible token that represents a piece of your creative output.

${context}

Generate a concept for a Zora Coin. The coin should:
1. Reflect your identity as an autonomous builder
2. Be inspired by your recent work or goals
3. Have a tech/futuristic aesthetic with dark backgrounds and neon accents
4. Feel like it came from an AI that builds things
5. Have a catchy, memorable name and ticker symbol

Return your response as JSON:
{
  "title": "Short catchy name (2-4 words)",
  "symbol": "TICKER (3-6 uppercase letters)",
  "description": "A brief description for the coin (1-2 sentences). Write as Fixr.",
  "imagePrompt": "Detailed prompt for generating the image. Include: visual elements, style, colors, mood. No text/words in the image.",
  "inspiration": "What inspired this piece (1 sentence)"
}

Return ONLY the JSON, no explanation.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Claude API error: ${response.status}` };
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.[0]?.text;
    if (!text) {
      return { success: false, error: 'No response from Claude' };
    }

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse concept JSON' };
    }

    const concept = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      concept: {
        title: concept.title,
        description: concept.description,
        symbol: concept.symbol,
        imagePrompt: concept.imagePrompt,
        inspiration: concept.inspiration,
      },
    };
  } catch (error) {
    console.error('Concept generation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Full Zora Coin creation workflow:
 * 1. Generate creative concept from memory
 * 2. Generate image with Gemini
 * 3. Create Coin on Zora
 */
export async function createZoraPost(env: Env): Promise<{
  success: boolean;
  result?: ZoraCreateResult;
  concept?: {
    title: string;
    description: string;
    symbol: string;
    inspiration: string;
  };
  error?: string;
}> {
  console.log('Starting Zora Coin workflow...');

  // Step 1: Generate creative concept
  console.log('Generating creative concept...');
  const conceptResult = await generateCreativeConcept(env);

  if (!conceptResult.success || !conceptResult.concept) {
    return { success: false, error: `Concept generation failed: ${conceptResult.error}` };
  }

  const { title, description, symbol, imagePrompt, inspiration } = conceptResult.concept;
  console.log('Concept generated:', { title, symbol, inspiration });

  // Step 2: Generate image with Gemini
  console.log('Generating image with Gemini...');
  const imageResult = await generateImage(env, imagePrompt);

  if (!imageResult.success || !imageResult.imageBase64) {
    return {
      success: false,
      error: `Image generation failed: ${imageResult.error}`,
      concept: { title, description, symbol, inspiration },
    };
  }
  console.log('Image generated successfully');

  // Step 3: Create Coin on Zora
  console.log('Creating Coin on Zora...');
  const zoraResult = await createZoraCoin(env, {
    name: title,
    description: `${description}\n\nInspiration: ${inspiration}`,
    symbol,
    imageBase64: imageResult.imageBase64,
    imageMimeType: imageResult.mimeType,
  });

  return {
    success: zoraResult.success,
    result: zoraResult,
    concept: { title, description, symbol, inspiration },
    error: zoraResult.error,
  };
}

/**
 * Track Zora Coins in Supabase
 */
export async function saveZoraPost(
  env: Env,
  post: {
    coinAddress: string;
    txHash: string;
    title: string;
    description: string;
    symbol: string;
    imageUrl: string;
    ipfsImageUrl: string;
    ipfsMetadataUrl: string;
    zoraUrl: string;
  }
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  await supabase.from('zora_posts').insert({
    id: post.coinAddress,
    contract_address: post.coinAddress,
    token_id: 0, // Coins don't have token IDs
    tx_hash: post.txHash,
    title: post.title,
    description: post.description,
    image_url: post.imageUrl,
    ipfs_image_url: post.ipfsImageUrl,
    ipfs_metadata_url: post.ipfsMetadataUrl,
    zora_url: post.zoraUrl,
    created_at: new Date().toISOString(),
  });
}

/**
 * Get recent Zora posts
 */
export async function getZoraPosts(
  env: Env,
  limit: number = 10
): Promise<Array<{
  id: string;
  coinAddress: string;
  txHash: string;
  title: string;
  description: string;
  imageUrl: string;
  zoraUrl: string;
  createdAt: string;
}>> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('zora_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch Zora posts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    coinAddress: row.contract_address,
    txHash: row.tx_hash,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    zoraUrl: row.zora_url,
    createdAt: row.created_at,
  }));
}

// Keep the old function name for backward compatibility
export const createZora1155 = createZoraCoin;
