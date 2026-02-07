// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFixrFeeSplitter {
    /// @notice Emitted when fees are distributed
    event FeesDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 stakersShare,
        uint256 treasuryShare
    );

    /// @notice Emitted when a token is added to whitelist
    event TokenWhitelisted(address indexed token);

    /// @notice Emitted when a token is removed from whitelist
    event TokenRemoved(address indexed token);

    /// @notice Emitted when staking contract is updated
    event StakingContractUpdated(address indexed oldStaking, address indexed newStaking);

    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Distribute all whitelisted token fees
    function distributeAll() external;

    /// @notice Distribute fees for a specific token
    /// @param token The token to distribute
    function distribute(address token) external;

    /// @notice Add token to whitelist
    /// @param token Token address to whitelist
    function addToken(address token) external;

    /// @notice Remove token from whitelist
    /// @param token Token address to remove
    function removeToken(address token) external;

    /// @notice Update the staking contract address
    /// @param newStaking New staking contract address
    function setStakingContract(address newStaking) external;

    /// @notice Update the treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external;

    /// @notice Get the staking contract address
    /// @return staking The staking contract address
    function stakingContract() external view returns (address staking);

    /// @notice Get the treasury address
    /// @return treasury The treasury address
    function treasury() external view returns (address treasury);

    /// @notice Get the stakers share in basis points (7000 = 70%)
    /// @return share Stakers share in basis points
    function stakersShareBps() external view returns (uint256 share);

    /// @notice Check if a token is whitelisted
    /// @param token Token address to check
    /// @return whitelisted True if token is whitelisted
    function isWhitelisted(address token) external view returns (bool whitelisted);

    /// @notice Get all whitelisted tokens
    /// @return tokens Array of whitelisted token addresses
    function getWhitelistedTokens() external view returns (address[] memory tokens);

    /// @notice Get balance of a whitelisted token held by this contract
    /// @param token Token address
    /// @return balance Token balance
    function getBalance(address token) external view returns (uint256 balance);
}
