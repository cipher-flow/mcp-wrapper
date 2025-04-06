import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

  async callContractFunction(contractAddress, functionName, params, abi = []) {
    try {
      await this.validateConnection();

      if (!ethers.isAddress(contractAddress)) {
        throw new Error('Invalid contract address');
      }

      const contract = new ethers.Contract(contractAddress, abi, this.provider);
      const result = await contract[functionName](...params);

      // Handle different return types
      if (Array.isArray(result)) {
        return result.map(r => r.toString ? r.toString() : r);
      } else if (result?.toString) {
        return result.toString();
      }
      return result;
    } catch (error) {
      throw new Error(`Failed to call contract function ${functionName}: ${error.message}`);
    }
  }
}

export const ethereumService = new EthereumService();