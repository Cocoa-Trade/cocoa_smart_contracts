const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers.js");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs.js");
const { ethers, upgrades } = require('hardhat');
const { expect } = require("chai");

describe("Lock", function () {
  async function deployCocoaFixture() {
    const capacity = 10 ** 6 * 300_000;
    const usdx_amount = 10 ** 6 * 500_000;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, acc1, acc2, acc3, acc4] = await ethers.getSigners();

    const CocoaToken = await ethers.getContractFactory("CocoaToken");
    const cocoa = await CocoaToken.deploy(owner, capacity, "test token", "tttwww1");

    const UsdxToken = await ethers.getContractFactory("UsdxToken");
    const usdx = await UsdxToken.deploy();
    await usdx.mint(owner, usdx_amount);
    await usdx.mint(otherAccount, usdx_amount);
    await usdx.mint(acc1, usdx_amount);
    await usdx.mint(acc2, usdx_amount);
    await usdx.mint(acc3, usdx_amount);
    await usdx.mint(acc4, usdx_amount);
    await cocoa.setUsdtContract(usdx);

    return { cocoa, usdx, capacity, usdx_amount, owner, otherAccount, acc1, acc2, acc3, acc4 };
  }

  describe("Deployment", function () {
    it("Should be minted as capacity", async function () {
      const { cocoa, capacity } = await loadFixture(deployCocoaFixture);

      expect(await cocoa.balanceOf(cocoa)).to.equal(capacity);
    });

    it("USDX Should be setted as usdt", async function () {
      const { cocoa, usdx } = await loadFixture(deployCocoaFixture);
      const usdt = await cocoa.getUsdtContract();
      expect(usdt).to.equal(usdx);
    });
  });

  describe("Usage", function () {
    it("Should USDX be approved", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 10);
      expect(await usdx.allowance(otherAccount, cocoa)).to.equal(10000000);
    });

    it("Should revert usdt tx", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 100);
      // expect(await usdx.transferFrom(otherAccount, cocoa, 10 ** 6 * 10)).to.be.reverted;
      expect(await usdx.connect(otherAccount).transfer(cocoa, 10 ** 6 * 100)).to.be.reverted;
    });

    it("Should send tx from user", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 10);
      await cocoa.connect(otherAccount).initSaleUSDT(10 ** 6 * 10);
      expect(await cocoa.balanceOf(otherAccount)).to.equal(10000000);
      // console.log('cocoa :>> ', await cocoa.balanceOf(cocoa));
    });

    it("Should update balances", async function () {
      const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
      await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 100);
      await cocoa.connect(otherAccount).initSaleUSDT(10 ** 6 * 100);
      expect(await cocoa.getBalanceOf(otherAccount)).to.equal(100000000);
      await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 100);
      await cocoa.connect(otherAccount).initSaleUSDT(10 ** 6 * 100);
      expect(await cocoa.getBalanceOf(otherAccount)).to.equal(200000000);
      // console.log('balanceOf :>> ', await cocoa.getBalanceOf(otherAccount));
    });

    // it("Should be reverted by available amount", async function () {
    //   const { cocoa, usdx, otherAccount } = await loadFixture(deployCocoaFixture);
    //   await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 600);
    //   await expect(cocoa.connect(otherAccount).initSaleUSDT(10 ** 6 * 600)).to.be.reverted;
    // });

    // it("Should be reverted by available amount", async function () {
    //   const { cocoa, usdx, otherAccount, acc1, acc2, acc3, acc4 } = await loadFixture(deployCocoaFixture);
    //   await usdx.connect(otherAccount).approve(cocoa, 10 ** 6 * 200);
    //   await usdx.connect(acc1).approve(cocoa, 10 ** 6 * 200);
    //   await usdx.connect(acc2).approve(cocoa, 10 ** 6 * 200);
    //   await usdx.connect(acc3).approve(cocoa, 10 ** 6 * 200);
    //   await usdx.connect(acc4).approve(cocoa, 10 ** 6 * 200);
    //   await expect(cocoa.connect(otherAccount).initSaleUSDT(10 ** 6 * 200)).not.to.be.reverted;
    //   await expect(cocoa.connect(acc1).initSaleUSDT(10 ** 6 * 200)).not.to.be.reverted;
    //   await expect(cocoa.connect(acc2).initSaleUSDT(10 ** 6 * 200)).to.be.reverted;
    //   await expect(cocoa.connect(acc3).initSaleUSDT(10 ** 6 * 200)).to.be.reverted;
    //   await expect(cocoa.connect(acc4).initSaleUSDT(10 ** 6 * 200)).to.be.reverted;
    // });

    it("Should calc percantages", async function () {
      const { cocoa, usdx, owner, otherAccount, acc1, acc2, acc3, acc4 } = await loadFixture(deployCocoaFixture);
      await usdx.connect(acc1).approve(cocoa, 10 ** 6 * 100);
      await usdx.connect(acc2).approve(cocoa, 10 ** 6 * 1_000);
      await usdx.connect(acc3).approve(cocoa, 10 ** 6 * 30_000);
      await usdx.connect(acc4).approve(cocoa, 10 ** 6 * 4000);
      await expect(cocoa.connect(acc1).initSaleUSDT(10 ** 6 * 100)).not.to.be.reverted;
      await expect(cocoa.connect(acc2).initSaleUSDT(10 ** 6 * 1_000)).not.to.be.reverted;
      await expect(cocoa.connect(acc3).initSaleUSDT(10 ** 6 * 30_000)).not.to.be.reverted;
      await expect(cocoa.connect(acc4).initSaleUSDT(10 ** 6 * 4000)).not.to.be.reverted;
      await usdx.connect(owner).approve(cocoa, 10 ** 6 * 300_000);
      await expect(cocoa.connect(owner).depositFunds(10 ** 6 * 300_000)).not.to.be.reverted;
      expect(await cocoa.connect(otherAccount).getRewardsTotal()).to.equal(10**6*300_000);
      console.log('calc percentage :>> ', await cocoa.connect(acc1).calculateUserTokenPercentage());
      console.log('calc percentage :>> ', await cocoa.connect(acc2).calculateUserTokenPercentage());
      console.log('calc percentage :>> ', await cocoa.connect(acc3).calculateUserTokenPercentage());
      console.log('calc percentage :>> ', await cocoa.connect(acc4).calculateUserTokenPercentage());
    });

    it("Should claim rewards", async function () {
      const { capacity, cocoa, usdx, owner, otherAccount, acc1 } = await loadFixture(deployCocoaFixture);
      console.log('init calc percentage acc1:>> ', await cocoa.connect(acc1).calculateUserTokenPercentage());
      await usdx.connect(acc1).approve(cocoa, 10 ** 6 * 12_000);
      await expect(cocoa.connect(acc1).initSaleUSDT(10 ** 6 * 12_000)).not.to.be.reverted;
      console.log('sale percentage acc1:>> ', await cocoa.connect(acc1).calculateUserTokenPercentage());

      await usdx.connect(owner).approve(cocoa, 10 ** 6 * 400_000);
      await expect(cocoa.connect(owner).depositFunds(10 ** 6 * 400_000)).not.to.be.reverted;
      expect(await cocoa.connect(otherAccount).getRewardsTotal()).to.equal(10 ** 6 * 400_000);
      await cocoa.connect(acc1).approve(cocoa, 10 ** 6 * 12_000);
      await cocoa.connect(acc1).claim();

      console.log('totalSupply :>> ', await cocoa.connect(acc1).totalSupply());
      // console.log('getRewardsTotal :>> ', await cocoa.connect(acc1).getRewardsTotal());
      console.log('usdx.balanceOf(acc1) :>> ', await usdx.balanceOf(acc1));
      console.log('cocoa.balanceOf(acc1) :>> ', await cocoa.balanceOf(acc1));

      // expect(await usdx.balanceOf(acc1)).to.equal(10 ** 6 * 12_000);
      expect(await cocoa.connect(acc1).calculateUserTokenPercentage()).to.equal(0n)
      expect(await cocoa.connect(acc1).totalSupply()).to.equal(capacity - (10 ** 6 * 12_000))
      // console.log('claimed percentage acc1:>> ', await cocoa.connect(acc1).calculateUserTokenPercentage());
    });

    it("Should get balance by wallet", async function () {
      const { capacity, cocoa, usdx, owner, otherAccount, acc1 } = await loadFixture(deployCocoaFixture);
      console.log('getBalanceOf otherAccount', await cocoa.getBalanceOf(otherAccount));
    });

  });
});
