// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DummyToken
 * @notice Simple ERC20 token for testing staking system on mainnet
 * @dev Deploy this first, then use it as the staking token for testing
 */
contract DummyToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Dummy FIXR", "dFIXR") Ownable(initialOwner) {
        // Mint 100 billion tokens (matching Clanker supply) to deployer
        _mint(initialOwner, 100_000_000_000 * 10**18);
    }

    /**
     * @notice Mint additional tokens (for testing only)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
