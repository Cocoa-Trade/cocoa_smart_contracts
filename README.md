# CocoaToken User Documentation
CocoaToken is an ERC20-compliant token contract with additional features for managing rewards, token sales, and claims. This documentation provides an overview of the contract's functionality and how users can interact with it.

## Token Details
Name: Defined during contract deployment
Symbol: Defined during contract deployment
Decimals: 6


Key Features
1. Token Purchase
2. Reward Distribution
3. Token Claiming
4. Owner-only Administrative Functions


## User Functions
1. Purchasing Tokens
Users can purchase CocoaTokens using either USDT or USDC.

initSaleUSDT(uint256 amount): Purchase tokens using USDT
initSaleUSDC(uint256 amount): Purchase tokens using USDC


Note:
The purchase amount must be between the minimum (_minAmount) and maximum (_maxAmount) limits.
Only wallet addresses (not contracts) can make purchases.


2. Claiming Rewards
Users can claim their share of rewards based on the number of tokens they hold.

claim(): Claim your share of rewards


Note:
You must have a non-zero balance of CocoaTokens to claim rewards.
Claiming will burn your CocoaTokens and transfer the corresponding USDT rewards to your address.


3. Viewing Information
calculateUserTokenPercentage(): Check your percentage ownership of total tokens
getRewardsTotal(): View the total amount of rewards available
getUsdtContract(): Get the address of the USDT contract used for transactions
getUsdcContract(): Get the address of the USDC contract used for transactions


## Owner-only Functions
These functions are restricted to the contract owner:

setUsdtContract(address usdt): Set the USDT contract address
setUsdcContract(address usdc): Set the USDC contract address
depositFunds(uint256 amount): Deposit USDT rewards into the contract
withdraw(IERC20 token, uint256 amount): Withdraw any ERC20 token from the contract


Important Notes
1. The contract uses OpenZeppelin's SafeERC20 for secure token transfers.
2. It includes protection against reentrancy attacks.
3. Direct ETH transfers to the contract will be reverted.
4. The contract owner has significant control over the contract's operation, including the ability to set token addresses and withdraw funds.


## Events
Payment(address user_address, uint256 amount, address sell_token): Emitted when a user purchases tokens


For any issues or further questions, please contact the contract owner or the platform's support team.
