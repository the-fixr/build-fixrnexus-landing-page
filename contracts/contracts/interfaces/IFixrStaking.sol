// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFixrStaking {
    /// @notice Lock tier information
    struct LockTier {
        uint256 duration;    // Lock duration in seconds
        uint256 multiplier;  // Multiplier in basis points (10000 = 1.0x)
    }

    /// @notice Individual stake position
    struct StakePosition {
        uint256 amount;          // Amount of FIXR staked
        uint256 weightedAmount;  // Amount * multiplier for reward calculation
        uint256 lockTier;        // Which tier (0-3)
        uint256 stakedAt;        // Timestamp when staked
        uint256 unlockAt;        // Timestamp when can unstake
    }

    /// @notice Emitted when user stakes tokens
    event Staked(
        address indexed user,
        uint256 indexed positionId,
        uint256 amount,
        uint256 lockTier,
        uint256 unlockAt
    );

    /// @notice Emitted when user unstakes tokens
    event Unstaked(
        address indexed user,
        uint256 indexed positionId,
        uint256 amount
    );

    /// @notice Emitted when rewards are deposited
    event RewardsDeposited(address indexed token, uint256 amount);

    /// @notice Emitted when user claims rewards
    event RewardsClaimed(address indexed user, address indexed token, uint256 amount);

    /// @notice Stake FIXR tokens with a specific lock tier
    /// @param amount Amount of FIXR to stake
    /// @param tierIndex Lock tier (0-3)
    /// @return positionId The ID of the created stake position
    function stake(uint256 amount, uint256 tierIndex) external returns (uint256 positionId);

    /// @notice Unstake tokens from a position (only after lock expires)
    /// @param positionId The position to unstake
    function unstake(uint256 positionId) external;

    /// @notice Claim all pending rewards for caller
    function claimRewards() external;

    /// @notice Claim rewards for a specific token
    /// @param rewardToken The token to claim
    function claimRewardToken(address rewardToken) external;

    /// @notice Deposit rewards to be distributed to stakers
    /// @param token The reward token address
    /// @param amount Amount to deposit
    function depositRewards(address token, uint256 amount) external;

    /// @notice Get pending rewards for a user
    /// @param user The user address
    /// @param rewardToken The reward token address
    /// @return pending Amount of pending rewards
    function pendingRewards(address user, address rewardToken) external view returns (uint256 pending);

    /// @notice Get all stake positions for a user
    /// @param user The user address
    /// @return positions Array of stake positions
    function getPositions(address user) external view returns (StakePosition[] memory positions);

    /// @notice Get total weighted stake in the system
    /// @return total Total weighted stake
    function totalWeightedStake() external view returns (uint256 total);

    /// @notice Get user's total weighted stake
    /// @param user The user address
    /// @return weighted User's total weighted stake
    function userWeightedStake(address user) external view returns (uint256 weighted);

    /// @notice Get lock tier configuration
    /// @param tierIndex Tier index (0-3)
    /// @return tier The tier configuration
    function getLockTier(uint256 tierIndex) external view returns (LockTier memory tier);

    /// @notice Get list of supported reward tokens
    /// @return tokens Array of reward token addresses
    function getRewardTokens() external view returns (address[] memory tokens);
}
