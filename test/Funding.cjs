const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers.js");
const { ethers } = require('hardhat');
const { expect } = require("chai");

describe("Funding", function () {
  async function deployFundingFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy UsdxToken
    const UsdxToken = await ethers.getContractFactory("UsdxToken");
    const usdx = await UsdxToken.deploy();
    const usdxAddress = await usdx.getAddress();

    // Deploy Funding contract
    const tokensTotal = ethers.parseUnits("1000", 18);
    const minAmount = ethers.parseUnits("1", 18);
    const Funding = await ethers.getContractFactory("Funding");
    const funding = await Funding.deploy(
      owner.address,
      tokensTotal,
      minAmount,
      "Funding Token",
      "FUND",
      usdxAddress,
      usdxAddress // Using same for usdc for simplicity
    );
    const fundingAddress = await funding.getAddress();

    // Mint Usdx for users
    await usdx.mint(user1.address, ethers.parseUnits("100000", 18));
    await usdx.mint(user2.address, ethers.parseUnits("100000", 18));

    return { funding, usdx, owner, user1, user2, tokensTotal, minAmount, usdxAddress, fundingAddress };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { funding, owner } = await loadFixture(deployFundingFixture);
      expect(await funding.owner()).to.equal(owner.address);
    });

    it("Should have the total supply of tokens in the contract", async function () {
      const { funding, tokensTotal } = await loadFixture(deployFundingFixture);
      expect(await funding.balanceOf(await funding.getAddress())).to.equal(tokensTotal);
    });
  });

  describe("initSaleUSDT", function () {
    it("Should allow a user to buy tokens", async function () {
      const { funding, usdx, user1, usdxAddress, fundingAddress } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("50", 18);

      await usdx.connect(user1).approve(fundingAddress, amountToBuy);
      await funding.connect(user1).initSaleUSDT(amountToBuy);

      // Check user's funding token balance
      expect(await funding.balanceOf(user1.address)).to.equal(amountToBuy);

      // Check contract's usdx balance
      expect(await usdx.balanceOf(fundingAddress)).to.equal(amountToBuy);

      // Check userInvestments mapping
      expect(await funding.userInvestments(user1.address, usdxAddress)).to.equal(amountToBuy);
    });

    it("Should revert if amount is less than minAmount", async function () {
      const { funding, user1 } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("0.5", 18); // less than 100
      await expect(funding.connect(user1).initSaleUSDT(amountToBuy)).to.be.revertedWithCustomError(funding, "AmountBelowMin");
    });

    it("Should revert if user has not approved tokens", async function () {
      const { funding, user1 } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("5", 18);
      await expect(funding.connect(user1).initSaleUSDT(amountToBuy)).to.be.reverted;
    });

    it("Should handle multiple investments from the same user", async function () {
      const { funding, usdx, user1, usdxAddress, fundingAddress } = await loadFixture(deployFundingFixture);
      const amount1 = ethers.parseUnits("2", 18);
      const amount2 = ethers.parseUnits("3", 18);
      const totalAmount = ethers.parseUnits("5", 18);

      await usdx.connect(user1).approve(fundingAddress, totalAmount);
      await funding.connect(user1).initSaleUSDT(amount1);
      await funding.connect(user1).initSaleUSDT(amount2);

      expect(await funding.balanceOf(user1.address)).to.equal(totalAmount);
      expect(await usdx.balanceOf(fundingAddress)).to.equal(totalAmount);
      expect(await funding.userInvestments(user1.address, usdxAddress)).to.equal(totalAmount);
    });

    it("Should revert if amount exceeds available tokens", async function () {
      const { funding, usdx, user1, tokensTotal, fundingAddress } = await loadFixture(deployFundingFixture);
      const amount1 = ethers.parseUnits("20", 18);
      const amount2 = tokensTotal + BigInt(1); // More than total supply

      await usdx.connect(user1).approve(fundingAddress, amount1);
      await funding.connect(user1).initSaleUSDT(amount1);
      await usdx.connect(user1).approve(fundingAddress, amount2);
      await expect(funding.connect(user1).initSaleUSDT(amount2)).to.be.revertedWithCustomError(funding, "AmountExceedsAvailable");
    });
  });

  describe("Withdrawal", function () {
    it("Should allow the owner to withdraw tokens", async function () {
      const { funding, usdx, owner, user1, fundingAddress } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("1000", 18);
      await usdx.connect(user1).approve(fundingAddress, amountToBuy);
      await funding.connect(user1).initSaleUSDT(amountToBuy);

      const ownerInitialBalance = await usdx.balanceOf(owner.address);
      await funding.connect(owner).withdraw(usdx, amountToBuy);

      expect(await usdx.balanceOf(fundingAddress)).to.equal(0);
      expect(await usdx.balanceOf(owner.address)).to.equal(ownerInitialBalance + amountToBuy);
    });

    it("Should not allow non-owner to withdraw", async function () {
      const { funding, usdx, user1 } = await loadFixture(deployFundingFixture);
      await expect(funding.connect(user1).withdraw(usdx, ethers.parseUnits("100", 18))).to.be.revertedWithCustomError(funding, "NotTheOwner");
    });
  });

  describe("getPercentage", function () {
    it("Should return the correct percentage", async function () {
      const { funding, usdx, user1, tokensTotal, fundingAddress } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("500", 18);

      await usdx.connect(user1).approve(fundingAddress, amountToBuy);
      await funding.connect(user1).initSaleUSDT(amountToBuy);

      const userBalance = await funding.balanceOf(user1.address);
      console.log('userBalance :>> ', userBalance);
      console.log('tokensTotal :>> ', tokensTotal);

      const contractPercentage =  await funding.connect(user1).getPercentage();
      console.log('contractPercentage :>> ', contractPercentage);
      // (userBalance * 1e6) / rewardsTotal
      const expectedPercentage = (userBalance * BigInt(1e6)) / tokensTotal;
      console.log('expectedPercentage :>> ', expectedPercentage);
      expect(contractPercentage).to.equal(expectedPercentage);
    });

    it("Should handle zero user balance", async function () {
      const { funding, user1 } = await loadFixture(deployFundingFixture);
      await expect(funding.connect(user1).getPercentage()).to.be.reverted;
    });
  });

  describe("Claim", function () {
    async function setupClaimFixture() {
      const { funding, usdx, owner, user1, user2, tokensTotal, fundingAddress } = await loadFixture(deployFundingFixture);

      // Users buy funding tokens
      const user1Amount = ethers.parseUnits("5", 18); // Represents a percentage of total supply
      const user2Amount = ethers.parseUnits("20", 18);

      await usdx.connect(user1).approve(fundingAddress, user1Amount);
      await funding.connect(user1).initSaleUSDT(user1Amount);

      await usdx.connect(user2).approve(fundingAddress, user2Amount);
      await funding.connect(user2).initSaleUSDT(user2Amount);

      return { funding, usdx, owner, user1, user2, tokensTotal, fundingAddress, user1Amount, user2Amount };
    }

    it("Should allow a user to claim their rewards", async function () {
      const { funding, usdx, owner, user1, user1Amount, tokensTotal } = await loadFixture(setupClaimFixture);

      // Deposit rewards
      const rewardsAmount = ethers.parseUnits("5000", 18);
      await usdx.mint(owner.address, rewardsAmount);
      await usdx.connect(owner).approve(await funding.getAddress(), rewardsAmount);
      await funding.connect(owner).depositFunds(usdx, rewardsAmount);

      const user1FundingBalanceBefore = await funding.balanceOf(user1.address);
      expect(user1FundingBalanceBefore).to.equal(user1Amount);

      // const percentage = (user1FundingBalanceBefore * BigInt(1e6)) / tokensTotal;
      const contract_percentage = await funding.connect(user1).getPercentage();
      // console.log('percentage :>> ', percentage);
      console.log('contract_percentage :>> ', contract_percentage);
      const expectedReward = (rewardsAmount * contract_percentage) / BigInt(1e6);

      const user1UsdxBalanceBefore = await usdx.balanceOf(user1.address);

      await expect(funding.connect(user1).claim()).to.not.be.reverted;

      const user1FundingBalanceAfter = await funding.balanceOf(user1.address);
      expect(user1FundingBalanceAfter).to.equal(0);

      const user1UsdxBalanceAfter = await usdx.balanceOf(user1.address);
      expect(user1UsdxBalanceAfter).to.equal(user1UsdxBalanceBefore + expectedReward);
    });

    it("Should revert if claim is not available", async function () {
      const { funding, user1 } = await loadFixture(setupClaimFixture);
      await expect(funding.connect(user1).claim()).to.be.revertedWithCustomError(funding, "ClaimIsNotAvailable");
    });

    it("Should revert if user has no funding tokens", async function () {
      const { funding, owner, usdx } = await loadFixture(deployFundingFixture);
      const [, , user3] = await ethers.getSigners();

      // Deposit rewards
      const rewardsAmount = ethers.parseUnits("5000", 18);
      await usdx.mint(owner.address, rewardsAmount);
      await usdx.connect(owner).approve(await funding.getAddress(), rewardsAmount);
      await funding.connect(owner).depositFunds(usdx, rewardsAmount);

      await expect(funding.connect(user3).claim()).to.be.revertedWithCustomError(funding, "UserZeroBalance");
    });

    it("Should handle multiple users claiming correctly", async function () {
      const { funding, usdx, owner, user1, user2, user1Amount, user2Amount, tokensTotal } = await loadFixture(setupClaimFixture);

      const rewardsAmount = ethers.parseUnits("10000", 18);
      await usdx.mint(owner.address, rewardsAmount);
      await usdx.connect(owner).approve(await funding.getAddress(), rewardsAmount);
      await funding.connect(owner).depositFunds(usdx, rewardsAmount);

      // User 1 claims
      const user1Percentage = (user1Amount * BigInt(1e6)) / tokensTotal;
      const user1ExpectedReward = (rewardsAmount * user1Percentage) / BigInt(1e6);
      const user1UsdxBalanceBefore = await usdx.balanceOf(user1.address);
      await funding.connect(user1).claim();
      const user1UsdxBalanceAfter = await usdx.balanceOf(user1.address);
      expect(user1UsdxBalanceAfter).to.equal(user1UsdxBalanceBefore + user1ExpectedReward);
      expect(await funding.balanceOf(user1.address)).to.equal(0);

      // User 2 claims
      const user2Percentage = (user2Amount * BigInt(1e6)) / tokensTotal;
      const user2ExpectedReward = (rewardsAmount * user2Percentage) / BigInt(1e6);
      const user2UsdxBalanceBefore = await usdx.balanceOf(user2.address);
      await funding.connect(user2).claim();
      const user2UsdxBalanceAfter = await usdx.balanceOf(user2.address);
      expect(user2UsdxBalanceAfter).to.equal(user2UsdxBalanceBefore + user2ExpectedReward);
      expect(await funding.balanceOf(user2.address)).to.equal(0);
    });
    it("Should handle multiple users claiming correctly", async function () {
      const { funding, usdx, owner, user1, user2, user1Amount, user2Amount, tokensTotal } = await loadFixture(setupClaimFixture);
      // Deposit rewards
      const rewardsAmount = ethers.parseUnits("10000", 18);
      await usdx.mint(owner.address, rewardsAmount);
      await usdx.connect(owner).approve(await funding.getAddress(), rewardsAmount);
      await funding.connect(owner).depositFunds(usdx, rewardsAmount);

      const user1Percentage = await funding.connect(user1).getPercentage()
      console.log('user1Percentage :>> ', Number(user1Percentage) / 1e6);
      const user1ExpectedReward = (rewardsAmount * user1Percentage) / BigInt(1e6);
      console.log('user1ExpectedReward n:>> ', user1ExpectedReward);
      console.log('user1ExpectedReward :>> ', Number(user1ExpectedReward) / 1e18);
      const user1UsdxBalanceBefore = await usdx.balanceOf(user1.address);
      console.log('user1UsdxBalanceBefore :>> ', Number(user1UsdxBalanceBefore) / 1e18);
      await funding.connect(user1).claim();
      const user1UsdxBalanceAfter = await usdx.balanceOf(user1.address);
      console.log('user1UsdxBalanceAfter :>> ', Number(user1UsdxBalanceAfter) / 1e18);
      expect(user1UsdxBalanceAfter).to.equal(user1UsdxBalanceBefore + user1ExpectedReward);
      expect(await funding.balanceOf(user1.address)).to.equal(0);

    });

  describe("decreaseTokensTotal", function () {
    it("Should allow the owner to decrease the total supply", async function () {
      const { funding, owner } = await loadFixture(deployFundingFixture);
      const amountToBurn = ethers.parseUnits("100", 18);
      const initialTotalSupply = await funding.totalSupply();
      const initialRemain = await funding.getRemainTokensAmount();

      await expect(funding.connect(owner).decreaseTokensTotal(amountToBurn)).to.not.be.reverted;

      const newTotalSupply = await funding.totalSupply();
      const newRemain = await funding.getRemainTokensAmount();

      expect(newTotalSupply).to.equal(initialTotalSupply - amountToBurn);
      expect(newRemain).to.equal(initialRemain - amountToBurn);
      expect(await funding.balanceOf(await funding.getAddress())).to.equal(initialTotalSupply - amountToBurn);
    });

    it("Should revert if called by a non-owner", async function () {
      const { funding, user1 } = await loadFixture(deployFundingFixture);
      const amountToBurn = ethers.parseUnits("100", 18);
      await expect(funding.connect(user1).decreaseTokensTotal(amountToBurn)).to.be.revertedWithCustomError(funding, "NotTheOwner");
    });

    it("Should revert if new total supply is less than tokens sold", async function () {
      const { funding, owner, usdx, user1, fundingAddress } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("500", 18);
      await usdx.connect(user1).approve(fundingAddress, amountToBuy);
      await funding.connect(user1).initSaleUSDT(amountToBuy);

      const soldTokens = await funding.tokensSold()
      const currentTotalSupply = await funding.totalSupply();
      const amountToBurn = currentTotalSupply - soldTokens + BigInt(1);
      await expect(funding.connect(owner).decreaseTokensTotal(amountToBurn)).to.be.revertedWithCustomError(funding, "NewTotalSupplyBelowSold");
    });
    it("Should be 100% after decrease", async function () {
      const { funding, owner, usdx, user1, fundingAddress } = await loadFixture(deployFundingFixture);
      const amountToBuy = ethers.parseUnits("500", 18);
      await usdx.connect(user1).approve(fundingAddress, amountToBuy);
      await funding.connect(user1).initSaleUSDT(amountToBuy);

      const soldTokens = await funding.tokensSold()
      const currentTotalSupply = await funding.totalSupply();
      const amountToBurn = currentTotalSupply - soldTokens;
      await funding.connect(owner).decreaseTokensTotal(amountToBurn);
      const contract_percentage = await funding.connect(user1).getPercentage();
      // 1000000n = 100.0000 = 100%
      expect(contract_percentage).to.be.equal(1000000n);
    });
  });

  });
});
