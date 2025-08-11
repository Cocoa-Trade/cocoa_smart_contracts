// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0

pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Funding is ERC20, Ownable, ReentrancyGuard {
    address public immutable usdtAddress;
    address public immutable usdcAddress;
    uint256 public immutable tokensTotal;
    uint256 private immutable minAmount;

    mapping(address => mapping(address => uint256)) public userInvestments;

    constructor(
        address initialOwner,
        uint256 tokensTotal_,
        uint256 minAmount_,
        string memory name,
        string memory symbol,
        address usdtAddress_,
        address usdcAddress_
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _mint(address(this), tokensTotal_);
        tokensTotal = tokensTotal_;
        minAmount = minAmount_;
        usdtAddress = usdtAddress_;
        usdcAddress = usdcAddress_;
    }

    /* ======================= USER ACTIONS ======================= */

    function initSale(
        address user_address,
        uint256 amount,
        address sell_token
    ) private nonReentrant returns (bool) {
        require(amount >= minAmount, "Amount is below minimum");
        require(amount <= balanceOf(address(this)), "Amount exceeds available tokens");

        IERC20 usd_token = IERC20(sell_token);
        require(
            usd_token.balanceOf(user_address) >= amount,
            "Insufficient Token balance"
        );

        require(usd_token.transferFrom(user_address, address(this), amount), "User tokens transfer failed");
        require(IERC20(address(this)).transfer(msg.sender, amount), "Token transfer failed");
        
        userInvestments[user_address][sell_token] += amount;

        emit Payment(user_address, amount, sell_token);
        return true;
    }

    function initSaleUSDT(
        uint256 amount
    ) external {
        bool success = initSale(msg.sender, amount, usdtAddress);
        require(success, "Token transfer failed");
    }

    function initSaleUSDC(
        uint256 amount
    ) external {
        bool success = initSale(msg.sender, amount, usdcAddress);
        require(success, "Token transfer failed");
    }

    /* ====================== ADMIN ACTIONS ====================== */

    function withdraw(IERC20 token, uint256 amount) external onlyOwner {
        require(
            token.balanceOf(address(this)) >= amount,
            "Not enought balance"
        );
        require(token.approve(address(this), amount), 'Token was not approved');
        require(token.transferFrom(address(this), msg.sender, amount), "Withdraw to owner failed");
    }

    function withdrawNative(uint amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough native tokens");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Failed to send native token");
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
}
