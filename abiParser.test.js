import { abiParser } from './abiParser.js';
import { expect } from 'chai';

describe('ABIParser', () => {
  const sampleABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "balances",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "maximumFee",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "_totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "balance",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "basisPointsRate",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    }
  ];

  beforeEach(() => {
    abiParser.removeABI('test');
  });

  it('should parse and store ABI correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');

    expect(result).to.have.property('raw');
    expect(result.raw).to.deep.equal(sampleABI);
    expect(result).to.have.property('functions');
    expect(result.functions).to.have.lengthOf(9);
    expect(result).to.have.property('events');
    expect(result.events).to.have.lengthOf(1);
    expect(result).to.have.property('interface');
  });

  it('should process function signatures correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');

    const transferFn = result.functions.find(fn => fn.name === 'transfer');
    expect(transferFn.signature).to.equal('transfer(address,uint256)');

    const balanceOfFn = result.functions.find(fn => fn.name === 'balanceOf');
    expect(balanceOfFn.signature).to.equal('balanceOf(address)');
  });

  it('should process event signatures correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');

    const transferEvent = result.events.find(ev => ev.name === 'Transfer');
    expect(transferEvent.signature).to.equal('Transfer(address,address,uint256)');
  });

  it('should throw error for invalid ABI', () => {
    expect(() => abiParser.parseAndStore('invalid', 'test')).to.throw('Failed to parse ABI');
    expect(() => abiParser.parseAndStore({}, 'test')).to.throw('Failed to parse ABI');
  });

  it('should retrieve stored ABI by ID', () => {
    abiParser.parseAndStore(sampleABI, 'test');
    const result = abiParser.getABI('test');

    expect(result).to.have.property('raw');
    expect(result.raw).to.deep.equal(sampleABI);
  });

  it('should throw error for non-existent ABI ID', () => {
    expect(() => abiParser.getABI('nonexistent')).to.throw('No ABI found with ID');
  });
});