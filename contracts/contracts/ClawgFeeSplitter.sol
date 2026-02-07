// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IWETH {
    function deposit() external payable;
    function balanceOf(address) external view returns (uint256);
}

contract ClawgFeeSplitter is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 public constant STAKERS_BPS = 7000;
    uint256 public constant TREASURY_BPS = 3000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_DISTRIBUTE = 1e15;

    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant CLAWG = 0x06A127f0b53F83dD5d94E83D96B55a279705bB07;

    address public immutable stakingContract;
    address public treasury;

    address[] public feeTokens;
    mapping(address => bool) public isFeeToken;

    event Distributed(address indexed token, uint256 toStakers, uint256 toTreasury, address indexed caller);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenAdded(address indexed token);
    event ETHReceived(uint256 amount);

    constructor(
        address _stakingContract,
        address _treasury,
        address _clawgToken,
        address _owner
    ) Ownable(_owner) {
        require(_stakingContract != address(0), "Invalid staking");
        require(_treasury != address(0), "Invalid treasury");

        stakingContract = _stakingContract;
        treasury = _treasury;

        isFeeToken[WETH] = true;
        feeTokens.push(WETH);

        if (_clawgToken != address(0)) {
            isFeeToken[_clawgToken] = true;
            feeTokens.push(_clawgToken);
        }
    }

    receive() external payable {
        if (msg.value > 0) {
            IWETH(WETH).deposit{value: msg.value}();
            emit ETHReceived(msg.value);
        }
    }

    function distributeAll() external nonReentrant {
        for (uint256 i = 0; i < feeTokens.length; i++) {
            _distribute(feeTokens[i]);
        }
    }

    function distribute(address token) external nonReentrant {
        require(isFeeToken[token], "Not a fee token");
        _distribute(token);
    }

    function pendingFees(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getFeeTokens() external view returns (address[] memory) {
        return feeTokens;
    }

    function addFeeToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!isFeeToken[token], "Already added");

        isFeeToken[token] = true;
        feeTokens.push(token);
        emit TokenAdded(token);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function _distribute(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));

        if (balance < MIN_DISTRIBUTE) return;

        uint256 toStakers = (balance * STAKERS_BPS) / BPS_DENOMINATOR;
        uint256 toTreasury = balance - toStakers;

        if (toStakers > 0) {
            IERC20(token).safeTransfer(stakingContract, toStakers);
        }

        if (toTreasury > 0) {
            IERC20(token).safeTransfer(treasury, toTreasury);
        }

        emit Distributed(token, toStakers, toTreasury, msg.sender);
    }
}
