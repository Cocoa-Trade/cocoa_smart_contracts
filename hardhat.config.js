require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.8.24",
      },
      {
        version: "0.8.28",
      },
    ],
  },
  networks: {
    zkEVM: {
      url: process.env.ALCHEMY_HTTP_TRANSPORT_URL,
      accounts: [process.env.SIGNER_PRIVATE_KEY],
    },
  },
  hardhat: {
    chainId: 137,
    forking: {
      enabled: true,
      url: process.env.ALCHEMY_HTTP_TRANSPORT_URL,
    },
  },
};
