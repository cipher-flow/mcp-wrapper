import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Standard ERC20 ABI for common functions
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

class EthereumService {
  constructor(rpcUrl = process.env.ETHEREUM_RPC_URL) {
    if (!rpcUrl) {
      throw new Error('Ethereum RPC URL is required. Please set ETHEREUM_RPC_URL in your environment variables.');
    }
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async validateConnection() {
    try {
      await this.provider.getNetwork();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Ethereum RPC: ${error.message}`);
    }
  }

  async getERC20Balance(contractAddress, walletAddress) {
    try {
      await this.validateConnection();

      if (!ethers.isAddress(contractAddress) || !ethers.isAddress(walletAddress)) {
        throw new Error('Invalid contract or wallet address');
      }

      const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
      let balance, decimals, symbol;
      try {
        [balance, decimals, symbol] = await Promise.all([
          contract.balanceOf(walletAddress),
          contract.decimals(),
          contract.symbol()
        ]);
      } catch (contractError) {
        throw new Error(`Failed to interact with ERC20 contract: ${contractError.message}. Please verify the contract address and ABI.`);
      }

      const formattedBalance = ethers.formatUnits(balance, decimals);
      return {
        balance: formattedBalance,
        symbol,
        decimals: decimals
      };
    } catch (error) {
      throw new Error(`Failed to get ERC20 balance: ${error.message}`);
    }
  }
}

export const ethereumService = new EthereumService();