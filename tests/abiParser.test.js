import { jest } from '@jest/globals';
import { abiParser } from '../src/abiParser.js';

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

    expect(result).toHaveProperty('raw');
    expect(result.raw).toEqual(sampleABI);
    expect(result).toHaveProperty('functions');
    expect(result.functions).toHaveLength(9);
    expect(result).toHaveProperty('events');
    expect(result.events).toHaveLength(1);
    expect(result).toHaveProperty('interface');
  });

  it('should process function signatures correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');

    const transferFn = result.functions.find(fn => fn.name === 'transfer');
    expect(transferFn.signature).toBe('transfer(address,uint256)');

    const balanceOfFn = result.functions.find(fn => fn.name === 'balanceOf');
    expect(balanceOfFn.signature).toBe('balanceOf(address)');
  });

  it('should process event signatures correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');

    const transferEvent = result.events.find(ev => ev.name === 'Transfer');
    expect(transferEvent.signature).toBe('Transfer(address,address,uint256)');
  });

  it('should invoke view functions correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');
    const iface = result.interface;

    // Test totalSupply
    const totalSupplyData = iface.encodeFunctionData('totalSupply');
    expect(typeof totalSupplyData).toBe('string');

    // Test balanceOf
    const balanceOfData = iface.encodeFunctionData('balanceOf', ['0x1234567890123456789012345678901234567890']);
    expect(typeof balanceOfData).toBe('string');

    // Test maximumFee
    const maximumFeeData = iface.encodeFunctionData('maximumFee');
    expect(typeof maximumFeeData).toBe('string');
  });

  it('should invoke nonpayable functions correctly', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');
    const iface = result.interface;

    // Test transfer
    const transferData = iface.encodeFunctionData('transfer',
      ['0x1234567890123456789012345678901234567890', 100]);
    expect(typeof transferData).toBe('string');

    // Test transferOwnership
    const transferOwnershipData = iface.encodeFunctionData('transferOwnership',
      ['0x1234567890123456789012345678901234567890']);
    expect(typeof transferOwnershipData).toBe('string');
  });

  it('should handle invalid function calls', () => {
    const result = abiParser.parseAndStore(sampleABI, 'test');
    const iface = result.interface;

    // Test with wrong parameter count
    expect(() => iface.encodeFunctionData('balanceOf')).toThrow();

    // Test with wrong parameter type
    expect(() => iface.encodeFunctionData('transfer',
      ['0x1234567890123456789012345678901234567890', 'invalid'])).toThrow();

    // Test non-existent function
    expect(() => iface.encodeFunctionData('nonexistentFunction')).toThrow();
  });

  it('should throw error for invalid ABI', () => {
    expect(() => abiParser.parseAndStore('invalid', 'test')).toThrow('Failed to parse ABI');
    expect(() => abiParser.parseAndStore({}, 'test')).toThrow('Failed to parse ABI');
  });

  it('should retrieve stored ABI by ID', () => {
    abiParser.parseAndStore(sampleABI, 'test');
    const result = abiParser.getABI('test');

    expect(result).toHaveProperty('raw');
    expect(result.raw).toEqual(sampleABI);
  });

  it('should throw error for non-existent ABI ID', () => {
    expect(() => abiParser.getABI("nonexistent")).toThrow("No ABI stored");
  });
});