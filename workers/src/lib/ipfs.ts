/**
 * IPFS Pinning via Pinata
 *
 * Pins NFT images and metadata to IPFS for permanent storage.
 * Required for NFTs to display correctly in wallets like OpenSea, Rainbow, etc.
 */

import { Env } from './types';

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface IPFSResult {
  success: boolean;
  cid?: string;
  url?: string;
  error?: string;
}

/**
 * Pin a file (image) to IPFS via Pinata
 * @param env Environment with Pinata JWT
 * @param imageUrl URL of the image to pin
 * @param name Name for the pinned file
 */
export async function pinImageToIPFS(
  env: Env,
  imageUrl: string,
  name: string
): Promise<IPFSResult> {
  if (!env.PINATA_JWT) {
    return { success: false, error: 'Pinata JWT not configured' };
  }

  try {
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { success: false, error: `Failed to fetch image: ${imageResponse.status}` };
    }

    const imageBlob = await imageResponse.blob();

    // Create form data for Pinata
    const formData = new FormData();
    formData.append('file', imageBlob, `${name}.png`);

    // Add metadata
    const metadata = JSON.stringify({
      name: name,
      keyvalues: {
        type: 'builder-id-image',
        timestamp: new Date().toISOString(),
      },
    });
    formData.append('pinataMetadata', metadata);

    // Pin to IPFS
    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
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

    const result = await response.json() as PinataResponse;

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
 * Pin JSON metadata to IPFS via Pinata
 * @param env Environment with Pinata JWT
 * @param metadata The metadata object to pin
 * @param name Name for the pinned file
 */
export async function pinMetadataToIPFS(
  env: Env,
  metadata: Record<string, unknown>,
  name: string
): Promise<IPFSResult> {
  if (!env.PINATA_JWT) {
    return { success: false, error: 'Pinata JWT not configured' };
  }

  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: name,
          keyvalues: {
            type: 'builder-id-metadata',
            timestamp: new Date().toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Pinata error: ${error}` };
    }

    const result = await response.json() as PinataResponse;

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
 * Get HTTPS gateway URL for an IPFS CID
 */
export function getIPFSGatewayUrl(cid: string): string {
  return `${PINATA_GATEWAY}/${cid}`;
}

/**
 * Convert ipfs:// URL to https gateway URL
 */
export function ipfsToHttps(ipfsUrl: string): string {
  if (ipfsUrl.startsWith('ipfs://')) {
    const cid = ipfsUrl.replace('ipfs://', '');
    return getIPFSGatewayUrl(cid);
  }
  return ipfsUrl;
}
