// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeedsCredits
 * @notice Prepaid credit system for FEEDS API usage
 * @dev Users deposit ETH, owner deducts based on off-chain API usage tracking
 */
contract FeedsCredits is Ownable, ReentrancyGuard {

    // User balances in wei
    mapping(address => uint256) public balances;

    // Total deposits (for accounting)
    uint256 public totalDeposits;

    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event UsageDeducted(address indexed user, uint256 amount, uint256 newBalance, string reason);
    event OwnerWithdrew(uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Deposit ETH to your credit balance
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");

        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;

        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }

    /**
     * @notice Withdraw unused credits
     * @param amount Amount in wei to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Deduct credits for API usage (owner only)
     * @param user User address to deduct from
     * @param amount Amount in wei to deduct
     * @param reason Description of usage (e.g., "API calls 2024-01-15")
     */
    function deductUsage(address user, uint256 amount, string calldata reason) external onlyOwner {
        require(balances[user] >= amount, "User has insufficient balance");

        balances[user] -= amount;

        emit UsageDeducted(user, amount, balances[user], reason);
    }

    /**
     * @notice Batch deduct usage for multiple users (gas efficient)
     * @param users Array of user addresses
     * @param amounts Array of amounts to deduct
     * @param reason Shared reason for all deductions
     */
    function batchDeductUsage(
        address[] calldata users,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyOwner {
        require(users.length == amounts.length, "Array length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            if (balances[users[i]] >= amounts[i]) {
                balances[users[i]] -= amounts[i];
                emit UsageDeducted(users[i], amounts[i], balances[users[i]], reason);
            }
            // Skip users with insufficient balance rather than reverting
        }
    }

    /**
     * @notice Owner withdraws collected fees
     * @param amount Amount to withdraw
     */
    function ownerWithdraw(uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Insufficient contract balance");

        (bool success, ) = owner().call{value: amount}("");
        require(success, "Transfer failed");

        emit OwnerWithdrew(amount);
    }

    /**
     * @notice Check if user has sufficient credits
     * @param user User address
     * @param amount Amount to check
     */
    function hasCredits(address user, uint256 amount) external view returns (bool) {
        return balances[user] >= amount;
    }

    /**
     * @notice Get user balance
     * @param user User address
     */
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get contract balance (total held)
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Allow direct ETH transfers as deposits
    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }
}
