const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers.js");
const { ethers, upgrades } = require('hardhat');
const { expect } = require("chai");

describe("CocoaToken", function () {
  async function deployCocoaFixture() {
    const capacity = ethers.parseUnits("300000", 6);
    const minAmount = ethers.parseUnits("500", 18);
    const usdx_amount = ethers.parseUnits("20000", 18);

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, acc1, acc2, acc3, acc4] = await ethers.getSigners();

    const UsdxToken = await ethers.getContractFactory("UsdxToken");
    const usdx = await UsdxToken.deploy();
    const usdx_addr = await usdx.getAddress();

    const CocoaToken = await ethers.getContractFactory("CocoaToken");
    const cocoa = await CocoaToken.deploy(owner, capacity, minAmount, "test token", "tttwww1", usdx_addr, usdx_addr, false);

    await usdx.mint(owner, usdx_amount);
    await usdx.mint(otherAccount, usdx_amount);
    await usdx.mint(acc1, usdx_amount);
    await usdx.mint(acc2, usdx_amount);
    await usdx.mint(acc3, usdx_amount);
    await usdx.mint(acc4, usdx_amount);

    return { cocoa, usdx, capacity, usdx_amount, owner, otherAccount, acc1, acc2, acc3, acc4 };
  }

  describe("Deployment", function () {
    it("Should be minted as capacity", async function () {
      const { cocoa, capacity } = await loadFixture(deployCocoaFixture);
      expect(await cocoa.balanceOf(await cocoa.getAddress())).to.equal(capacity);
    });

    it("USDX Should be setted as usdt", async function () {
      const { cocoa, usdx } = await loadFixture(deployCocoaFixture);
      const usdt = await cocoa.usdtAddress();
      expect(usdt).to.equal(await usdx.getAddress());
    });
  });

  describe("Usage", function () {
    it("Should USDX be approved", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      const approveAmount = ethers.parseUnits("10", 18);
      await usdx.connect(otherAccount).approve(cocoa, approveAmount);
      expect(await usdx.allowance(otherAccount, await cocoa.getAddress())).to.equal(approveAmount);
    });

    it("Should not change total rewards", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      const amount = ethers.parseUnits("100", 6);
      await usdx.connect(otherAccount).approve(cocoa, amount);
      await expect(usdx.connect(otherAccount).transfer(cocoa, amount)).not.to.be.reverted;
      await expect(await cocoa.getRewardsTotal()).to.equal(0)
    });

    it("Should send tx from user", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      const amount = ethers.parseUnits("500", 18);
      await usdx.connect(otherAccount).approve(cocoa, amount);
      await cocoa.connect(otherAccount).initSaleUSDT(amount);
      expect(await cocoa.balanceOf(otherAccount)).to.equal(ethers.parseUnits("500", 6));
    });

    it("Should update balances", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      const amount = ethers.parseUnits("500", 18);
      await usdx.connect(otherAccount).approve(cocoa, amount);
      await cocoa.connect(otherAccount).initSaleUSDT(amount);
      expect(await cocoa.balanceOf(otherAccount)).to.equal(ethers.parseUnits("500", 6));
      await usdx.connect(otherAccount).approve(cocoa, amount);
      await cocoa.connect(otherAccount).initSaleUSDT(amount);
      expect(await cocoa.balanceOf(otherAccount)).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should calc percantages", async function () {
      const { cocoa, usdx, owner, otherAccount, acc1, acc2, acc3, acc4 } = await loadFixture(deployCocoaFixture);
      const amounts = [
        ethers.parseUnits("500", 18),
        ethers.parseUnits("1000", 18),
        ethers.parseUnits("30000", 18),
        ethers.parseUnits("4000", 18)
      ];
      const accounts = [acc1, acc2, acc3, acc4];

      for (let i = 0; i < amounts.length; i++) {
        await usdx.connect(accounts[i]).approve(cocoa, amounts[i]);
        await expect(cocoa.connect(accounts[i]).initSaleUSDT(amounts[i])).not.to.be.reverted;
      }

      const depositAmount = ethers.parseUnits("300000", 18);
      await usdx.connect(owner).approve(cocoa, depositAmount);
      await expect(cocoa.connect(owner).depositFunds(depositAmount)).not.to.be.reverted;
      expect(await cocoa.connect(otherAccount).getRewardsTotal()).to.equal(depositAmount);
    });

    it("Should claim rewards", async function () {
      const { capacity, cocoa, usdx, owner, otherAccount, acc1 } = await loadFixture(deployCocoaFixture);
      const saleAmount = ethers.parseUnits("12000", 18);
      await usdx.connect(acc1).approve(cocoa, saleAmount);
      await expect(cocoa.connect(acc1).initSaleUSDT(saleAmount)).not.to.be.reverted;

      const depositAmount = ethers.parseUnits("400000", 18);
      await usdx.connect(owner).approve(cocoa, depositAmount);
      await expect(cocoa.connect(owner).depositFunds(depositAmount)).not.to.be.reverted;
      expect(await cocoa.connect(otherAccount).getRewardsTotal()).to.equal(depositAmount);

      const acc1CocoaBalance = await cocoa.balanceOf(acc1);
      await cocoa.connect(acc1).approve(await cocoa.getAddress(), acc1CocoaBalance);
      await cocoa.connect(acc1).claim();

      expect(await cocoa.connect(acc1).calculateUserTokenPercentage()).to.equal(0n);
      const expectedTotalSupply = capacity - ethers.parseUnits("12000", 6);
      expect(await cocoa.totalSupply()).to.equal(expectedTotalSupply);
    });

    it("Should get balance by wallet", async function () {
      const { cocoa, otherAccount } = await loadFixture(deployCocoaFixture);
      expect(await cocoa.balanceOf(otherAccount)).to.equal(0);
    });

  });
});
