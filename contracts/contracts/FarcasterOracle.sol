// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FarcasterOracle
 * @notice Oracle for Farcaster social data metrics
 * @dev Validators submit social metrics from Neynar API
 */
contract FarcasterOracle is Ownable, ReentrancyGuard {
    struct SocialMetrics {
        uint256 mentions24h;        // Number of mentions in last 24 hours
        int256 sentimentScore;      // Sentiment score: -10000 to +10000 (basis points)
        uint256 engagementRate;     // Engagement rate in basis points (e.g., 1550 = 15.5%)
        uint256 uniqueUsers;        // Number of unique users mentioning
        uint256 totalEngagement;    // Total likes + recasts + replies
        uint256 topCastFid;         // FID of the top performing cast
        uint256 timestamp;
    }

    struct Submission {
        address validator;
        SocialMetrics metrics;
        uint256 timestamp;
        bool processed;
    }

    // Oracle configuration
    string public name;
    string public symbol;
    string public targetToken;          // Token symbol being tracked (e.g., "DEGEN")
    address public registry;
    uint8 public consensusThreshold;    // Percentage (51-100)
    uint256 public updateFrequency;     // Seconds between updates
    uint256 public lastUpdate;

    // Validator management
    address[5] public validators;
    mapping(address => bool) public isValidator;
    mapping(address => uint256) public validatorSubmissionCount;

    // Current consensus data
    SocialMetrics public latestMetrics;
    Submission[] public currentSubmissions;
    mapping(address => bool) public hasSubmittedThisRound;

    // Events
    event MetricsSubmitted(
        address indexed validator,
        uint256 mentions24h,
        int256 sentimentScore,
        uint256 timestamp
    );
    event ConsensusReached(
        uint256 mentions24h,
        int256 sentimentScore,
        uint256 engagementRate,
        uint256 timestamp
    );
    event ValidatorsUpdated(address[5] validators);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _targetToken,
        uint8 _consensusThreshold,
        uint256 _updateFrequency,
        address _registry,
        address[5] memory _validators
    ) Ownable(msg.sender) {
        require(_consensusThreshold >= 51 && _consensusThreshold <= 100, "Invalid threshold");
        require(bytes(_targetToken).length > 0, "Target token required");

        name = _name;
        symbol = _symbol;
        targetToken = _targetToken;
        consensusThreshold = _consensusThreshold;
        updateFrequency = _updateFrequency;
        registry = _registry;

        // Set validators
        for (uint256 i = 0; i < 5; i++) {
            require(_validators[i] != address(0), "Invalid validator");
            validators[i] = _validators[i];
            isValidator[_validators[i]] = true;
        }

        emit ValidatorsUpdated(_validators);
    }

    /**
     * @notice Submit social metrics data
     * @dev Only validators can submit
     */
    function submitMetrics(
        uint256 _mentions24h,
        int256 _sentimentScore,
        uint256 _engagementRate,
        uint256 _uniqueUsers,
        uint256 _totalEngagement,
        uint256 _topCastFid
    ) external nonReentrant {
        require(isValidator[msg.sender], "Not a validator");
        require(!hasSubmittedThisRound[msg.sender], "Already submitted");
        require(_sentimentScore >= -10000 && _sentimentScore <= 10000, "Invalid sentiment");
        require(_engagementRate <= 10000, "Invalid engagement rate");

        unchecked {
            // Create submission
            SocialMetrics memory metrics = SocialMetrics({
                mentions24h: _mentions24h,
                sentimentScore: _sentimentScore,
                engagementRate: _engagementRate,
                uniqueUsers: _uniqueUsers,
                totalEngagement: _totalEngagement,
                topCastFid: _topCastFid,
                timestamp: block.timestamp
            });

            currentSubmissions.push(Submission({
                validator: msg.sender,
                metrics: metrics,
                timestamp: block.timestamp,
                processed: false
            }));

            hasSubmittedThisRound[msg.sender] = true;
            validatorSubmissionCount[msg.sender]++;

            emit MetricsSubmitted(msg.sender, _mentions24h, _sentimentScore, block.timestamp);

            // Check if consensus reached
            uint256 requiredSubmissions = (5 * consensusThreshold) / 100;
            if (currentSubmissions.length >= requiredSubmissions) {
                _calculateConsensus();
            }
        }
    }

    /**
     * @notice Calculate consensus from submissions
     * @dev Uses median for numeric values
     */
    function _calculateConsensus() private {
        uint256 count = currentSubmissions.length;
        require(count > 0, "No submissions");

        // Use unchecked for all array operations to prevent overflow panics
        unchecked {
            // Arrays for sorting
            uint256[] memory mentions = new uint256[](count);
            int256[] memory sentiments = new int256[](count);
            uint256[] memory engagements = new uint256[](count);
            uint256[] memory users = new uint256[](count);
            uint256[] memory totalEng = new uint256[](count);

            // Collect values
            for (uint256 i = 0; i < count; i++) {
                mentions[i] = currentSubmissions[i].metrics.mentions24h;
                sentiments[i] = currentSubmissions[i].metrics.sentimentScore;
                engagements[i] = currentSubmissions[i].metrics.engagementRate;
                users[i] = currentSubmissions[i].metrics.uniqueUsers;
                totalEng[i] = currentSubmissions[i].metrics.totalEngagement;
            }

            // Sort and get medians
            _sortUint256(mentions);
            _sortInt256(sentiments);
            _sortUint256(engagements);
            _sortUint256(users);
            _sortUint256(totalEng);

            uint256 mid = count / 2;

            // Update latest metrics with consensus values
            latestMetrics = SocialMetrics({
                mentions24h: mentions[mid],
                sentimentScore: sentiments[mid],
                engagementRate: engagements[mid],
                uniqueUsers: users[mid],
                totalEngagement: totalEng[mid],
                topCastFid: currentSubmissions[0].metrics.topCastFid, // Use first submission's top cast
                timestamp: block.timestamp
            });

            lastUpdate = block.timestamp;

            emit ConsensusReached(
                latestMetrics.mentions24h,
                latestMetrics.sentimentScore,
                latestMetrics.engagementRate,
                block.timestamp
            );
        } // End unchecked block

        // Reset for next round
        _resetSubmissions();
    }

    /**
     * @notice Reset submissions for new round
     */
    function _resetSubmissions() private {
        for (uint256 i = 0; i < currentSubmissions.length; i++) {
            hasSubmittedThisRound[currentSubmissions[i].validator] = false;
        }
        delete currentSubmissions;
    }

    /**
     * @notice Check if oracle needs update
     */
    function needsUpdate() external view returns (bool) {
        return block.timestamp >= lastUpdate + updateFrequency;
    }

    /**
     * @notice Get current submission count
     */
    function getCurrentSubmissionCount() external view returns (uint256) {
        return currentSubmissions.length;
    }

    /**
     * @notice Get specific submission
     */
    function getSubmission(uint256 index) external view returns (
        address validator,
        uint256 mentions24h,
        int256 sentimentScore,
        uint256 engagementRate,
        uint256 timestamp
    ) {
        require(index < currentSubmissions.length, "Invalid index");
        Submission memory sub = currentSubmissions[index];
        return (
            sub.validator,
            sub.metrics.mentions24h,
            sub.metrics.sentimentScore,
            sub.metrics.engagementRate,
            sub.timestamp
        );
    }

    /**
     * @notice Get latest consensus metrics
     */
    function getLatestMetrics() external view returns (
        uint256 mentions24h,
        int256 sentimentScore,
        uint256 engagementRate,
        uint256 uniqueUsers,
        uint256 totalEngagement,
        uint256 topCastFid,
        uint256 timestamp
    ) {
        return (
            latestMetrics.mentions24h,
            latestMetrics.sentimentScore,
            latestMetrics.engagementRate,
            latestMetrics.uniqueUsers,
            latestMetrics.totalEngagement,
            latestMetrics.topCastFid,
            latestMetrics.timestamp
        );
    }

    // Sorting helpers (simple bubble sort for small arrays)
    function _sortUint256(uint256[] memory arr) private pure {
        uint256 n = arr.length;
        if (n <= 1) return; // Prevent underflow when n=0 or n=1

        // Use unchecked to prevent overflow panics, since we know n > 1
        unchecked {
            for (uint256 i = 0; i < n - 1; i++) {
                for (uint256 j = 0; j < n - i - 1; j++) {
                    if (arr[j] > arr[j + 1]) {
                        (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
                    }
                }
            }
        }
    }

    function _sortInt256(int256[] memory arr) private pure {
        uint256 n = arr.length;
        if (n <= 1) return; // Prevent underflow when n=0 or n=1

        // Use unchecked to prevent overflow panics, since we know n > 1
        unchecked {
            for (uint256 i = 0; i < n - 1; i++) {
                for (uint256 j = 0; j < n - i - 1; j++) {
                    if (arr[j] > arr[j + 1]) {
                        (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
                    }
                }
            }
        }
    }

    /**
     * @notice Update validators (only owner)
     */
    function updateValidators(address[5] memory _validators) external onlyOwner {
        // Clear old validators
        for (uint256 i = 0; i < 5; i++) {
            isValidator[validators[i]] = false;
        }

        // Set new validators
        for (uint256 i = 0; i < 5; i++) {
            require(_validators[i] != address(0), "Invalid validator");
            validators[i] = _validators[i];
            isValidator[_validators[i]] = true;
        }

        emit ValidatorsUpdated(_validators);
    }
}
