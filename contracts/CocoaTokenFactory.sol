// SPDX-License-Identifier: MIT
// Factory for Public Mintable User NFT Collection

pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./CocoaToken.sol";

contract CocoaTokenFactory is Ownable {
    mapping(address => bool) public factoryOperators;

    constructor() Ownable(msg.sender) {
        factoryOperators[msg.sender] = true;
    }

    function deployNewCocoaToken(
        uint256 capacity,
        string memory name,
        string memory symbol
    ) public returns (address newToken) {
        require(factoryOperators[msg.sender], "Only for operators");
        newToken = address(new CocoaToken(owner(), capacity, name, symbol));
    }

    ///////////////////////////////////////////
    /////  Admin functions     ////////////////
    ///////////////////////////////////////////
    function setOperatorStatus(
        address _operator,
        bool _isValid
    ) external onlyOwner {
        factoryOperators[_operator] = _isValid;
    }
}
