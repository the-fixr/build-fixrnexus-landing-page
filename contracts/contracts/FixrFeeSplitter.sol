// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IFixrFeeSplitter.sol";
import "./interfaces/IFixrStaking.sol";

/// @notice Interface for WETH
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

/**
 * @title FixrFeeSplitter
 * @notice Receives trading fees and splits them 70/30 between stakers and treasury
 * @dev Set this contract as the fee recipient when launching FIXR token via Clanker
 *
 * Security features:
 * - Ownable2Step: Two-step ownership transfer prevents accidental transfers
 * - ReentrancyGuard: Prevents reentrancy attacks
 * - SafeERC20: Safe token transfers
 * - Timelock on critical config changes (staking contract, treasury)
 * - Minimum distribution threshold to prevent dust attacks
 * - WETH cannot be removed from whitelist
 * - Emergency withdrawal only by owner
 */
contract FixrFeeSplitter is IFixrFeeSplitter, ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Stakers get 70% of fees (7000 basis points)
    uint256 public constant STAKERS_SHARE_BPS = 7000;

    /// @notice Treasury gets 30% of fees (3000 basis points)
    uint256 public constant TREASURY_SHARE_BPS = 3000;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice WETH address on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Timelock delay for critical operations (48 hours)
    uint256 public constant TIMELOCK_DELAY = 48 hours;

    /// @notice Minimum balance to distribute (prevents dust attacks)
    uint256 public constant MIN_DISTRIBUTION = 1e15; // 0.001 tokens (assuming 18 decimals)

    // ============ State Variables ============

    /// @notice The staking contract that receives staker rewards
    address public stakingContract;

    /// @notice Treasury address that receives treasury share
    address public treasury;

    /// @notice Whitelisted reward tokens
    address[] public whitelistedTokens;

    /// @notice Is token whitelisted
    mapping(address => bool) public tokenWhitelist;

    /// @notice Pending staking contract change
    address public pendingStakingContract;
    uint256 public stakingContractChangeTime;

    /// @notice Pending treasury change
    address public pendingTreasury;
    uint256 public treasuryChangeTime;

    // ============ Events ============

    event StakingContractChangeQueued(address indexed newStaking, uint256 executeTime);
    event TreasuryChangeQueued(address indexed newTreasury, uint256 executeTime);

    // ============ Constructor ============

    constructor(
        address _stakingContract,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        require(_stakingContract != address(0), "Invalid staking");
        require(_treasury != address(0), "Invalid treasury");

        stakingContract = _stakingContract;
        treasury = _treasury;

        // Whitelist WETH by default
        tokenWhitelist[WETH] = true;
        whitelistedTokens.push(WETH);

        emit TokenWhitelisted(WETH);
    }

    // ============ Receive ETH ============

    /**
     * @notice Receive ETH and wrap to WETH
     */
    receive() external payable {
        if (msg.value > 0) {
            IWETH(WETH).deposit{value: msg.value}();
        }
    }

    // ============ External Functions ============

    /**
     * @notice Distribute all whitelisted token fees
     * @dev Called monthly by admin
     */
    function distributeAll() external nonReentrant onlyOwner {
        for (uint256 i = 0; i < whitelistedTokens.length; i++) {
            _distribute(whitelistedTokens[i]);
        }
    }

    /**
     * @notice Distribute fees for a specific token
     * @param token The token to distribute
     */
    function distribute(address token) external nonReentrant onlyOwner {
        require(tokenWhitelist[token], "Token not whitelisted");
        _distribute(token);
    }

    /**
     * @notice Add token to whitelist
     * @param token Token address to whitelist
     */
    function addToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!tokenWhitelist[token], "Already whitelisted");

        tokenWhitelist[token] = true;
        whitelistedTokens.push(token);

        emit TokenWhitelisted(token);
    }

    /**
     * @notice Remove token from whitelist
     * @param token Token address to remove
     */
    function removeToken(address token) external onlyOwner {
        require(tokenWhitelist[token], "Not whitelisted");
        require(token != WETH, "Cannot remove WETH");

        tokenWhitelist[token] = false;

        // Remove from array
        for (uint256 i = 0; i < whitelistedTokens.length; i++) {
            if (whitelistedTokens[i] == token) {
                whitelistedTokens[i] = whitelistedTokens[whitelistedTokens.length - 1];
                whitelistedTokens.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    /**
     * @notice Queue a staking contract update (timelock)
     * @param newStaking New staking contract address
     */
    function queueStakingContractChange(address newStaking) external onlyOwner {
        require(newStaking != address(0), "Invalid address");
        require(newStaking != stakingContract, "Same address");
        pendingStakingContract = newStaking;
        stakingContractChangeTime = block.timestamp + TIMELOCK_DELAY;
        emit StakingContractChangeQueued(newStaking, stakingContractChangeTime);
    }

    /**
     * @notice Execute queued staking contract update after timelock
     */
    function setStakingContract(address newStaking) external onlyOwner {
        require(newStaking == pendingStakingContract, "Not queued");
        require(block.timestamp >= stakingContractChangeTime, "Timelock active");
        require(stakingContractChangeTime != 0, "Not queued");

        address oldStaking = stakingContract;
        stakingContract = newStaking;
        pendingStakingContract = address(0);
        stakingContractChangeTime = 0;

        emit StakingContractUpdated(oldStaking, newStaking);
    }

    /**
     * @notice Cancel pending staking contract change
     */
    function cancelStakingContractChange() external onlyOwner {
        pendingStakingContract = address(0);
        stakingContractChangeTime = 0;
    }

    /**
     * @notice Queue a treasury update (timelock)
     * @param newTreasury New treasury address
     */
    function queueTreasuryChange(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        require(newTreasury != treasury, "Same address");
        pendingTreasury = newTreasury;
        treasuryChangeTime = block.timestamp + TIMELOCK_DELAY;
        emit TreasuryChangeQueued(newTreasury, treasuryChangeTime);
    }

    /**
     * @notice Execute queued treasury update after timelock
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury == pendingTreasury, "Not queued");
        require(block.timestamp >= treasuryChangeTime, "Timelock active");
        require(treasuryChangeTime != 0, "Not queued");

        address oldTreasury = treasury;
        treasury = newTreasury;
        pendingTreasury = address(0);
        treasuryChangeTime = 0;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Cancel pending treasury change
     */
    function cancelTreasuryChange() external onlyOwner {
        pendingTreasury = address(0);
        treasuryChangeTime = 0;
    }

    // ============ View Functions ============

    /**
     * @notice Get the stakers share in basis points (7000 = 70%)
     */
    function stakersShareBps() external pure returns (uint256) {
        return STAKERS_SHARE_BPS;
    }

    /**
     * @notice Check if a token is whitelisted
     */
    function isWhitelisted(address token) external view returns (bool) {
        return tokenWhitelist[token];
    }

    /**
     * @notice Get all whitelisted tokens
     */
    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokens;
    }

    /**
     * @notice Get balance of a whitelisted token held by this contract
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============ Internal Functions ============

    /**
     * @dev Distribute a token's balance
     */
    function _distribute(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));

        // Skip if below minimum threshold (prevents dust attacks and wasted gas)
        if (balance < MIN_DISTRIBUTION) return;

        uint256 stakersShare = (balance * STAKERS_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 treasuryShare = balance - stakersShare;

        // Approve and deposit to staking contract
        // Note: We use forceApprove to handle tokens that require zero approval first
        if (stakersShare > 0) {
            IERC20(token).forceApprove(stakingContract, stakersShare);
            IFixrStaking(stakingContract).depositRewards(token, stakersShare);
        }

        // Transfer treasury share
        if (treasuryShare > 0) {
            IERC20(token).safeTransfer(treasury, treasuryShare);
        }

        emit FeesDistributed(token, balance, stakersShare, treasuryShare);
    }

    /**
     * @notice Emergency withdraw stuck tokens
     * @param token Token to withdraw
     * @param to Recipient
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
