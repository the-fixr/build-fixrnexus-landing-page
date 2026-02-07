// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IClawgFeeSplitter {
    event Distributed(address indexed token, uint256 toStakers, uint256 toTreasury, address indexed caller);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenAdded(address indexed token);
    event ETHReceived(uint256 amount);

    function distributeAll() external;
    function distribute(address token) external;
    function pendingFees(address token) external view returns (uint256);
    function getFeeTokens() external view returns (address[] memory);
    function addFeeToken(address token) external;
    function setTreasury(address _treasury) external;
    function stakingContract() external view returns (address);
    function treasury() external view returns (address);
    function isFeeToken(address token) external view returns (bool);
}
