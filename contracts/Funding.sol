// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0

pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Funding is ERC20, Ownable, ReentrancyGuard {
    bool public isClaimAvailable;
    address public immutable usdtAddress;
    address public immutable usdcAddress;
    uint256 public immutable tokensTotal;

    uint256 private _tokensRemain;
    uint256 private _tokensSold;
    uint256 private _rewardsTotal;
    uint256 private immutable _minAmount;

    mapping(address => mapping(address => uint256)) public userInvestments;

    constructor(
        address initialOwner,
        uint256 tokensTotal_,
        uint256 minAmount,
        string memory name,
        string memory symbol,
        address usdtAddress_,
        address usdcAddress_
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _mint(address(this), tokensTotal_);
        tokensTotal = tokensTotal_;
        _tokensRemain = tokensTotal_;
        _minAmount = minAmount;
        usdtAddress = usdtAddress_;
        usdcAddress = usdcAddress_;
        isClaimAvailable = false;
    }

    /* =========================== UTILS ========================== */

    function _increaseSoldTokensAmount(uint256 amount) private {
        uint256 newSold = _tokensSold + amount;
        if (newSold > tokensTotal) {
            revert ExceedsTotalSupply(newSold, tokensTotal);
        }
        _tokensSold = newSold;
    }

    function tokensSold() external view returns(uint256) {
        return _tokensSold;
    }

    function _decreaseRemainTokensAmount(uint256 amount) private {
        if (amount > _tokensRemain) {
            revert InsufficientTokens(_tokensRemain, amount);
        }
        _tokensRemain -= amount;
    }

    function getRemainTokensAmount() external view returns(uint256) {
        return _tokensRemain;
    }

    /* ======================= USER ACTIONS ======================= */

    function _initSale(
        address user_address,
        uint256 amount,
        address sell_token
    ) private nonReentrant returns (bool) {
        require(amount >= _minAmount, "Amount is below minimum");
        require(amount <= _tokensRemain, "Amount exceeds available tokens");

        IERC20 usd_token = IERC20(sell_token);

        require(
            usd_token.transferFrom(user_address, address(this), amount),
            "User tokens transfer failed"
        );
        require(
            IERC20(address(this)).transfer(user_address, amount),
            "Token transfer failed"
        );

        _decreaseRemainTokensAmount(amount);
        _increaseSoldTokensAmount(amount);

        userInvestments[user_address][sell_token] += amount;

        emit Payment(user_address, amount, sell_token);
        return true;
    }

    function getPercentage() public view returns (uint256) {
        uint256 userBalance = IERC20(address(this)).balanceOf(msg.sender);
        require(userBalance > 0, "User balance is zero");
        uint256 percentage = (userBalance * 1e6) / tokensTotal;
        return percentage;
    }

    function initSaleUSDT(uint256 amount) external {
        bool success = _initSale(msg.sender, amount, usdtAddress);
        require(success, "Token transfer failed");
    }

    function initSaleUSDC(uint256 amount) external {
        bool success = _initSale(msg.sender, amount, usdcAddress);
        require(success, "Token transfer failed");
    }

    function claim() external nonReentrant returns (uint256) {
        require(
            isClaimAvailable,
            "Claim is not available, wait for rewards deposit"
        );

        uint256 userFundingTokenBalance = balanceOf(msg.sender);
        require(
            userFundingTokenBalance > 0,
            "Claim failed, no funding tokens held"
        );

        uint256 percentage = getPercentage();
        uint256 userRewardShare = (_rewardsTotal * percentage) / 1e6;
        IERC20 rewardToken = IERC20(usdtAddress);
        require(
            rewardToken.balanceOf(address(this)) >= userRewardShare,
            "Insufficient rewards in contract"
        );

        _burn(msg.sender, userFundingTokenBalance);
        rewardToken.transfer(msg.sender, userRewardShare);
        return userRewardShare;
    }

    /* ====================== ADMIN ACTIONS ====================== */

    function withdraw(IERC20 token, uint256 amount) external onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "Not enough balance");
        require(token.transfer(owner(), amount), "Withdraw to owner failed");
    }

    function withdrawNative(uint amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough native tokens");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Failed to send native token");
    }

    function depositFunds(IERC20 token, uint256 amount) external onlyOwner {
        require(
            token.balanceOf(msg.sender) >= amount,
            "Insufficient Token balance"
        );
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Deposit transfer failed"
        );
        isClaimAvailable = true;
        _rewardsTotal += amount;
    }

    /* ========================= RECEIVE ========================= */

    receive() external payable {
        revert("Oops...dont do that");
    }

    /* ========================= FALLBACK ========================= */

    fallback() external payable {
        revert("Oops...dont do this");
    }

    /* ========================== EVENTS ========================== */

    event Payment(address user_address, uint256 amount, address sell_token);

    /* ========================== ERRORS ========================== */

    error ExceedsTotalSupply(uint256 newSold, uint256 totalSupply);
    error InsufficientTokens(uint256 currentRemain, uint256 decrementAmount);
}
