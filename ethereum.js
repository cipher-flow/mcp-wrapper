import { ethers } from 'ethers';

class EthereumService {
  constructor() {
    this.providers = new Map();
  }

  setRpcUrl(serverName, rpcUrl) {
    if (!rpcUrl) {
      throw new Error('Chain RPC URL is required for the server.');
    }
    this.providers.set(serverName, new ethers.JsonRpcProvider(rpcUrl));
  }

  getProvider(serverName) {
    const provider = this.providers.get(serverName);
    if (!provider) {
      throw new Error(`No RPC provider found for server: ${serverName}`);
    }
    return provider;
  }

  async validateConnection(serverName) {
    try {
      const provider = this.getProvider(serverName);
      await provider.getNetwork();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Chain RPC: ${error.message}`);
    }
  }

  async callContractFunction(serverName, contractAddress, functionName, params, abi = []) {
    try {
      await this.validateConnection(serverName);
      const provider = this.getProvider(serverName);

      if (!ethers.isAddress(contractAddress)) {
        throw new Error('Invalid contract address');
      }

      const contract = new ethers.Contract(contractAddress, abi, provider);
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