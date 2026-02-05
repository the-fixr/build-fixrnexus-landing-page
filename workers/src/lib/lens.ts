/**
 * Lens Protocol v3 Integration for Fixr
 * Posts to Lens Protocol (Hey.xyz, Orb, etc.)
 *
 * Lens v3 uses accounts instead of profiles
 * Account address: 0x3BCE5de801472ED111D4f373A919A787bC35A0dD
 * Username: fixr_
 */

import { Env } from './types';

// Lens v3 API endpoint
const LENS_API_URL = 'https://api.lens.xyz/graphql';

export interface LensPostResult {
  success: boolean;
  postId?: string;
  txHash?: string;
  lensUrl?: string;
  error?: string;
}

export interface LensPostConfig {
  content: string;
  image?: {
    url: string;
    mimeType: string;
  };
}

/**
 * Create text-only post metadata following Lens v3 Metadata Standards
 */
function createTextMetadata(content: string): Record<string, unknown> {
  return {
    $schema: 'https://json-schemas.lens.dev/posts/text-only/3.0.0.json',
    lens: {
      id: crypto.randomUUID(),
      content,
      locale: 'en',
      mainContentFocus: 'TEXT_ONLY',
    },
  };
}

/**
 * Create image post metadata
 */
function createImageMetadata(
  content: string,
  imageUrl: string,
  mimeType: string
): Record<string, unknown> {
  return {
    $schema: 'https://json-schemas.lens.dev/posts/image/3.0.0.json',
    lens: {
      id: crypto.randomUUID(),
      content,
      locale: 'en',
      mainContentFocus: 'IMAGE',
      image: {
        item: imageUrl,
        type: mimeType,
      },
    },
  };
}

/**
 * Upload metadata to IPFS via Pinata (using existing infrastructure)
 */
async function uploadMetadataToIPFS(
  env: Env,
  metadata: Record<string, unknown>
): Promise<{ success: boolean; uri?: string; error?: string }> {
  if (!env.PINATA_JWT) {
    return { success: false, error: 'Pinata JWT not configured' };
  }

  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `fixr-lens-post-${Date.now()}`,
          keyvalues: {
            type: 'lens-post',
            creator: 'fixr',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Pinata error: ${error}` };
    }

    const result = (await response.json()) as { IpfsHash: string };
    return {
      success: true,
      uri: `ipfs://${result.IpfsHash}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Authenticate with Lens v3 API using challenge-signature flow
 */
async function authenticateLens(env: Env): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  const privateKey = env.LENS_WALLET_PRIVATE_KEY || env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    return { success: false, error: 'LENS_WALLET_PRIVATE_KEY not configured' };
  }

  try {
    // Import viem for signing
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(
      `0x${privateKey.replace(/^0x/, '')}` as `0x${string}`
    );

    // Step 1: Get challenge for account owner authentication
    const challengeResponse = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://fixr.nexus',
      },
      body: JSON.stringify({
        query: `
          mutation Challenge($request: ChallengeRequest!) {
            challenge(request: $request) {
              id
              text
            }
          }
        `,
        variables: {
          request: {
            accountOwner: {
              account: env.LENS_ACCOUNT_ADDRESS || '0x3BCE5de801472ED111D4f373A919A787bC35A0dD',
              owner: account.address,
            },
          },
        },
      }),
    });

    if (!challengeResponse.ok) {
      const errorText = await challengeResponse.text();
      return { success: false, error: `Challenge request failed: ${challengeResponse.status} - ${errorText}` };
    }

    const challengeData = (await challengeResponse.json()) as {
      data?: { challenge?: { id: string; text: string } };
      errors?: Array<{ message: string }>;
    };

    if (challengeData.errors?.length) {
      return { success: false, error: `Challenge error: ${challengeData.errors[0].message}` };
    }

    const challenge = challengeData.data?.challenge;
    if (!challenge) {
      return { success: false, error: 'No challenge returned from Lens API' };
    }

    // Step 2: Sign the challenge
    const signature = await account.signMessage({ message: challenge.text });

    // Step 3: Authenticate with signature
    const authResponse = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://fixr.nexus',
      },
      body: JSON.stringify({
        query: `
          mutation Authenticate($request: SignedAuthChallenge!) {
            authenticate(request: $request) {
              ... on AuthenticationTokens {
                accessToken
                refreshToken
                idToken
              }
              ... on WrongSignerError {
                reason
              }
              ... on ExpiredChallengeError {
                reason
              }
              ... on ForbiddenError {
                reason
              }
            }
          }
        `,
        variables: {
          request: {
            id: challenge.id,
            signature,
          },
        },
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      return { success: false, error: `Auth request failed: ${authResponse.status} - ${errorText}` };
    }

    const authData = (await authResponse.json()) as {
      data?: {
        authenticate?: {
          accessToken?: string;
          refreshToken?: string;
          reason?: string;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (authData.errors?.length) {
      return { success: false, error: `Auth error: ${authData.errors[0].message}` };
    }

    const authResult = authData.data?.authenticate;
    if (!authResult) {
      return { success: false, error: 'No auth result from Lens API' };
    }

    if (authResult.reason) {
      return { success: false, error: `Auth failed: ${authResult.reason}` };
    }

    if (!authResult.accessToken) {
      return { success: false, error: 'No access token returned' };
    }

    return { success: true, accessToken: authResult.accessToken };
  } catch (error) {
    return { success: false, error: `Auth exception: ${String(error)}` };
  }
}

/**
 * Create a post on Lens Protocol v3
 */
export async function createLensPost(
  env: Env,
  config: LensPostConfig
): Promise<LensPostResult> {
  try {
    console.log('Starting Lens v3 post creation...');

    // Step 1: Authenticate
    console.log('Authenticating with Lens v3...');
    const authResult = await authenticateLens(env);
    if (!authResult.success || !authResult.accessToken) {
      return { success: false, error: `Authentication failed: ${authResult.error}` };
    }
    console.log('Authenticated successfully');

    // Step 2: Create metadata
    console.log('Creating post metadata...');
    const metadata = config.image
      ? createImageMetadata(config.content, config.image.url, config.image.mimeType)
      : createTextMetadata(config.content);

    // Step 3: Upload metadata to IPFS
    console.log('Uploading metadata to IPFS...');
    const uploadResult = await uploadMetadataToIPFS(env, metadata);
    if (!uploadResult.success || !uploadResult.uri) {
      return { success: false, error: `Metadata upload failed: ${uploadResult.error}` };
    }
    console.log('Metadata uploaded:', uploadResult.uri);

    // Step 4: Create post via Lens v3 API
    console.log('Creating post on Lens v3...');
    const postResponse = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://fixr.nexus',
        'Authorization': `Bearer ${authResult.accessToken}`,
      },
      body: JSON.stringify({
        query: `
          mutation Post($request: CreatePostRequest!) {
            post(request: $request) {
              __typename
              ... on PostResponse {
                hash
              }
              ... on SponsoredTransactionRequest {
                reason
                raw {
                  to
                  data
                  value
                }
              }
              ... on SelfFundedTransactionRequest {
                reason
                raw {
                  to
                  data
                  value
                  gasLimit
                }
              }
              ... on TransactionWillFail {
                reason
              }
            }
          }
        `,
        variables: {
          request: {
            contentUri: uploadResult.uri,
          },
        },
      }),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      return { success: false, error: `Post request failed: ${postResponse.status} - ${errorText}` };
    }

    const postData = (await postResponse.json()) as {
      data?: {
        post?: {
          __typename?: string;
          hash?: string;
          reason?: string;
          raw?: {
            to: string;
            data: string;
            value: string;
            gasLimit?: string;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    console.log('Post mutation response:', JSON.stringify(postData, null, 2));

    if (postData.errors?.length) {
      return { success: false, error: `Post error: ${postData.errors[0].message}` };
    }

    const result = postData.data?.post;
    if (!result) {
      return { success: false, error: 'No result from post mutation' };
    }

    console.log('Post response type:', result.__typename);

    // Handle different response types
    if (result.__typename === 'PostResponse' && result.hash) {
      console.log('Lens v3 post created directly:', result.hash);
      return {
        success: true,
        postId: result.hash,
        txHash: result.hash,
        lensUrl: `https://hey.xyz/u/fixr_`,
      };
    }

    // If we get a transaction request, we need to sign and submit it
    if ((result.__typename === 'SponsoredTransactionRequest' ||
         result.__typename === 'SelfFundedTransactionRequest') && result.raw) {
      console.log('Got transaction request, need to sign and submit...');

      // Import viem for transaction signing
      const { privateKeyToAccount } = await import('viem/accounts');
      const { createWalletClient, http } = await import('viem');
      const { lens } = await import('viem/chains');

      const privateKey = env.LENS_WALLET_PRIVATE_KEY || env.WALLET_PRIVATE_KEY;
      if (!privateKey) {
        return { success: false, error: 'No wallet key for signing' };
      }

      const account = privateKeyToAccount(
        `0x${privateKey.replace(/^0x/, '')}` as `0x${string}`
      );

      const walletClient = createWalletClient({
        account,
        chain: lens,
        transport: http(),
      });

      // Send the transaction
      const txHash = await walletClient.sendTransaction({
        to: result.raw.to as `0x${string}`,
        data: result.raw.data as `0x${string}`,
        value: BigInt(result.raw.value || '0'),
      });

      console.log('Transaction submitted:', txHash);

      return {
        success: true,
        postId: txHash,
        txHash: txHash,
        lensUrl: `https://hey.xyz/u/fixr_`,
      };
    }

    if (result.reason) {
      return { success: false, error: `Post failed: ${result.reason}` };
    }

    return { success: false, error: `Unknown response type: ${result.__typename}` };
  } catch (error) {
    console.error('Lens post creation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Alias for createLensPost - v3 uses unified posting
 */
export const createLensPostMomoka = createLensPost;

/**
 * Get Lens v3 account info
 */
export async function getLensProfile(
  env: Env,
  username?: string
): Promise<{
  success: boolean;
  profile?: {
    id: string;
    handle: string;
    name?: string;
    bio?: string;
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  error?: string;
}> {
  try {
    const localName = username || 'fixr_';

    const response = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query Account($request: AccountRequest!) {
            account(request: $request) {
              address
              username {
                localName
              }
              metadata {
                name
                bio
              }
            }
          }
        `,
        variables: {
          request: {
            username: {
              localName,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Profile request failed: ${response.status}` };
    }

    const data = (await response.json()) as {
      data?: {
        account?: {
          address: string;
          username?: { localName: string };
          metadata?: { name?: string; bio?: string };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (data.errors?.length) {
      return { success: false, error: data.errors[0].message };
    }

    const account = data.data?.account;
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    return {
      success: true,
      profile: {
        id: account.address,
        handle: account.username?.localName || localName,
        name: account.metadata?.name,
        bio: account.metadata?.bio,
        followersCount: 0, // v3 stats fetched separately
        followingCount: 0,
        postsCount: 0,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Crosspost from Farcaster to Lens
 */
export async function crosspostToLens(
  env: Env,
  content: string,
  imageUrl?: string
): Promise<LensPostResult> {
  // Add crosspost attribution
  const lensContent = `${content}\n\n🔄 via @fixr on Farcaster`;

  return createLensPost(env, {
    content: lensContent,
    image: imageUrl
      ? { url: imageUrl, mimeType: 'image/png' }
      : undefined,
  });
}
