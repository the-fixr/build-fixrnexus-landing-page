/**
 * Drain Wallet Worker
 * Sends all ETH from validator wallet to destination address
 *
 * Deploy this temporarily to each validator worker, hit /drain endpoint, then remove
 */

import { ethers } from 'ethers';

interface Env {
  VALIDATOR_PRIVATE_KEY: string;
  RPC_URL: string;
}

const DESTINATION = '0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/drain' && request.method === 'POST') {
      return handleDrain(env);
    }

    if (url.pathname === '/balance') {
      return handleBalance(env);
    }

    return new Response('Drain wallet worker. POST /drain to send all funds, GET /balance to check.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },
};

async function handleBalance(env: Env): Promise<Response> {
  try {
    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);

    const balance = await provider.getBalance(wallet.address);

    return new Response(JSON.stringify({
      address: wallet.address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString(),
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDrain(env: Env): Promise<Response> {
  try {
    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);

    const balance = await provider.getBalance(wallet.address);

    if (balance === BigInt(0)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Wallet is empty',
        address: wallet.address,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(1000000000); // 1 gwei fallback

    // Standard ETH transfer uses 21000 gas
    const gasLimit = BigInt(21000);
    const gasCost = gasPrice * gasLimit;

    // Calculate amount to send (balance minus gas)
    const amountToSend = balance - gasCost;

    if (amountToSend <= BigInt(0)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Balance too low to cover gas',
        address: wallet.address,
        balance: ethers.formatEther(balance),
        gasCost: ethers.formatEther(gasCost),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send transaction
    const tx = await wallet.sendTransaction({
      to: DESTINATION,
      value: amountToSend,
      gasLimit,
      gasPrice,
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    return new Response(JSON.stringify({
      success: true,
      from: wallet.address,
      to: DESTINATION,
      amount: ethers.formatEther(amountToSend),
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
