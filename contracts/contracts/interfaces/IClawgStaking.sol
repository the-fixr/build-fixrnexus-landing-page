// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IClawgStaking {
    struct LockTier {
        uint256 duration;
        uint256 multiplier;
    }

    struct StakePosition {
        uint256 amount;
        uint256 weightedAmount;
        uint256 lockTier;
        uint256 stakedAt;
        uint256 unlockAt;
    }

    event Staked(address indexed user, uint256 indexed positionId, uint256 amount, uint256 lockTier, uint256 unlockAt);
    event Unstaked(address indexed user, uint256 indexed positionId, uint256 amount);
    event RewardsClaimed(address indexed user, address indexed token, uint256 amount);
    event FeesReceived(address indexed token, uint256 amount);
    event ETHReceived(uint256 amount);

    function stake(uint256 amount, uint256 tierIndex) external returns (uint256 positionId);
    function unstake(uint256 positionId) external;
    function claimRewards() external;
    function claimRewardToken(address rewardToken) external;
    function syncFees() external;
    function addRewardToken(address token) external;
    function pendingRewards(address user, address rewardToken) external view returns (uint256 pending);
    function getUnsyncedFees(address token) external view returns (uint256);
    function getPositions(address user) external view returns (StakePosition[] memory positions);
    function totalWeightedStake() external view returns (uint256 total);
    function totalStakedAmount() external view returns (uint256 amount);
    function userWeightedStake(address user) external view returns (uint256 weighted);
    function getLockTier(uint256 tierIndex) external view returns (LockTier memory tier);
    function getAllTiers() external view returns (LockTier[] memory tiers);
    function getRewardTokens() external view returns (address[] memory tokens);
    function expectedRewardBalance(address token) external view returns (uint256);
    function earliestClaimTime(address user) external view returns (uint256);
    function CLAIM_DELAY() external view returns (uint256);
}
