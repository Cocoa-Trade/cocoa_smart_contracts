// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0

pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/utils/Pausable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

contract CocoaToken is ERC20, Ownable, ReentrancyGuard {
    uint256 private _rewards_total;
    uint256 private immutable _tokens_total;
    uint256 private immutable _minAmount;
    uint256 private immutable _maxAmount;
    address private _usdt_address; // 0xc2132D05D31c914a87C6611C10748AEb04B58e8F
    address private _usdc_address; // 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359

    function getRewardsTotal() public view returns (uint256) {
        return _rewards_total;
    }

    function getUsdtContract() public view returns (address) {
        return _usdt_address;
    }

    function setUsdtContract(address usdt) public onlyOwner {
        _usdt_address = usdt;
    }

    function getUsdcContract() public view returns (address) {
        return _usdc_address;
    }

    function setUsdcContract(address usdc) public onlyOwner {
        _usdc_address = usdc;
    }

    constructor(
        address initialOwner,
        uint256 capacity,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _minAmount = 1e6;
        _maxAmount = 1e12;
        _mint(address(this), capacity);
        _tokens_total = capacity;
    }

    /**
     * @dev Throws if called from contract.
     */
    modifier onlyWallets() {
        require(msg.sender.code.length == 0, "Code 0");
        _;
    }

    modifier minMax(uint256 amount) {
        require(amount >= _minAmount && amount <= _maxAmount, "Min Max error");
        _;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /* ======================= USER ACTIONS ======================= */

    function _initSale(
        address user_address,
        uint256 amount,
        address sell_token
    ) private nonReentrant returns (bool) {
        IERC20 usd_token = IERC20(sell_token);
        require(
            usd_token.balanceOf(user_address) >= amount,
            "Insufficient Token balance"
        );

        usd_token.safeTransferFrom(user_address, address(this), amount);
        IERC20(address(this)).safeTransfer(msg.sender, amount);
        emit Payment(user_address, amount, sell_token);
        return true;
    }

    function initSaleUSDT(
        uint256 amount
    ) public onlyWallets minMax(amount) returns (bool) {
        bool success = _initSale(msg.sender, amount, _usdt_address);
        require(success, "Token transfer failed");
        return true;
    }

    function initSaleUSDC(
        uint256 amount
    ) public onlyWallets minMax(amount) returns (bool) {
        bool success = _initSale(msg.sender, amount, _usdc_address);
        require(success, "Token transfer failed");
        return true;
    }

    function claim() public onlyWallets nonReentrant returns (uint256) {
        IERC20 token = IERC20(address(this));
        uint256 user_available_balance = token.balanceOf(msg.sender);
        require(
            user_available_balance > 0,
            "Claim failed, balance error. You didnt buy that amount of tokens"
        );

        uint256 percentage = (user_available_balance * 1e6) / _tokens_total;
        uint256 userRewardShare = (_rewards_total * percentage) / 1e6;

        IERC20 usd_token = IERC20(_usdt_address);
        require(
            usd_token.balanceOf(address(this)) >= userRewardShare,
            "Insufficient Token balance"
        );

        token.safeTransferFrom(msg.sender, address(this), user_available_balance);

        require(usd_token.approve(address(this), 0), 'Usdt approve was not reset');
        require(usd_token.approve(address(this), userRewardShare), 'Usdt Reward was not approved');
        usd_token.safeTransferFrom(address(this), msg.sender, userRewardShare);

        _burn(address(this), user_available_balance);
        return userRewardShare;
    }

    function calculateUserTokenPercentage() public view returns (uint256) {
        uint256 userBalance = IERC20(address(this)).balanceOf(msg.sender);
        uint256 totalSupply = _tokens_total;
        require(totalSupply > 0, "Total supply is zero");

        uint256 percentage = (userBalance * 1e6) / totalSupply;
        // uint256 userRewardShare = (_rewards_total * percentage) / 1e6;
        return percentage;
    }

    /* ====================== ADMIN ACTIONS ====================== */

    function depositFunds(uint256 amount) public onlyOwner {
        IERC20 usd_token = IERC20(_usdt_address);
        require(
            usd_token.balanceOf(msg.sender) >= amount,
            "Insufficient Token balance"
        );
        usd_token.safeTransferFrom(msg.sender, address(this), amount);
        _rewards_total = amount;
    }

    function withdraw(IERC20 token, uint256 amount) public onlyOwner {
        require(
            token.balanceOf(address(this)) >= amount,
            "Not enought balance"
        );
        require(token.approve(address(this), amount), 'Token was not approved');
        token.safeTransferFrom(address(this), msg.sender, amount);
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
