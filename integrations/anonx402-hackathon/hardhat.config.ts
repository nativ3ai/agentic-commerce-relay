import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const BASE_MAINNET_RPC_URL = process.env.RPC_URL_BASE_MAINNET || 'https://mainnet.base.org';
const BASE_SEPOLIA_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA || 'https://base-sepolia-rpc.publicnode.com';
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {},
    baseMainnet: {
      url: BASE_MAINNET_RPC_URL,
      chainId: BASE_MAINNET_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};

export default config;
