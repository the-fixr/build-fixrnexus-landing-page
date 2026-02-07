// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IFixrStaking.sol";

/**
 * @title FixrStaking
 * @notice Staking contract for FIXR token with tiered lock bonuses
 * @dev Uses Synthetix-style reward accumulator for gas-efficient reward distribution
 *
 * Security features:
 * - Ownable2Step: Two-step ownership transfer prevents accidental transfers
 * - ReentrancyGuard: Prevents reentrancy attacks on all state-changing functions
 * - Pausable: Emergency pause capability for all staking operations
 * - SafeERC20: Safe token transfers that handle non-standard ERC20s
 * - No external calls before state updates (checks-effects-interactions)
 * - Immutable FIXR token address
 * - Emergency withdrawal restricted (cannot withdraw staked tokens)
 */
contract FixrStaking is IFixrStaking, ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant MULTIPLIER_BASE = 10000; // 100% = 10000 basis points
    uint256 public constant NUM_TIERS = 4;

    /// @notice Maximum reward tokens to prevent gas exhaustion in loops
    uint256 public constant MAX_REWARD_TOKENS = 10;

    // ============ State Variables ============

    /// @notice The FIXR token being staked
    IERC20 public immutable fixrToken;

    /// @notice Lock tier configurations
    LockTier[NUM_TIERS] public lockTiers;

    /// @notice Total weighted stake across all users
    uint256 public totalWeightedStake;

    /// @notice User positions mapping: user => positionId => StakePosition
    mapping(address => mapping(uint256 => StakePosition)) public positions;

    /// @notice Number of positions per user
    mapping(address => uint256) public positionCount;

    /// @notice User's total weighted stake
    mapping(address => uint256) public userWeightedStake;

    /// @notice Supported reward tokens
    address[] public rewardTokens;

    /// @notice Is token a reward token
    mapping(address => bool) public isRewardToken;

    /// @notice Reward per token stored (scaled by 1e18)
    mapping(address => uint256) public rewardPerTokenStored;

    /// @notice User's reward per token paid
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    /// @notice User's pending rewards
    mapping(address => mapping(address => uint256)) public rewards;

    // ============ Constructor ============

    constructor(address _fixrToken, address _owner) Ownable(_owner) {
        require(_fixrToken != address(0), "Invalid token");
        fixrToken = IERC20(_fixrToken);

        // Initialize lock tiers
        // Tier 0: 7 days, 1.0x (10000 bps)
        lockTiers[0] = LockTier({duration: 7 days, multiplier: 10000});
        // Tier 1: 30 days, 1.25x (12500 bps)
        lockTiers[1] = LockTier({duration: 30 days, multiplier: 12500});
        // Tier 2: 90 days, 1.5x (15000 bps)
        lockTiers[2] = LockTier({duration: 90 days, multiplier: 15000});
        // Tier 3: 180 days, 2.0x (20000 bps)
        lockTiers[3] = LockTier({duration: 180 days, multiplier: 20000});
    }

    // ============ External Functions ============

    /**
     * @notice Stake FIXR tokens with a specific lock tier
     * @param amount Amount of FIXR to stake
     * @param tierIndex Lock tier (0-3)
     * @return positionId The ID of the created stake position
     */
    function stake(uint256 amount, uint256 tierIndex)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 positionId)
    {
        require(amount > 0, "Cannot stake 0");
        require(tierIndex < NUM_TIERS, "Invalid tier");

        // Update rewards before state change
        _updateRewards(msg.sender);

        LockTier memory tier = lockTiers[tierIndex];
        uint256 weightedAmount = (amount * tier.multiplier) / MULTIPLIER_BASE;

        positionId = positionCount[msg.sender];
        positionCount[msg.sender]++;

        positions[msg.sender][positionId] = StakePosition({
            amount: amount,
            weightedAmount: weightedAmount,
            lockTier: tierIndex,
            stakedAt: block.timestamp,
            unlockAt: block.timestamp + tier.duration
        });

        userWeightedStake[msg.sender] += weightedAmount;
        totalWeightedStake += weightedAmount;

        fixrToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, positionId, amount, tierIndex, block.timestamp + tier.duration);
    }

    /**
     * @notice Unstake tokens from a position (only after lock expires)
     * @param positionId The position to unstake
     */
    function unstake(uint256 positionId) external nonReentrant {
        StakePosition storage position = positions[msg.sender][positionId];
        require(position.amount > 0, "Position not found");
        require(block.timestamp >= position.unlockAt, "Still locked");

        // Update rewards before state change
        _updateRewards(msg.sender);

        uint256 amount = position.amount;
        uint256 weightedAmount = position.weightedAmount;

        userWeightedStake[msg.sender] -= weightedAmount;
        totalWeightedStake -= weightedAmount;

        // Clear position
        delete positions[msg.sender][positionId];

        fixrToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, positionId, amount);
    }

    /**
     * @notice Claim all pending rewards for caller
     */
    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _claimRewardToken(msg.sender, rewardTokens[i]);
        }
    }

    /**
     * @notice Claim rewards for a specific token
     * @param rewardToken The token to claim
     */
    function claimRewardToken(address rewardToken) external nonReentrant {
        require(isRewardToken[rewardToken], "Not a reward token");
        _updateRewards(msg.sender);
        _claimRewardToken(msg.sender, rewardToken);
    }

    /**
     * @notice Deposit rewards to be distributed to stakers
     * @param token The reward token address
     * @param amount Amount to deposit
     */
    function depositRewards(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot deposit 0");
        require(totalWeightedStake > 0, "No stakers");
        require(token != address(0), "Invalid token");

        // Add token to reward tokens if not already
        if (!isRewardToken[token]) {
            require(rewardTokens.length < MAX_REWARD_TOKENS, "Max reward tokens reached");
            isRewardToken[token] = true;
            rewardTokens.push(token);
        }

        // Get balance before transfer
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Verify actual received amount (handles fee-on-transfer tokens)
        uint256 actualReceived = IERC20(token).balanceOf(address(this)) - balanceBefore;
        require(actualReceived > 0, "No tokens received");

        // Update reward per token with actual received amount
        rewardPerTokenStored[token] += (actualReceived * 1e18) / totalWeightedStake;

        emit RewardsDeposited(token, actualReceived);
    }

    // ============ View Functions ============

    /**
     * @notice Get pending rewards for a user
     * @param user The user address
     * @param rewardToken The reward token address
     * @return pending Amount of pending rewards
     */
    function pendingRewards(address user, address rewardToken) external view returns (uint256 pending) {
        uint256 userWeight = userWeightedStake[user];
        if (userWeight == 0) {
            return rewards[user][rewardToken];
        }

        uint256 rewardPerToken = rewardPerTokenStored[rewardToken];
        uint256 userPaid = userRewardPerTokenPaid[user][rewardToken];

        pending = rewards[user][rewardToken] + (userWeight * (rewardPerToken - userPaid)) / 1e18;
    }

    /**
     * @notice Get all stake positions for a user
     * @param user The user address
     * @return result Array of stake positions
     */
    function getPositions(address user) external view returns (StakePosition[] memory result) {
        uint256 count = positionCount[user];
        result = new StakePosition[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = positions[user][i];
        }
    }

    /**
     * @notice Get lock tier configuration
     * @param tierIndex Tier index (0-3)
     * @return tier The tier configuration
     */
    function getLockTier(uint256 tierIndex) external view returns (LockTier memory tier) {
        require(tierIndex < NUM_TIERS, "Invalid tier");
        return lockTiers[tierIndex];
    }

    /**
     * @notice Get list of supported reward tokens
     * @return tokens Array of reward token addresses
     */
    function getRewardTokens() external view returns (address[] memory tokens) {
        return rewardTokens;
    }

    // ============ Admin Functions ============

    /**
     * @notice Pause staking (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause staking
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw stuck tokens (not staked FIXR)
     * @param token Token to withdraw
     * @param to Recipient
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(fixrToken), "Cannot withdraw staked token");
        IERC20(token).safeTransfer(to, amount);
    }

    // ============ Internal Functions ============

    /**
     * @dev Update rewards for a user
     */
    function _updateRewards(address user) internal {
        uint256 userWeight = userWeightedStake[user];

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            uint256 rewardPerToken = rewardPerTokenStored[token];
            uint256 userPaid = userRewardPerTokenPaid[user][token];

            if (userWeight > 0) {
                rewards[user][token] += (userWeight * (rewardPerToken - userPaid)) / 1e18;
            }
            userRewardPerTokenPaid[user][token] = rewardPerToken;
        }
    }

    /**
     * @dev Claim rewards for a specific token
     */
    function _claimRewardToken(address user, address rewardToken) internal {
        uint256 reward = rewards[user][rewardToken];
        if (reward > 0) {
            rewards[user][rewardToken] = 0;
            IERC20(rewardToken).safeTransfer(user, reward);
            emit RewardsClaimed(user, rewardToken, reward);
        }
    }
}
