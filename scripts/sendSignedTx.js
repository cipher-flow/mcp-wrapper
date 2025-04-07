#!/usr/bin/env node
import { ethereumService } from '../src/ethereum.js';

if (process.argv[1].endsWith('sendSignedTx.js')) {
  const [,, serverName, signedTx] = process.argv;

  if (!serverName || !signedTx) {
    console.error('Usage: node sendSignedTx.js <serverName> <signedTransaction>');
    console.error('Example: node sendSignedTx.js mainnet 0xf86b...');
    process.exit(1);
  }

  console.log(`Sending signed transaction on ${serverName}`);

  ethereumService.sendSignedTransaction(serverName, signedTx)
    .then(receipt => {
      console.log('Transaction successful:');
      console.log('Block:', receipt.blockNumber);
      console.log('Hash:', receipt.hash);
      process.exit(0);
    })
    .catch(error => {
      console.error('Transaction failed:', error.message);
      process.exit(1);
    });
}