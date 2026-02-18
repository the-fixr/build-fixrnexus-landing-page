import { PublicKey, Connection, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import * as crypto from 'crypto';

// ─── Program ─────────────────────────────────────────────────────────────────

export const LEVY_PROGRAM_ID = new PublicKey('3hDJRcAJf5AHrRgkXhUUCcTYQVMkCubh9M6kTrsBZv55');

// ─── PDAs ────────────────────────────────────────────────────────────────────

export const [PROTOCOL_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('proto')],
  LEVY_PROGRAM_ID
);

export function getBountyPDA(id: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from('b'), buf], LEVY_PROGRAM_ID);
}

export function getVaultPDA(id: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from('v'), buf], LEVY_PROGRAM_ID);
}

export function getLpClaimPDA(bountyKey: PublicKey, lpKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lc'), bountyKey.toBuffer(), lpKey.toBuffer()],
    LEVY_PROGRAM_ID
  );
}

// ─── Discriminators ──────────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

const INITIALIZE_DISC = disc('initialize');
const CREATE_BOUNTY_DISC = disc('create_bounty');
const REGISTER_CLAIM_DISC = disc('register_claim');
const COLLECT_DISC = disc('collect');
const RECLAIM_DISC = disc('reclaim');
const CANCEL_DISC = disc('cancel');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProtocolState {
  authority: PublicKey;
  feeBps: number;
  totalBounties: bigint;
  totalPaid: bigint;
  treasury: PublicKey;
  bump: number;
}

export type BountyStatus = 'Active' | 'Completed' | 'Cancelled';

export interface BountyState {
  id: bigint;
  creator: PublicKey;
  poolMint: PublicKey;
  totalDeposited: bigint;
  totalClaimed: bigint;
  rate: bigint;
  startTime: bigint;
  endTime: bigint;
  status: BountyStatus;
  bump: number;
  // derived
  pda: PublicKey;
  vaultPda: PublicKey;
  remaining: bigint;
}

export interface LpClaimState {
  bounty: PublicKey;
  lp: PublicKey;
  lastCollected: bigint;
  totalCollected: bigint;
  bump: number;
}

// ─── Deserializers ───────────────────────────────────────────────────────────

const BOUNTY_STATUSES: BountyStatus[] = ['Active', 'Completed', 'Cancelled'];

export function deserializeProtocol(data: Buffer): ProtocolState | null {
  if (data.length < 8 + 32 + 2 + 8 + 8 + 32 + 1) return null;
  let o = 8; // skip discriminator
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const feeBps = data.readUInt16LE(o); o += 2;
  const totalBounties = data.readBigUInt64LE(o); o += 8;
  const totalPaid = data.readBigUInt64LE(o); o += 8;
  const treasury = new PublicKey(data.slice(o, o + 32)); o += 32;
  const bump = data[o];
  return { authority, feeBps, totalBounties, totalPaid, treasury, bump };
}

export function deserializeBounty(data: Buffer, pda: PublicKey, vaultPda: PublicKey): BountyState | null {
  if (data.length < 8 + 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1) return null;
  let o = 8;
  const id = data.readBigUInt64LE(o); o += 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const poolMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalDeposited = data.readBigUInt64LE(o); o += 8;
  const totalClaimed = data.readBigUInt64LE(o); o += 8;
  const rate = data.readBigUInt64LE(o); o += 8;
  const startTime = data.readBigInt64LE(o); o += 8;
  const endTime = data.readBigInt64LE(o); o += 8;
  const status = BOUNTY_STATUSES[data[o]] || 'Active'; o += 1;
  const bump = data[o];
  const remaining = totalDeposited - totalClaimed;
  return { id, creator, poolMint, totalDeposited, totalClaimed, rate, startTime, endTime, status, bump, pda, vaultPda, remaining };
}

export function deserializeLpClaim(data: Buffer): LpClaimState | null {
  if (data.length < 8 + 32 + 32 + 8 + 8 + 1) return null;
  let o = 8;
  const bounty = new PublicKey(data.slice(o, o + 32)); o += 32;
  const lp = new PublicKey(data.slice(o, o + 32)); o += 32;
  const lastCollected = data.readBigInt64LE(o); o += 8;
  const totalCollected = data.readBigUInt64LE(o); o += 8;
  const bump = data[o];
  return { bounty, lp, lastCollected, totalCollected, bump };
}

// ─── Instruction Builders ────────────────────────────────────────────────────

export function buildInitializeInstruction(
  authority: PublicKey,
  treasury: PublicKey,
  feeBps: number,
): TransactionInstruction {
  const data = Buffer.alloc(10);
  INITIALIZE_DISC.copy(data, 0);
  data.writeUInt16LE(feeBps, 8);

  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildCreateBountyInstruction(
  creator: PublicKey,
  bountyId: bigint,
  poolMint: PublicKey,
  depositLamports: bigint,
  rate: bigint,
  durationSecs: bigint,
): TransactionInstruction {
  const [bounty] = getBountyPDA(bountyId);
  const [vault] = getVaultPDA(bountyId);

  // data: disc(8) + pool_mint(32) + deposit(8) + rate(8) + duration(8)
  const data = Buffer.alloc(64);
  CREATE_BOUNTY_DISC.copy(data, 0);
  poolMint.toBuffer().copy(data, 8);
  data.writeBigUInt64LE(depositLamports, 40);
  data.writeBigUInt64LE(rate, 48);
  data.writeBigInt64LE(durationSecs, 56);

  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: true },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildRegisterClaimInstruction(
  lp: PublicKey,
  bountyPda: PublicKey,
): TransactionInstruction {
  const [lpClaim] = getLpClaimPDA(bountyPda, lp);

  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: bountyPda, isSigner: false, isWritable: false },
      { pubkey: lpClaim, isSigner: false, isWritable: true },
      { pubkey: lp, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(REGISTER_CLAIM_DISC),
  });
}

export function buildCollectInstruction(
  lp: PublicKey,
  bountyId: bigint,
  bountyPda: PublicKey,
  treasury: PublicKey,
  lpTokenAccount: PublicKey,
): TransactionInstruction {
  const [vault] = getVaultPDA(bountyId);
  const [lpClaim] = getLpClaimPDA(bountyPda, lp);

  // No args — LP balance is read on-chain from lp_token_account
  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: true },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: lpClaim, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: lpTokenAccount, isSigner: false, isWritable: false },
      { pubkey: lp, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(COLLECT_DISC),
  });
}

export function buildReclaimInstruction(
  creator: PublicKey,
  bountyId: bigint,
  bountyPda: PublicKey,
): TransactionInstruction {
  const [vault] = getVaultPDA(bountyId);

  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(RECLAIM_DISC),
  });
}

export function buildCancelInstruction(
  creator: PublicKey,
  bountyId: bigint,
  bountyPda: PublicKey,
): TransactionInstruction {
  const [vault] = getVaultPDA(bountyId);

  return new TransactionInstruction({
    programId: LEVY_PROGRAM_ID,
    keys: [
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(CANCEL_DISC),
  });
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchProtocol(connection: Connection): Promise<ProtocolState | null> {
  const info = await connection.getAccountInfo(PROTOCOL_PDA);
  if (!info) return null;
  return deserializeProtocol(info.data as Buffer);
}

export async function fetchBounty(connection: Connection, id: bigint): Promise<BountyState | null> {
  const [pda] = getBountyPDA(id);
  const [vault] = getVaultPDA(id);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return deserializeBounty(info.data as Buffer, pda, vault);
}

export async function fetchAllBounties(connection: Connection, totalBounties: bigint): Promise<BountyState[]> {
  const bounties: BountyState[] = [];
  const count = Number(totalBounties);
  // Fetch in batches using getMultipleAccountsInfo
  const pdas: PublicKey[] = [];
  const vaults: PublicKey[] = [];
  for (let i = 0; i < count; i++) {
    const [pda] = getBountyPDA(BigInt(i));
    const [vault] = getVaultPDA(BigInt(i));
    pdas.push(pda);
    vaults.push(vault);
  }
  if (pdas.length === 0) return [];
  const infos = await connection.getMultipleAccountsInfo(pdas);
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    if (!info) continue;
    const b = deserializeBounty(info.data as Buffer, pdas[i], vaults[i]);
    if (b) bounties.push(b);
  }
  return bounties;
}

export async function fetchLpClaim(
  connection: Connection,
  bountyPda: PublicKey,
  lp: PublicKey,
): Promise<LpClaimState | null> {
  const [claimPda] = getLpClaimPDA(bountyPda, lp);
  const info = await connection.getAccountInfo(claimPda);
  if (!info) return null;
  return deserializeLpClaim(info.data as Buffer);
}