// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PriceOracle
 * @notice Stores and validates price data with multi-validator consensus
 * @dev Each oracle instance is deployed for a specific price feed
 */
contract PriceOracle is AccessControl, ReentrancyGuard {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint8 decimals;
    }

    struct ValidationSubmission {
        uint256 price;
        uint256 timestamp;
        address validator;
    }

    // Oracle configuration
    string public name;
    string public symbol; // e.g., "ETH/USD"
    uint8 public consensusThreshold; // percentage (51-100)
    uint256 public updateFrequency; // minimum seconds between updates
    address public registry;

    // Current price data
    PriceData public latestPrice;

    // Validation tracking
    mapping(uint256 => ValidationSubmission[]) public pendingValidations; // round => submissions
    mapping(uint256 => mapping(address => bool)) public hasSubmitted; // round => validator => submitted
    uint256 public currentRound;
    uint256 public lastUpdateTime;

    // Events
    event PriceSubmitted(address indexed validator, uint256 price, uint256 round);
    event PriceUpdated(uint256 price, uint256 timestamp, uint256 round);
    event ConsensusReached(uint256 round, uint256 finalPrice, uint8 agreementPercentage);
    event ConsensusFailed(uint256 round, string reason);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _consensusThreshold,
        uint256 _updateFrequency,
        address _registry,
        address[] memory _validators
    ) {
        require(_consensusThreshold >= 51 && _consensusThreshold <= 100, "Invalid threshold");
        require(_validators.length > 0, "Need validators");

        name = _name;
        symbol = _symbol;
        consensusThreshold = _consensusThreshold;
        updateFrequency = _updateFrequency;
        registry = _registry;
        currentRound = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Grant validator role to all provided validators
        for (uint256 i = 0; i < _validators.length; i++) {
            _grantRole(VALIDATOR_ROLE, _validators[i]);
        }
    }

    /**
     * @notice Submit price data (only validators)
     */
    function submitPrice(
        uint256 _price,
        uint8 _decimals
    ) external onlyRole(VALIDATOR_ROLE) nonReentrant {
        require(_price > 0, "Invalid price");
        require(!hasSubmitted[currentRound][msg.sender], "Already submitted");

        // Create submission
        ValidationSubmission memory submission = ValidationSubmission({
            price: _price,
            timestamp: block.timestamp,
            validator: msg.sender
        });

        pendingValidations[currentRound].push(submission);
        hasSubmitted[currentRound][msg.sender] = true;

        emit PriceSubmitted(msg.sender, _price, currentRound);

        // Check if we can reach consensus
        _tryReachConsensus(_decimals);
    }

    /**
     * @notice Internal function to attempt consensus
     */
    function _tryReachConsensus(uint8 _decimals) internal {
        ValidationSubmission[] memory submissions = pendingValidations[currentRound];
        uint256 submissionCount = submissions.length;

        // Need at least 2 submissions
        if (submissionCount < 2) {
            return;
        }

        // Calculate median price
        uint256[] memory prices = new uint256[](submissionCount);
        for (uint256 i = 0; i < submissionCount; i++) {
            prices[i] = submissions[i].price;
        }

        // Simple bubble sort for median calculation
        for (uint256 i = 0; i < prices.length; i++) {
            for (uint256 j = i + 1; j < prices.length; j++) {
                if (prices[i] > prices[j]) {
                    uint256 temp = prices[i];
                    prices[i] = prices[j];
                    prices[j] = temp;
                }
            }
        }

        uint256 medianPrice = prices[prices.length / 2];

        // Check agreement percentage
        uint256 agreementCount = 0;
        uint256 tolerance = (medianPrice * 5) / 100; // 5% tolerance

        for (uint256 i = 0; i < prices.length; i++) {
            if (
                prices[i] >= medianPrice - tolerance &&
                prices[i] <= medianPrice + tolerance
            ) {
                agreementCount++;
            }
        }

        uint8 agreementPercentage = uint8((agreementCount * 100) / submissionCount);

        if (agreementPercentage >= consensusThreshold) {
            // Consensus reached!
            latestPrice = PriceData({
                price: medianPrice,
                timestamp: block.timestamp,
                decimals: _decimals
            });

            lastUpdateTime = block.timestamp;

            emit ConsensusReached(currentRound, medianPrice, agreementPercentage);
            emit PriceUpdated(medianPrice, block.timestamp, currentRound);

            // Start new round
            currentRound++;
        } else if (submissionCount >= 5) {
            // All validators submitted but no consensus
            emit ConsensusFailed(currentRound, "Consensus threshold not met");
            currentRound++;
        }
    }

    /**
     * @notice Get latest price
     */
    function getLatestPrice() external view returns (uint256 price, uint256 timestamp, uint8 decimals) {
        require(latestPrice.timestamp > 0, "No price data available");
        return (latestPrice.price, latestPrice.timestamp, latestPrice.decimals);
    }

    /**
     * @notice Check if update is needed
     */
    function needsUpdate() external view returns (bool) {
        return block.timestamp >= lastUpdateTime + updateFrequency;
    }

    /**
     * @notice Get current round submissions
     */
    function getCurrentRoundSubmissions() external view returns (ValidationSubmission[] memory) {
        return pendingValidations[currentRound];
    }

    /**
     * @notice Add a new validator
     */
    function addValidator(address _validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VALIDATOR_ROLE, _validator);
    }

    /**
     * @notice Remove a validator
     */
    function removeValidator(address _validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VALIDATOR_ROLE, _validator);
    }
}
