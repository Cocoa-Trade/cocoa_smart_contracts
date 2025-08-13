const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers.js");
const { ethers } = require('hardhat');
const { expect } = require("chai");

describe("FundingFactory", function () {
    async function deployFactoryFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        const UsdxToken = await ethers.getContractFactory("UsdxToken");
        const usdx = await UsdxToken.deploy();
        const usdxAddress = await usdx.getAddress();

        const Factory = await ethers.getContractFactory("FundingFactory");
        const factory = await Factory.deploy(owner.address);
        const factoryAddress = await factory.getAddress();

        return { factory, owner, user1, user2, usdxAddress, factoryAddress };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should make the deployer an operator", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            expect(await factory.operators(owner.address)).to.be.true;
        });
    });

    describe("Access Control", function () {
        it("Should allow owner to add an operator", async function () {
            const { factory, owner, user1 } = await loadFixture(deployFactoryFixture);
            await factory.connect(owner).addOperator(user1.address);
            expect(await factory.operators(user1.address)).to.be.true;
        });

        it("Should allow owner to remove an operator", async function () {
            const { factory, owner, user1 } = await loadFixture(deployFactoryFixture);
            await factory.connect(owner).addOperator(user1.address);
            await factory.connect(owner).removeOperator(user1.address);
            expect(await factory.operators(user1.address)).to.be.false;
        });

        it("Should not allow non-owner to add or remove operators", async function () {
            const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);
            await expect(factory.connect(user1).addOperator(user2.address)).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
            await expect(factory.connect(user1).removeOperator(user2.address)).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });

    describe("createFundingContract", function () {
        it("Should allow an operator to create a new Funding contract", async function () {
            const { factory, owner, usdxAddress } = await loadFixture(deployFactoryFixture);

            const tokensTotal = ethers.parseUnits("1000000", 18);
            const minAmount = ethers.parseUnits("100", 18);
            const name = "Test Funding";
            const symbol = "TEST";

            await expect(factory.connect(owner).createFundingContract(
                tokensTotal,
                minAmount,
                name,
                symbol,
                usdxAddress,
                usdxAddress
            )).to.emit(factory, "FundingCreated");
        });

        it("Should not allow a non-operator to create a contract", async function () {
            const { factory, user1, usdxAddress } = await loadFixture(deployFactoryFixture);

            const tokensTotal = ethers.parseUnits("1000000", 18);
            const minAmount = ethers.parseUnits("100", 18);
            const name = "Test Funding";
            const symbol = "TEST";

            await expect(factory.connect(user1).createFundingContract(
                tokensTotal,
                minAmount,
                name,
                symbol,
                usdxAddress,
                usdxAddress
            )).to.be.revertedWith("Not an operator");
        });
    });
});