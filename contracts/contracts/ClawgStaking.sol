// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
}

contract ClawgStaking is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 public constant MULTIPLIER_BASE = 10000;
    uint256 public constant NUM_TIERS = 7;
    uint256 public constant MAX_REWARD_TOKENS = 10;
    uint256 public constant CLAIM_DELAY = 1 hours;

    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant CLAWG = 0x06A127f0b53F83dD5d94E83D96B55a279705bB07;

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

    IERC20 public immutable clawgToken;
    LockTier[NUM_TIERS] public lockTiers;
    uint256 public totalWeightedStake;
    uint256 public totalStakedAmount;

    mapping(address => mapping(uint256 => StakePosition)) public positions;
    mapping(address => uint256) public positionCount;
    mapping(address => uint256) public userWeightedStake;

    address[] public rewardTokens;
    mapping(address => bool) public isRewardToken;
    mapping(address => uint256) public rewardPerTokenStored;
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public rewards;
    mapping(address => uint256) public expectedRewardBalance;
    mapping(address => uint256) public earliestClaimTime;

    constructor(address _clawgToken, address _owner) Ownable(_owner) {
        require(_clawgToken != address(0), "Invalid token");
        clawgToken = IERC20(_clawgToken);

        lockTiers[0] = LockTier({duration: 1 days,   multiplier: 5000});
        lockTiers[1] = LockTier({duration: 7 days,   multiplier: 10000});
        lockTiers[2] = LockTier({duration: 30 days,  multiplier: 11500});
        lockTiers[3] = LockTier({duration: 60 days,  multiplier: 13500});
        lockTiers[4] = LockTier({duration: 90 days,  multiplier: 15000});
        lockTiers[5] = LockTier({duration: 180 days, multiplier: 20000});
        lockTiers[6] = LockTier({duration: 365 days, multiplier: 30000});

        isRewardToken[WETH] = true;
        rewardTokens.push(WETH);

        isRewardToken[_clawgToken] = true;
        rewardTokens.push(_clawgToken);
    }

    receive() external payable {
        if (msg.value > 0) {
            IWETH(WETH).deposit{value: msg.value}();
            emit ETHReceived(msg.value);
        }
    }

    function stake(uint256 amount, uint256 tierIndex)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 positionId)
    {
        require(amount > 0, "Cannot stake 0");
        require(tierIndex < NUM_TIERS, "Invalid tier");

        _syncFees();
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
        totalStakedAmount += amount;

        uint256 newClaimTime = block.timestamp + CLAIM_DELAY;
        if (newClaimTime > earliestClaimTime[msg.sender]) {
            earliestClaimTime[msg.sender] = newClaimTime;
        }

        clawgToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, positionId, amount, tierIndex, block.timestamp + tier.duration);
    }

    function unstake(uint256 positionId) external nonReentrant {
        StakePosition storage position = positions[msg.sender][positionId];
        require(position.amount > 0, "Position not found");
        require(block.timestamp >= position.unlockAt, "Still locked");

        _syncFees();
        _updateRewards(msg.sender);

        uint256 amount = position.amount;
        uint256 weightedAmount = position.weightedAmount;

        userWeightedStake[msg.sender] -= weightedAmount;
        totalWeightedStake -= weightedAmount;
        totalStakedAmount -= amount;

        delete positions[msg.sender][positionId];

        clawgToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, positionId, amount);
    }

    function claimRewards() external nonReentrant {
        require(block.timestamp >= earliestClaimTime[msg.sender], "Claim delay not passed");
        _syncFees();
        _updateRewards(msg.sender);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _claimRewardToken(msg.sender, rewardTokens[i]);
        }
    }

    function claimRewardToken(address rewardToken) external nonReentrant {
        require(block.timestamp >= earliestClaimTime[msg.sender], "Claim delay not passed");
        require(isRewardToken[rewardToken], "Not a reward token");
        _syncFees();
        _updateRewards(msg.sender);
        _claimRewardToken(msg.sender, rewardToken);
    }

    function syncFees() external nonReentrant {
        _syncFees();
    }

    function addRewardToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!isRewardToken[token], "Already added");
        require(rewardTokens.length < MAX_REWARD_TOKENS, "Max tokens reached");

        isRewardToken[token] = true;
        rewardTokens.push(token);
    }

    function pendingRewards(address user, address rewardToken) external view returns (uint256 pending) {
        uint256 userWeight = userWeightedStake[user];
        if (userWeight == 0) {
            return rewards[user][rewardToken];
        }

        uint256 currentRewardPerToken = rewardPerTokenStored[rewardToken];

        if (totalWeightedStake > 0) {
            uint256 unsyncedFees = _getUnsyncedFees(rewardToken);
            if (unsyncedFees > 0) {
                currentRewardPerToken += (unsyncedFees * 1e18) / totalWeightedStake;
            }
        }

        uint256 userPaid = userRewardPerTokenPaid[user][rewardToken];
        pending = rewards[user][rewardToken] + (userWeight * (currentRewardPerToken - userPaid)) / 1e18;
    }

    function getUnsyncedFees(address token) external view returns (uint256) {
        return _getUnsyncedFees(token);
    }

    function getPositions(address user) external view returns (StakePosition[] memory result) {
        uint256 count = positionCount[user];
        result = new StakePosition[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = positions[user][i];
        }
    }

    function getLockTier(uint256 tierIndex) external view returns (LockTier memory tier) {
        require(tierIndex < NUM_TIERS, "Invalid tier");
        return lockTiers[tierIndex];
    }

    function getAllTiers() external view returns (LockTier[] memory tiers) {
        tiers = new LockTier[](NUM_TIERS);
        for (uint256 i = 0; i < NUM_TIERS; i++) {
            tiers[i] = lockTiers[i];
        }
    }

    function getRewardTokens() external view returns (address[] memory tokens) {
        return rewardTokens;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(clawgToken), "Cannot withdraw staking token");
        require(!isRewardToken[token], "Cannot withdraw reward token");
        IERC20(token).safeTransfer(to, amount);
    }

    function _syncFees() internal {
        if (totalWeightedStake == 0) return;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            uint256 newFees = _getUnsyncedFees(token);

            if (newFees > 0) {
                rewardPerTokenStored[token] += (newFees * 1e18) / totalWeightedStake;
                expectedRewardBalance[token] += newFees;
                emit FeesReceived(token, newFees);
            }
        }
    }

    function _getUnsyncedFees(address token) internal view returns (uint256) {
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        uint256 expected = expectedRewardBalance[token];

        if (token == address(clawgToken)) {
            expected += totalStakedAmount;
        }

        if (currentBalance > expected) {
            return currentBalance - expected;
        }
        return 0;
    }

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

    function _claimRewardToken(address user, address rewardToken) internal {
        uint256 reward = rewards[user][rewardToken];
        if (reward > 0) {
            rewards[user][rewardToken] = 0;
            expectedRewardBalance[rewardToken] -= reward;
            IERC20(rewardToken).safeTransfer(user, reward);
            emit RewardsClaimed(user, rewardToken, reward);
        }
    }
}
