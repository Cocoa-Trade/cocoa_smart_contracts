// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Funding.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FundingFactory is Ownable {
    address[] public deployedFundings;
    mapping(address => bool) public operators;

    event FundingCreated(
        address indexed fundingAddress,
        address indexed owner,
        string name,
        string symbol
    );

    modifier onlyOperator() {
        require(operators[msg.sender], "Not an operator");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        operators[initialOwner] = true; // The deployer is an operator
    }

    function addOperator(address operator) public onlyOwner {
        operators[operator] = true;
    }

    function removeOperator(address operator) public onlyOwner {
        operators[operator] = false;
    }

    function createFundingContract(
        uint256 tokensTotal_,
        uint256 minAmount_,
        string memory name,
        string memory symbol,
        address usdtAddress_,
        address usdcAddress_
    ) public onlyOperator {
        Funding newFunding = new Funding(
            msg.sender, // The owner of the created contract is the operator who called the function
            tokensTotal_,
            minAmount_,
            name,
            symbol,
            usdtAddress_,
            usdcAddress_
        );
        deployedFundings.push(address(newFunding));
        emit FundingCreated(address(newFunding), msg.sender, name, symbol);
    }

    function getDeployedFundings() public view returns (address[] memory) {
        return deployedFundings;
    }
}