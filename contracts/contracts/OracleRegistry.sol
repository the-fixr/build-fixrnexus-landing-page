// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OracleRegistry
 * @notice Central registry for all FEEDS oracles
 * @dev Tracks oracle deployments, validators, and manages consensus
 */
contract OracleRegistry is Ownable, ReentrancyGuard {
    struct Oracle {
        address oracleAddress;
        address creator;
        string name;
        string oracleType; // "price", "weather", "custom"
        uint256 updateFrequency; // in seconds
        uint8 consensusThreshold; // percentage (0-100)
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdate;
    }

    struct Validator {
        address validatorAddress;
        string endpoint; // Cloudflare Worker URL
        bool isActive;
        uint256 validationCount;
        uint256 lastValidation;
    }

    // Oracle tracking
    mapping(address => Oracle) public oracles;
    mapping(address => bool) public isRegisteredOracle;
    address[] public allOracles;
    mapping(address => address[]) public userOracles; // user => oracle addresses

    // Validator tracking
    Validator[5] public validators;
    mapping(address => uint256) public validatorIndex; // validator address => index
    uint256 public activeValidatorCount;

    // Events
    event OracleRegistered(
        address indexed oracleAddress,
        address indexed creator,
        string name,
        string oracleType
    );
    event OracleDeactivated(address indexed oracleAddress);
    event ValidatorAdded(address indexed validator, string endpoint, uint256 index);
    event ValidatorRemoved(address indexed validator, uint256 index);
    event DataUpdated(address indexed oracle, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new oracle
     */
    function registerOracle(
        address _oracleAddress,
        string memory _name,
        string memory _oracleType,
        uint256 _updateFrequency,
        uint8 _consensusThreshold
    ) external nonReentrant {
        require(!isRegisteredOracle[_oracleAddress], "Oracle already registered");
        require(_consensusThreshold >= 51 && _consensusThreshold <= 100, "Invalid threshold");

        Oracle memory newOracle = Oracle({
            oracleAddress: _oracleAddress,
            creator: msg.sender,
            name: _name,
            oracleType: _oracleType,
            updateFrequency: _updateFrequency,
            consensusThreshold: _consensusThreshold,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdate: 0
        });

        oracles[_oracleAddress] = newOracle;
        isRegisteredOracle[_oracleAddress] = true;
        allOracles.push(_oracleAddress);
        userOracles[msg.sender].push(_oracleAddress);

        emit OracleRegistered(_oracleAddress, msg.sender, _name, _oracleType);
    }

    /**
     * @notice Deactivate an oracle (only creator can call)
     */
    function deactivateOracle(address _oracleAddress) external {
        require(isRegisteredOracle[_oracleAddress], "Oracle not registered");
        require(oracles[_oracleAddress].creator == msg.sender, "Not oracle creator");

        oracles[_oracleAddress].isActive = false;
        emit OracleDeactivated(_oracleAddress);
    }

    /**
     * @notice Add a validator (Cloudflare Worker)
     */
    function addValidator(
        uint256 _index,
        address _validatorAddress,
        string memory _endpoint
    ) external onlyOwner {
        require(_index < 5, "Invalid validator index");
        require(!validators[_index].isActive, "Validator slot occupied");

        validators[_index] = Validator({
            validatorAddress: _validatorAddress,
            endpoint: _endpoint,
            isActive: true,
            validationCount: 0,
            lastValidation: 0
        });

        validatorIndex[_validatorAddress] = _index;
        activeValidatorCount++;

        emit ValidatorAdded(_validatorAddress, _endpoint, _index);
    }

    /**
     * @notice Remove a validator
     */
    function removeValidator(uint256 _index) external onlyOwner {
        require(_index < 5, "Invalid validator index");
        require(validators[_index].isActive, "Validator not active");

        address validatorAddr = validators[_index].validatorAddress;

        delete validators[_index];
        delete validatorIndex[validatorAddr];
        activeValidatorCount--;

        emit ValidatorRemoved(validatorAddr, _index);
    }

    /**
     * @notice Record a data update from validators
     */
    function recordUpdate(address _oracleAddress) external {
        require(isRegisteredOracle[_oracleAddress], "Oracle not registered");
        require(validators[validatorIndex[msg.sender]].isActive, "Not active validator");

        oracles[_oracleAddress].lastUpdate = block.timestamp;
        validators[validatorIndex[msg.sender]].validationCount++;
        validators[validatorIndex[msg.sender]].lastValidation = block.timestamp;

        emit DataUpdated(_oracleAddress, block.timestamp);
    }

    /**
     * @notice Get oracle details
     */
    function getOracle(address _oracleAddress) external view returns (Oracle memory) {
        require(isRegisteredOracle[_oracleAddress], "Oracle not registered");
        return oracles[_oracleAddress];
    }

    /**
     * @notice Get all oracles for a user
     */
    function getUserOracles(address _user) external view returns (address[] memory) {
        return userOracles[_user];
    }

    /**
     * @notice Get all registered oracles
     */
    function getAllOracles() external view returns (address[] memory) {
        return allOracles;
    }

    /**
     * @notice Get active validators
     */
    function getActiveValidators() external view returns (Validator[5] memory) {
        return validators;
    }

    /**
     * @notice Get total oracle count
     */
    function getOracleCount() external view returns (uint256) {
        return allOracles.length;
    }
}
