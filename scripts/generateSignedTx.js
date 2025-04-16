import { ethers } from 'ethers';
import 'dotenv/config';

if (process.argv[1].endsWith('generateSignedTx.js')) {
  const [,, network, from, to, txData] = process.argv;

  if (!network || !from || !to || !txData) {
    console.error('Usage: node generateSignedTx.js <network> <from> <to> <txData>');
    console.error('Example: node generateSignedTx.js mainnet 0x1234... 0x5678... 0x123abc...');
    process.exit(1);
  }
  console.log('Starting transaction creation process...');
  console.log(`Network: ${network}, From: ${from}, To: ${to}`);
  createSignedTx(network, JSON.stringify({
    from: from,
    to: to,
    data: txData
  }))
    .then(signedTx => {
      console.log('Signed Transaction:', signedTx);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

async function createSignedTx(network, txDataJson) {
  console.log('Starting transaction creation process...');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not found in .env');

  let mainnetRpc;
  let testnetRpc;
  if (env.INFURA_PROJECT_ID) {
    mainnetRpc = `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
    testnetRpc = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
  } else {
    mainnetRpc = "https://ethereum-rpc.publicnode.com"
    testnetRpc = "https://ethereum-sepolia-rpc.publicnode.com"
  }

  const provider = network === 'mainnet' ? new ethers.JsonRpcProvider(mainnetRpc) : new ethers.JsonRpcProvider(testnetRpc);

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet address: ${wallet.address}`);

  let txData;
  try {
    txData = JSON.parse(txDataJson);
    if (!txData.to || !txData.data) {
      throw new Error('Invalid transaction data: missing required fields');
    }
  } catch (error) {
    throw new Error(`Failed to parse transaction data: ${error.message}`);
  }

  console.log('Fetching fee data...');
  let gasPrice;
  try {
    gasPrice = await provider.getFeeData();
    console.log('Fee Data:', {
      maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
      gasPrice: gasPrice.gasPrice?.toString()
    });
  } catch (feeError) {
    console.error('Failed to get fee data:', feeError);
    throw new Error('Failed to retrieve network fee parameters');
  }

  console.log('Fetching transaction count...');
  const nonce = await wallet.getNonce();
  console.log(`Current nonce: ${nonce}`);

  txData = {
    ...txData,
    from: wallet.address,
    nonce: nonce,
    chainId: (await provider.getNetwork()).chainId,
    maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
  };

  console.log('Transaction Data:', JSON.stringify(txData, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
, 2));
  console.log('Transaction data prepared');

  console.log('Estimating gas...');
  let gasEstimate;
  try {
    gasEstimate = await provider.estimateGas(txData);
  } catch (estimateError) {
    console.error('Gas Estimation Error:', estimateError);
    gasEstimate = 100000n; // Fallback gas limit
  }
  txData.gasLimit = gasEstimate;
  console.log(`Estimated gas limit: ${gasEstimate} units`);

  console.log('Signing transaction...');
  const signedTx = await wallet.signTransaction(txData);
  console.log('Transaction signed successfully');
  console.log('Signed Transaction:', signedTx);
  return signedTx;
}

export { createSignedTx };