// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0

pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Funding is ERC20, ReentrancyGuard {
    bool public isClaimAvailable;
    address public immutable owner;
    address public immutable usdtAddress;
    address public immutable usdcAddress;
    uint256 private _tokensTotal;
    uint256 private _tokensSold;
    uint256 private _rewardsTotal;
    uint256 private immutable _minAmount;

    mapping(address => mapping(address => uint256)) public userInvestments;

    /* ========================== EVENTS ========================== */

    event Payment(address user_address, uint256 amount, address sell_token);
    event NewTotalSupply(uint256 newTotal);

    /* ========================== ERRORS ========================== */

    error NotTheOwner();
    error UserZeroBalance();
    error ClaimIsNotAvailable();
    error InsufficientBalance();
    error TokenTransferFailed();
    error NewTotalSupplyBelowSold(uint256 newTotal, uint256 sold);
    error ExceedsTotalSupply(uint256 newSold, uint256 totalSupply);
    error InsufficientTokens(uint256 currentRemain, uint256 decrementAmount);
    error AmountBelowMin(uint256 amount, uint256 min);
    error AmountExceedsAvailable(uint256 amount, uint256 tokensRemain);

    constructor(
        address initialOwner,
        uint256 tokensTotal_,
        uint256 minAmount,
        string memory name,
        string memory symbol,
        address usdtAddress_,
        address usdcAddress_
    ) ERC20(name, symbol) {
        if (initialOwner == address(0))
            revert("Owner cannot be the zero address");
        if (usdtAddress_ == address(0))
            revert("USDT address cannot be the zero address");
        if (usdcAddress_ == address(0))
            revert("USDC address cannot be the zero address");
        owner = initialOwner;
        usdtAddress = usdtAddress_;
        usdcAddress = usdcAddress_;
        _tokensTotal = tokensTotal_;
        _mint(address(this), tokensTotal_);
        _minAmount = minAmount;
        _tokensSold = 0;
        isClaimAvailable = false;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotTheOwner();
        }
        _;
    }

    /* =========================== UTILS ========================== */

    function _increaseSoldTokensAmount(uint256 amount) private {
        uint256 newSold = _tokensSold + amount;
        if (newSold > _tokensTotal) {
            revert ExceedsTotalSupply(newSold, _tokensTotal);
        }
        _tokensSold = newSold;
    }

    function tokensSold() external view returns (uint256) {
        return _tokensSold;
    }

    function tokensTotal() external view returns (uint256) {
        return _tokensTotal;
    }

    function getRemainTokensAmount() public view returns (uint256) {
        return _tokensTotal - _tokensSold;
    }

    /* ======================= USER ACTIONS ======================= */

    function _initSale(
        address user_address,
        uint256 amount,
        address sell_token
    ) private nonReentrant {
        if (amount < _minAmount) {
            revert AmountBelowMin(amount, _minAmount);
        }
        uint256 _tokensRemain = getRemainTokensAmount();
        if (amount > _tokensRemain) {
            revert AmountExceedsAvailable(amount, _tokensRemain);
        }

        IERC20 usd_token = IERC20(sell_token);

        _increaseSoldTokensAmount(amount);
        userInvestments[user_address][sell_token] += amount;

        usd_token.transferFrom(user_address, address(this), amount);

        bool transfer = IERC20(address(this)).transfer(user_address, amount);
        if (!transfer) {
            revert TokenTransferFailed();
        }

        emit Payment(user_address, amount, sell_token);
    }

    function getPercentage() public view returns (uint256) {
        uint256 userBalance = IERC20(address(this)).balanceOf(msg.sender);
        if (userBalance < 1) {
            revert UserZeroBalance();
        }
        uint256 percentage = (userBalance * 1e6) / _tokensTotal;
        return percentage;
    }

    function initSaleUSDT(uint256 amount) external {
        _initSale(msg.sender, amount, usdtAddress);
    }

    function initSaleUSDC(uint256 amount) external {
        _initSale(msg.sender, amount, usdcAddress);
    }

    function claim() external nonReentrant returns (uint256) {
        if (!isClaimAvailable) {
            revert ClaimIsNotAvailable();
        }
        uint256 userTokenBalance = balanceOf(msg.sender);
        if (userTokenBalance < 1) {
            revert UserZeroBalance();
        }
        uint256 percentage = getPercentage();
        uint256 userRewardShare = (_rewardsTotal * percentage) / 1e6;
        IERC20 rewardToken = IERC20(usdtAddress);
        uint256 rewardsRemaining = rewardToken.balanceOf(address(this));
        if (rewardsRemaining < userRewardShare) {
            revert InsufficientBalance();
        }
        _burn(msg.sender, userTokenBalance);
        bool success = rewardToken.transfer(msg.sender, userRewardShare);
        if (!success) {
            revert TokenTransferFailed();
        }
        return userRewardShare;
    }

    /* ====================== ADMIN ACTIONS ====================== */

    function withdraw(IERC20 token, uint256 amount) external onlyOwner {
        if (token.balanceOf(address(this)) < amount) {
            revert InsufficientBalance();
        }
        bool success = token.transfer(owner, amount);
        if (!success) {
            revert TokenTransferFailed();
        }
    }

    function withdrawNative(uint amount) external onlyOwner {
        if (address(this).balance < amount) {
            revert InsufficientBalance();
        }
        (bool success, ) = owner.call{value: amount}("");
        if (!success) {
            revert TokenTransferFailed();
        }
    }

    function depositFunds(IERC20 token, uint256 amount) external onlyOwner {
        isClaimAvailable = true;
        _rewardsTotal += amount;
        require(token.balanceOf(msg.sender) > amount, InsufficientBalance());
        token.transferFrom(msg.sender, address(this), amount);
    }

    function decreaseTokensTotal(
        uint256 amountToBurn
    ) external onlyOwner returns (uint256) {
        uint256 newTotalSupply = _tokensTotal - amountToBurn;
        if (newTotalSupply < _tokensSold) {
            revert NewTotalSupplyBelowSold(newTotalSupply, _tokensSold);
        }
        _tokensTotal = newTotalSupply;
        _burn(address(this), amountToBurn);
        emit NewTotalSupply(newTotalSupply);
        return _tokensTotal;
    }

    /* ========================= RECEIVE ========================= */

    receive() external payable {
        revert("Oops...dont do that");
    }

    /* ========================= FALLBACK ========================= */

    fallback() external payable {
        revert("Oops...dont do this");
    }
}
