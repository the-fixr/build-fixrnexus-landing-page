// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubscriptionManager
 * @notice Manages FEEDS oracle subscriptions with USDC, ETH, and FEEDS token payments
 */
contract SubscriptionManager is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;
    IERC20 public feedsToken;
    address public treasury;
    address public priceOracle; // For ETH/USD conversion

    uint256 public constant FEEDS_DISCOUNT = 25; // 25% discount when paying with FEEDS token

    // Subscription tiers
    enum Tier { FREE, STARTER, PRO, ENTERPRISE }

    struct Plan {
        uint256 priceUSDC;        // Price in USDC (6 decimals)
        uint256 callLimit;        // Monthly API call limit
        uint256 updateFrequency;  // Minimum seconds between updates
        bool active;
    }

    struct Subscription {
        Tier tier;
        uint256 expiresAt;
        uint256 monthlyLimit;
        uint256 usedThisMonth;
        uint256 periodStart;
    }

    // Tier => Plan details
    mapping(Tier => Plan) public plans;

    // User => Subscription
    mapping(address => Subscription) public subscriptions;

    // User => Prepaid credits in USD (18 decimals)
    mapping(address => uint256) public credits;

    // User => Monthly overage bill in USD (18 decimals)
    mapping(address => uint256) public monthlyBills;

    // Constants
    uint256 public constant COST_PER_CALL = 5e14; // $0.0005 in 18 decimals
    uint256 public constant USDC_DECIMALS = 6;

    // Events
    event Subscribed(address indexed user, Tier tier, uint256 expiresAt);
    event SubscriptionRenewed(address indexed user, Tier tier, uint256 expiresAt);
    event CreditsAdded(address indexed user, uint256 amount);
    event APICallRecorded(address indexed user, address indexed oracle, uint256 cost);
    event BillPaid(address indexed user, uint256 amount);

    constructor(
        address _usdc,
        address _treasury,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury");

        usdc = IERC20(_usdc);
        treasury = _treasury;

        // Initialize plans
        plans[Tier.FREE] = Plan({
            priceUSDC: 0,
            callLimit: 10_000,
            updateFrequency: 300, // 5 minutes
            active: true
        });

        plans[Tier.STARTER] = Plan({
            priceUSDC: 29 * 10**USDC_DECIMALS, // $29
            callLimit: 100_000,
            updateFrequency: 60, // 1 minute
            active: true
        });

        plans[Tier.PRO] = Plan({
            priceUSDC: 99 * 10**USDC_DECIMALS, // $99
            callLimit: 1_000_000,
            updateFrequency: 30, // 30 seconds
            active: true
        });

        plans[Tier.ENTERPRISE] = Plan({
            priceUSDC: 0, // Custom pricing
            callLimit: type(uint256).max,
            updateFrequency: 1, // Custom
            active: true
        });
    }

    /**
     * @notice Subscribe to a tier with USDC
     */
    function subscribeWithUSDC(Tier tier) external nonReentrant {
        require(tier != Tier.ENTERPRISE, "Contact sales for Enterprise");
        Plan memory plan = plans[tier];
        require(plan.active, "Plan not active");

        if (tier != Tier.FREE) {
            require(
                usdc.transferFrom(msg.sender, treasury, plan.priceUSDC),
                "USDC transfer failed"
            );
        }

        _createSubscription(msg.sender, tier, plan);
    }

    /**
     * @notice Subscribe to a tier with ETH (converted at current rate)
     */
    function subscribeWithETH(Tier tier) external payable nonReentrant {
        require(tier != Tier.ENTERPRISE, "Contact sales for Enterprise");
        require(tier != Tier.FREE, "Free tier doesn't require payment");

        Plan memory plan = plans[tier];
        require(plan.active, "Plan not active");

        // Get ETH amount needed
        uint256 ethRequired = getETHPrice(plan.priceUSDC);
        require(msg.value >= ethRequired, "Insufficient ETH");

        // Transfer to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "ETH transfer failed");

        _createSubscription(msg.sender, tier, plan);

        // Refund excess
        if (msg.value > ethRequired) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - ethRequired}("");
            require(refundSuccess, "Refund failed");
        }
    }

    /**
     * @notice Subscribe to a tier with FEEDS token (25% discount)
     */
    function subscribeWithFEEDS(Tier tier) external nonReentrant {
        require(tier != Tier.ENTERPRISE, "Contact sales for Enterprise");
        require(tier != Tier.FREE, "Free tier doesn't require payment");
        require(address(feedsToken) != address(0), "FEEDS token not set");

        Plan memory plan = plans[tier];
        require(plan.active, "Plan not active");

        // Calculate discounted price (25% off)
        uint256 discountedPrice = (plan.priceUSDC * (100 - FEEDS_DISCOUNT)) / 100;

        // Get FEEDS amount needed (convert USDC 6 decimals to FEEDS 18 decimals)
        uint256 feedsRequired = getFeedsPrice(discountedPrice);

        require(
            feedsToken.transferFrom(msg.sender, treasury, feedsRequired),
            "FEEDS transfer failed"
        );

        _createSubscription(msg.sender, tier, plan);
    }

    /**
     * @notice Add prepaid credits
     */
    function addCredits(uint256 amountUSDC) external nonReentrant {
        require(amountUSDC > 0, "Amount must be > 0");

        require(
            usdc.transferFrom(msg.sender, treasury, amountUSDC),
            "USDC transfer failed"
        );

        // Convert USDC (6 decimals) to 18 decimals for internal accounting
        uint256 creditsAmount = amountUSDC * 10**(18 - USDC_DECIMALS);
        credits[msg.sender] += creditsAmount;

        emit CreditsAdded(msg.sender, creditsAmount);
    }

    /**
     * @notice Record API call usage (called by OracleRegistry)
     */
    function recordAPICall(address user, address oracle) external {
        require(msg.sender == owner(), "Only owner can record calls");

        Subscription storage sub = subscriptions[user];

        // Reset counter if new period
        if (block.timestamp >= sub.periodStart + 30 days) {
            sub.usedThisMonth = 0;
            sub.periodStart = block.timestamp;
            monthlyBills[user] = 0;
        }

        sub.usedThisMonth++;

        // Charge for overage
        if (sub.usedThisMonth > sub.monthlyLimit) {
            uint256 cost = COST_PER_CALL;

            // Try to deduct from credits first
            if (credits[user] >= cost) {
                credits[user] -= cost;
            } else {
                // Add to monthly bill
                monthlyBills[user] += cost;
            }

            emit APICallRecorded(user, oracle, cost);
        }
    }

    /**
     * @notice Pay monthly bill with USDC
     */
    function payBill() external nonReentrant {
        uint256 bill = monthlyBills[msg.sender];
        require(bill > 0, "No outstanding bill");

        // Convert to USDC (6 decimals)
        uint256 amountUSDC = bill / 10**(18 - USDC_DECIMALS);
        require(amountUSDC > 0, "Bill too small");

        require(
            usdc.transferFrom(msg.sender, treasury, amountUSDC),
            "Payment failed"
        );

        monthlyBills[msg.sender] = 0;

        emit BillPaid(msg.sender, bill);
    }

    /**
     * @notice Get ETH price for USDC amount (using oracle)
     */
    function getETHPrice(uint256 usdcAmount) public view returns (uint256) {
        // TODO: Integrate with Chainlink or Pyth for ETH/USD price
        // For now, assume 1 ETH = $3000
        // usdcAmount is in 6 decimals, ETH is 18 decimals
        uint256 ethPrice = 3000 * 10**USDC_DECIMALS; // $3000 in USDC decimals
        return (usdcAmount * 10**18) / ethPrice;
    }

    /**
     * @notice Get FEEDS token amount for USDC amount (using oracle)
     */
    function getFeedsPrice(uint256 usdcAmount) public view returns (uint256) {
        // TODO: Integrate with DEX price feed for FEEDS/USD price
        // For now, assume 1 FEEDS = $0.01
        // usdcAmount is in 6 decimals, FEEDS is 18 decimals (ERC20 standard)
        uint256 feedsPrice = 1 * 10**(USDC_DECIMALS - 2); // $0.01 in USDC decimals
        return (usdcAmount * 10**18) / feedsPrice;
    }

    /**
     * @notice Get user's subscription details
     */
    function getSubscription(address user) external view returns (
        Tier tier,
        uint256 expiresAt,
        uint256 monthlyLimit,
        uint256 usedThisMonth,
        uint256 remainingCalls,
        uint256 creditBalance,
        uint256 outstandingBill
    ) {
        Subscription memory sub = subscriptions[user];
        tier = sub.tier;
        expiresAt = sub.expiresAt;
        monthlyLimit = sub.monthlyLimit;
        usedThisMonth = sub.usedThisMonth;
        remainingCalls = usedThisMonth >= monthlyLimit ? 0 : monthlyLimit - usedThisMonth;
        creditBalance = credits[user];
        outstandingBill = monthlyBills[user];
    }

    /**
     * @notice Check if user can make API call
     */
    function canMakeCall(address user) external view returns (bool) {
        Subscription memory sub = subscriptions[user];

        // Check subscription is active
        if (block.timestamp > sub.expiresAt) {
            return false;
        }

        // Check if within limit OR has credits/can be billed
        if (sub.usedThisMonth < sub.monthlyLimit) {
            return true;
        }

        // Can still call if they have credits or can be billed
        return credits[user] >= COST_PER_CALL || sub.tier != Tier.FREE;
    }

    /**
     * @notice Update plan details (owner only)
     */
    function updatePlan(
        Tier tier,
        uint256 priceUSDC,
        uint256 callLimit,
        uint256 updateFrequency,
        bool active
    ) external onlyOwner {
        plans[tier] = Plan(priceUSDC, callLimit, updateFrequency, active);
    }

    /**
     * @notice Update treasury address (owner only)
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        treasury = newTreasury;
    }

    /**
     * @notice Set FEEDS token address (owner only)
     */
    function setFeedsToken(address _feedsToken) external onlyOwner {
        require(_feedsToken != address(0), "Invalid address");
        feedsToken = IERC20(_feedsToken);
    }

    /**
     * @notice Grant enterprise subscription (owner only)
     */
    function grantEnterpriseSubscription(
        address user,
        uint256 callLimit,
        uint256 updateFrequency,
        uint256 durationDays
    ) external onlyOwner {
        Plan memory plan = Plan({
            priceUSDC: 0,
            callLimit: callLimit,
            updateFrequency: updateFrequency,
            active: true
        });

        subscriptions[user] = Subscription({
            tier: Tier.ENTERPRISE,
            expiresAt: block.timestamp + (durationDays * 1 days),
            monthlyLimit: callLimit,
            usedThisMonth: 0,
            periodStart: block.timestamp
        });

        emit Subscribed(user, Tier.ENTERPRISE, block.timestamp + (durationDays * 1 days));
    }

    /**
     * @dev Internal function to create subscription
     */
    function _createSubscription(address user, Tier tier, Plan memory plan) private {
        uint256 expiresAt = block.timestamp + 30 days;

        subscriptions[user] = Subscription({
            tier: tier,
            expiresAt: expiresAt,
            monthlyLimit: plan.callLimit,
            usedThisMonth: 0,
            periodStart: block.timestamp
        });

        emit Subscribed(user, tier, expiresAt);
    }
}
