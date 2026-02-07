// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PriceOracle.sol";
import "./FarcasterOracle.sol";
import "./OracleRegistry.sol";

/**
 * @title OracleFactory
 * @notice Factory contract for deploying new oracle instances
 * @dev Creates and registers oracles in a single transaction
 */
contract OracleFactory {
    address public registry;
    address[] public validators;

    event OracleDeployed(
        address indexed oracleAddress,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(address _registry) {
        registry = _registry;
    }

    /**
     * @notice Set validator addresses (5 Cloudflare Workers)
     */
    function setValidators(address[] memory _validators) external {
        require(_validators.length <= 5, "Max 5 validators");
        validators = _validators;
    }

    /**
     * @notice Deploy a new price oracle
     */
    function deployPriceOracle(
        string memory _name,
        string memory _symbol,
        uint8 _consensusThreshold,
        uint256 _updateFrequency
    ) external returns (address) {
        require(validators.length > 0, "Validators not set");

        // Deploy new PriceOracle
        PriceOracle oracle = new PriceOracle(
            _name,
            _symbol,
            _consensusThreshold,
            _updateFrequency,
            registry,
            validators
        );

        address oracleAddress = address(oracle);

        // Register in OracleRegistry
        OracleRegistry(registry).registerOracle(
            oracleAddress,
            _name,
            "price",
            _updateFrequency,
            _consensusThreshold
        );

        emit OracleDeployed(oracleAddress, msg.sender, _name, _symbol);

        return oracleAddress;
    }

    /**
     * @notice Deploy a new Farcaster oracle for social metrics
     */
    function deployFarcasterOracle(
        string memory _name,
        string memory _symbol,
        string memory _targetToken,
        uint8 _consensusThreshold,
        uint256 _updateFrequency
    ) external returns (address) {
        require(validators.length == 5, "Must have exactly 5 validators");

        // Convert dynamic array to fixed array[5]
        address[5] memory validatorArray;
        for (uint i = 0; i < 5; i++) {
            validatorArray[i] = validators[i];
        }

        // Deploy new FarcasterOracle
        FarcasterOracle oracle = new FarcasterOracle(
            _name,
            _symbol,
            _targetToken,
            _consensusThreshold,
            _updateFrequency,
            registry,
            validatorArray
        );

        address oracleAddress = address(oracle);

        // Register in OracleRegistry
        OracleRegistry(registry).registerOracle(
            oracleAddress,
            _name,
            "farcaster",
            _updateFrequency,
            _consensusThreshold
        );

        emit OracleDeployed(oracleAddress, msg.sender, _name, _symbol);

        return oracleAddress;
    }

    /**
     * @notice Get current validators
     */
    function getValidators() external view returns (address[] memory) {
        return validators;
    }
}
