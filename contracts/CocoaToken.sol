// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0

pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CocoaToken is ERC20, Ownable, ReentrancyGuard {
    bool public isClaimEnabled;
    address public immutable usdtAddress;
    address public immutable usdcAddress;
    uint256 public immutable tokensTotal;
    uint256 private _rewardsTotal;
    uint256 private immutable minAmount;

    function getRewardsTotal() public view returns (uint256) {
        return _rewardsTotal;
    }

    constructor(
        address initialOwner,
        uint256 tokensTotal_,
        uint256 minAmount_,
        string memory name,
        string memory symbol,
        address usdtAddress_,
        address usdcAddress_,
        bool isClaimEnabled_
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _mint(address(this), tokensTotal_);
        tokensTotal = tokensTotal_;
        minAmount = minAmount_;
        usdtAddress = usdtAddress_;
        usdcAddress = usdcAddress_;
        isClaimEnabled = isClaimEnabled_;
    }

    /**
     * @dev Throws if called from contract.
     */
    modifier onlyWallets() {
        require(msg.sender.code.length == 0, "Code 0");
        _;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    /* ======================= USER ACTIONS ======================= */

    function initSale(
        address user_address,
        uint256 amount,
        address sell_token
    ) private nonReentrant returns (bool) {
        require(amount >= minAmount, "Amount is below minimum");
        uint256 cocoaAmount = amount / 1e12;
        require(cocoaAmount <= balanceOf(address(this)), "Amount exceeds available tokens");

        IERC20 usd_token = IERC20(sell_token);
        require(
            usd_token.balanceOf(user_address) >= amount,
            "Insufficient Token balance"
        );

        require(usd_token.transferFrom(user_address, address(this), amount), "User tokens transfer failed");
        require(IERC20(address(this)).transfer(msg.sender, cocoaAmount), "Token transfer failed");
        emit Payment(user_address, amount, sell_token);
        return true;
    }

    function initSaleUSDT(
        uint256 amount
    ) external onlyWallets {
        bool success = initSale(msg.sender, amount, usdtAddress);
        require(success, "Token transfer failed");
    }

    function initSaleUSDC(
        uint256 amount
    ) external onlyWallets {
        bool success = initSale(msg.sender, amount, usdcAddress);
        require(success, "Token transfer failed");
    }

    function claim() public onlyWallets nonReentrant returns (uint256) {
        IERC20 token = IERC20(address(this));
        uint256 user_available_balance = token.balanceOf(msg.sender);
        require(
            user_available_balance > 0,
            "Claim failed, balance error"
        );

        uint256 percentage = (user_available_balance * 1e6) / tokensTotal;
        uint256 userRewardShare = (_rewardsTotal * percentage) / 1e6;

        IERC20 usd_token = IERC20(usdtAddress);
        require(
            usd_token.balanceOf(address(this)) >= userRewardShare,
            "Insufficient Token balance on contract"
        );

        require(token.transferFrom(msg.sender, address(this), user_available_balance), "Transfer from user failed");
        _burn(address(this), user_available_balance);

        require(usd_token.approve(address(this), 0), 'Usdt approve was not reset');
        require(usd_token.approve(address(this), userRewardShare), 'Usdt Reward was not approved');
        require(usd_token.transferFrom(address(this), msg.sender, userRewardShare), "Transfer to user failed");

        return userRewardShare;
    }

    function calculateUserTokenPercentage() public view returns (uint256) {
        uint256 userBalance = IERC20(address(this)).balanceOf(msg.sender);
        uint256 totalSupply = tokensTotal;
        require(totalSupply > 0, "Total supply is zero");

        uint256 percentage = (userBalance * 1e6) / totalSupply;
        // uint256 userRewardShare = (_rewards_total * percentage) / 1e6;
        return percentage;
    }

    /* ====================== ADMIN ACTIONS ====================== */

    function depositFunds(uint256 amount) public onlyOwner {
        IERC20 usd_token = IERC20(usdtAddress);
        require(
            usd_token.balanceOf(msg.sender) >= amount,
            "Insufficient Token balance"
        );
        require(usd_token.transferFrom(msg.sender, address(this), amount), "Deposit transfer failed");
        _rewardsTotal = amount;
    }

    function withdraw(IERC20 token, uint256 amount) public onlyOwner {
        require(
            token.balanceOf(address(this)) >= amount,
            "Not enought balance"
        );
        require(token.approve(address(this), amount), 'Token was not approved');
        require(token.transferFrom(address(this), msg.sender, amount), "Withdraw to owner failed");
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
