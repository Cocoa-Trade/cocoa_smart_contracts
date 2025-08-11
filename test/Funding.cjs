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
    const tokensTotal = ethers.parseUnits("1000000", 18);
    const minAmount = ethers.parseUnits("100", 18);
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
    await usdx.mint(user1.address, ethers.parseUnits("10000", 18));
    await usdx.mint(user2.address, ethers.parseUnits("10000", 18));

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
      const amountToBuy = ethers.parseUnits("500", 18);

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
        const amountToBuy = ethers.parseUnits("50", 18); // less than 100
        await expect(funding.connect(user1).initSaleUSDT(amountToBuy)).to.be.revertedWith("Amount is below minimum");
    });

    it("Should revert if user has not approved tokens", async function () {
        const { funding, user1 } = await loadFixture(deployFundingFixture);
        const amountToBuy = ethers.parseUnits("500", 18);
        await expect(funding.connect(user1).initSaleUSDT(amountToBuy)).to.be.reverted;
    });

    it("Should handle multiple investments from the same user", async function () {
        const { funding, usdx, user1, usdxAddress, fundingAddress } = await loadFixture(deployFundingFixture);
        const amount1 = ethers.parseUnits("200", 18);
        const amount2 = ethers.parseUnits("300", 18);
        const totalAmount = ethers.parseUnits("500", 18);

        await usdx.connect(user1).approve(fundingAddress, totalAmount);
        await funding.connect(user1).initSaleUSDT(amount1);
        await funding.connect(user1).initSaleUSDT(amount2);

        expect(await funding.balanceOf(user1.address)).to.equal(totalAmount);
        expect(await usdx.balanceOf(fundingAddress)).to.equal(totalAmount);
        expect(await funding.userInvestments(user1.address, usdxAddress)).to.equal(totalAmount);
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
        await expect(funding.connect(user1).withdraw(usdx, ethers.parseUnits("100", 18))).to.be.revertedWithCustomError(funding, "OwnableUnauthorizedAccount");
    });
  });
});
