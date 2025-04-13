import { abiParser } from '../src/abiParser.js';

describe('ABIParser - Complex ABI', () => {
  const complexABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
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
          "name": "_upgradedAddress",
          "type": "address"
        }
      ],
      "name": "deprecate",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  beforeEach(() => {
    abiParser.removeABI();
  });

  test('should parse complex ABI as string', () => {
    const result = abiParser.parseAndStore(JSON.stringify(complexABI));
    expect(result).toBeDefined();
    expect(result.functions).toHaveLength(2);
    expect(result.functions[0].name).toBe('name');
    expect(result.functions[1].name).toBe('deprecate');
  });

  test('should parse complex ABI as object', () => {
    const result = abiParser.parseAndStore(complexABI);
    expect(result).toBeDefined();
    expect(result.functions).toHaveLength(2);
    expect(result.functions[0].signature).toBe('name()');
    expect(result.functions[1].signature).toBe('deprecate(address)');
  });

  test('should handle large ABI input', () => {
    const largeABI = Array(100).fill(complexABI[0]);
    const result = abiParser.parseAndStore(largeABI);
    expect(result).toBeDefined();
    expect(result.functions).toHaveLength(100);
  });

  test('should correctly process function signatures', () => {
    const result = abiParser.parseAndStore(complexABI);
    expect(result.functions[0].signature).toBe('name()');
    expect(result.functions[1].signature).toBe('deprecate(address)');
  });

  test('should handle empty inputs array', () => {
    const result = abiParser.parseAndStore(complexABI);
    expect(result.functions[0].inputs).toEqual([]);
  });

  test('should handle empty outputs array', () => {
    const result = abiParser.parseAndStore(complexABI);
    expect(result.functions[1].outputs).toEqual([]);
  });
});