import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// Program addresses
export const CLAWG_STAKING_PROGRAM_ID = new PublicKey('Cbhx5F1fVJG83xkqse88rxatrj73UW9Lz9G7awBrW8WZ');
export const CLAWG_MINT = new PublicKey('HQQ7wTkME1LskkhLb6zRi2rsSXNBBQb4toHzbaNbvBjF');

// PDAs
export const [STATE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('state')],
  CLAWG_STAKING_PROGRAM_ID
);

export const [CLAWG_VAULT] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), CLAWG_MINT.toBuffer()],
  CLAWG_STAKING_PROGRAM_ID
);

export const [WSOL_VAULT] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), NATIVE_MINT.toBuffer()],
  CLAWG_STAKING_PROGRAM_ID
);

// Anchor discriminators (first 8 bytes of sha256("global:<instruction_name>"))
const STAKE_DISCRIMINATOR = new Uint8Array([206, 176, 202, 18, 200, 209, 179, 108]);
const UNSTAKE_DISCRIMINATOR = new Uint8Array([90, 95, 107, 42, 205, 124, 50, 225]);
const CLAIM_ALL_REWARDS_DISCRIMINATOR = new Uint8Array([132, 203, 246, 173, 206, 240, 85, 120]);
const DISTRIBUTE_CLAWG_DISCRIMINATOR = new Uint8Array([155, 179, 46, 190, 3, 87, 17, 55]);
const DISTRIBUTE_SOL_DISCRIMINATOR = new Uint8Array([234, 85, 98, 176, 165, 8, 133, 95]);

// Lock tiers (matching the contract)
export const LOCK_TIERS = [
  { name: '1 Day', multiplier: '0.5x', duration: 86400, index: 0 },
  { name: '7 Days', multiplier: '1.0x', duration: 604800, index: 1 },
  { name: '30 Days', multiplier: '1.15x', duration: 2592000, index: 2 },
  { name: '60 Days', multiplier: '1.35x', duration: 5184000, index: 3 },
  { name: '90 Days', multiplier: '1.5x', duration: 7776000, index: 4 },
  { name: '180 Days', multiplier: '2.0x', duration: 15552000, index: 5 },
  { name: '365 Days', multiplier: '3.0x', duration: 31536000, index: 6 },
];

// Helper to get user PDA
export function getUserPDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user'), userPubkey.toBuffer()],
    CLAWG_STAKING_PROGRAM_ID
  );
}

// Deserialize StakingState from account data
export interface StakingState {
  authority: PublicKey;
  clawgMint: PublicKey;
  wsolMint: PublicKey;
  totalWeightedStake: bigint;
  totalStakedAmount: bigint;
  totalFeesDistributed: bigint;
  rewardTokens: PublicKey[];
  rewardVaults: PublicKey[];
  rewardTokenCount: number;
  rewardPerTokenStored: bigint[];
  isPaused: boolean;
  bump: number;
}

export function deserializeStakingState(data: Buffer): StakingState | null {
  if (data.length < 8) return null;

  // Skip 8-byte discriminator
  let offset = 8;

  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const clawgMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const wsolMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const totalWeightedStake = data.readBigUInt64LE(offset);
  offset += 8;

  const totalStakedAmount = data.readBigUInt64LE(offset);
  offset += 8;

  const totalFeesDistributed = data.readBigUInt64LE(offset);
  offset += 8;

  // MAX_REWARD_TOKENS = 2
  const rewardTokens: PublicKey[] = [];
  for (let i = 0; i < 2; i++) {
    rewardTokens.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  const rewardVaults: PublicKey[] = [];
  for (let i = 0; i < 2; i++) {
    rewardVaults.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  const rewardTokenCount = data.readUInt8(offset);
  offset += 1;

  const rewardPerTokenStored: bigint[] = [];
  for (let i = 0; i < 2; i++) {
    rewardPerTokenStored.push(data.readBigUInt64LE(offset));
    offset += 8;
  }

  const isPaused = data.readUInt8(offset) === 1;
  offset += 1;

  const bump = data.readUInt8(offset);

  return {
    authority,
    clawgMint,
    wsolMint,
    totalWeightedStake,
    totalStakedAmount,
    totalFeesDistributed,
    rewardTokens,
    rewardVaults,
    rewardTokenCount,
    rewardPerTokenStored,
    isPaused,
    bump,
  };
}

// StakePosition struct
export interface StakePosition {
  amount: bigint;
  weightedAmount: bigint;
  lockTier: number;
  stakedAt: bigint;
  unlockAt: bigint;
  isActive: boolean;
}

// UserStakingAccount struct
export interface UserStakingAccount {
  owner: PublicKey;
  totalWeightedStake: bigint;
  earliestClaimTime: bigint;
  positionCount: number;
  positions: StakePosition[];
  rewardPerTokenPaid: bigint[];
  pendingRewards: bigint[];
}

export function deserializeUserAccount(data: Buffer): UserStakingAccount | null {
  if (data.length < 8) return null;

  // Skip 8-byte discriminator
  let offset = 8;

  const owner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const totalWeightedStake = data.readBigUInt64LE(offset);
  offset += 8;

  const earliestClaimTime = data.readBigInt64LE(offset);
  offset += 8;

  const positionCount = data.readUInt8(offset);
  offset += 1;

  // MAX_POSITIONS = 5
  const positions: StakePosition[] = [];
  for (let i = 0; i < 5; i++) {
    const amount = data.readBigUInt64LE(offset);
    offset += 8;
    const weightedAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const lockTier = data.readUInt8(offset);
    offset += 1;
    const stakedAt = data.readBigInt64LE(offset);
    offset += 8;
    const unlockAt = data.readBigInt64LE(offset);
    offset += 8;
    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    positions.push({ amount, weightedAmount, lockTier, stakedAt, unlockAt, isActive });
  }

  // MAX_REWARD_TOKENS = 2
  const rewardPerTokenPaid: bigint[] = [];
  for (let i = 0; i < 2; i++) {
    rewardPerTokenPaid.push(data.readBigUInt64LE(offset));
    offset += 8;
  }

  const pendingRewards: bigint[] = [];
  for (let i = 0; i < 2; i++) {
    pendingRewards.push(data.readBigUInt64LE(offset));
    offset += 8;
  }

  return {
    owner,
    totalWeightedStake,
    earliestClaimTime,
    positionCount,
    positions,
    rewardPerTokenPaid,
    pendingRewards,
  };
}

// Build stake instruction
export async function buildStakeInstruction(
  user: PublicKey,
  amount: bigint,
  tierIndex: number,
): Promise<TransactionInstruction> {
  const [userPDA] = getUserPDA(user);
  const userTokenAccount = await getAssociatedTokenAddress(CLAWG_MINT, user);

  // instruction data: discriminator (8) + amount (8) + tierIndex (1)
  const data = new Uint8Array(17);
  data.set(STAKE_DISCRIMINATOR, 0);
  new DataView(data.buffer).setBigUint64(8, amount, true);
  data[16] = tierIndex;

  return new TransactionInstruction({
    keys: [
      { pubkey: STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: userPDA, isSigner: false, isWritable: true },
      { pubkey: CLAWG_VAULT, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CLAWG_STAKING_PROGRAM_ID,
    data: Buffer.from(data),
  });
}

// Build unstake instruction
export async function buildUnstakeInstruction(
  user: PublicKey,
  positionId: number,
): Promise<TransactionInstruction> {
  const [userPDA] = getUserPDA(user);
  const userTokenAccount = await getAssociatedTokenAddress(CLAWG_MINT, user);

  // instruction data: discriminator (8) + positionId (1)
  const data = new Uint8Array(9);
  data.set(UNSTAKE_DISCRIMINATOR, 0);
  data[8] = positionId;

  return new TransactionInstruction({
    keys: [
      { pubkey: STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: userPDA, isSigner: false, isWritable: true },
      { pubkey: CLAWG_VAULT, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CLAWG_STAKING_PROGRAM_ID,
    data: Buffer.from(data),
  });
}

// Build claim rewards instruction
export async function buildClaimRewardsInstruction(
  user: PublicKey,
): Promise<TransactionInstruction> {
  const [userPDA] = getUserPDA(user);
  const userClawgAccount = await getAssociatedTokenAddress(CLAWG_MINT, user);
  const userWsolAccount = await getAssociatedTokenAddress(NATIVE_MINT, user);

  return new TransactionInstruction({
    keys: [
      { pubkey: STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: userPDA, isSigner: false, isWritable: true },
      { pubkey: CLAWG_VAULT, isSigner: false, isWritable: true },
      { pubkey: WSOL_VAULT, isSigner: false, isWritable: true },
      { pubkey: userClawgAccount, isSigner: false, isWritable: true },
      { pubkey: userWsolAccount, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CLAWG_STAKING_PROGRAM_ID,
    data: Buffer.from(CLAIM_ALL_REWARDS_DISCRIMINATOR),
  });
}

// Build distribute CLAWG fees instruction
export async function buildDistributeClawgInstruction(
  authority: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  const feeSource = await getAssociatedTokenAddress(CLAWG_MINT, authority);

  // instruction data: discriminator (8) + amount (8)
  const data = new Uint8Array(16);
  data.set(DISTRIBUTE_CLAWG_DISCRIMINATOR, 0);
  new DataView(data.buffer).setBigUint64(8, amount, true);

  return new TransactionInstruction({
    keys: [
      { pubkey: STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: CLAWG_VAULT, isSigner: false, isWritable: true },
      { pubkey: feeSource, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CLAWG_STAKING_PROGRAM_ID,
    data: Buffer.from(data),
  });
}

// Build distribute SOL fees instruction
export async function buildDistributeSolInstruction(
  authority: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  // instruction data: discriminator (8) + amount (8)
  const data = new Uint8Array(16);
  data.set(DISTRIBUTE_SOL_DISCRIMINATOR, 0);
  new DataView(data.buffer).setBigUint64(8, amount, true);

  return new TransactionInstruction({
    keys: [
      { pubkey: STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: WSOL_VAULT, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CLAWG_STAKING_PROGRAM_ID,
    data: Buffer.from(data),
  });
}

// Fetch staking state
export async function fetchStakingState(connection: Connection): Promise<StakingState | null> {
  const accountInfo = await connection.getAccountInfo(STATE_PDA);
  if (!accountInfo) return null;
  return deserializeStakingState(accountInfo.data as Buffer);
}

// Fetch user account
export async function fetchUserAccount(connection: Connection, user: PublicKey): Promise<UserStakingAccount | null> {
  const [userPDA] = getUserPDA(user);
  const accountInfo = await connection.getAccountInfo(userPDA);
  if (!accountInfo) return null;
  return deserializeUserAccount(accountInfo.data as Buffer);
}