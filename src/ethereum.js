import { ethers } from 'ethers';
import { storage } from './storage.js';

class EthereumService {
  getProvider(serverName) {
    const serverInfo = storage.getServer(serverName);
    if (!serverInfo?.chainRpcUrl) {
      throw new Error(`No chain RPC URL found for server: ${serverName}`);
    }
    return new ethers.JsonRpcProvider(serverInfo.chainRpcUrl);
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

  async constructTransactionData(serverName, contractAddress, functionName, params, abi = []) {
    try {
      await this.validateConnection(serverName);
      const provider = this.getProvider(serverName);

      if (!ethers.isAddress(contractAddress)) {
        throw new Error("Invalid contract address");
      }

      const contract = new ethers.Contract(contractAddress, abi, provider);
      const populatedTransaction = await contract[functionName].populateTransaction(...params);

      return {
        to: contractAddress,
        data: populatedTransaction.data,
        value: populatedTransaction.value?.toString() || '0',
        chainId: (await provider.getNetwork()).chainId.toString()
      };
    } catch (error) {
      throw new Error(`Failed to construct transaction data: ${error.message}`);
    }
  }

  async callContractFunction(
    serverName,
    contractAddress,
    functionName,
    params,
    abi = []
  ) {
    try {
      await this.validateConnection(serverName);
      const provider = this.getProvider(serverName);

      if (!ethers.isAddress(contractAddress)) {
        throw new Error("Invalid contract address");
      }

      const contract = new ethers.Contract(contractAddress, abi, provider);
      const result = await contract[functionName](...params);

      // Handle different return types
      if (Array.isArray(result)) {
        return result.map((r) => (r.toString ? r.toString() : r));
      } else if (result?.toString) {
        return result.toString();
      }
      return result;
    } catch (error) {
      throw new Error(
        `Failed to call contract function ${functionName}: ${error.message}`
      );
    }
  }
}

export const ethereumService = new EthereumService();