import { ethers } from 'ethers';

export class ABIParser {
  constructor() {
    this.abis = new Map(); // Store ABIs with unique identifiers
  }

  /**
   * Validate and store ABI
   * @param {string|Array} abi - The ABI to parse (can be JSON string or array)
   * @param {string} id - Unique identifier for this ABI
   * @returns {Object} Parsed ABI information
   */
  parseAndStore(abi, id) {
    try {
      // Parse ABI (handles both string and array input)
      const parsedABI = typeof abi === 'string' ? JSON.parse(abi) : abi;

      if (!Array.isArray(parsedABI)) {
        throw new Error('ABI must be an array or JSON string representing an array');
      }

      // Extract function and event information
      const functions = parsedABI.filter(item => item.type === 'function');
      const events = parsedABI.filter(item => item.type === 'event');

      const abiInfo = {
        raw: parsedABI,
        functions: this._processFunctions(functions),
        events: this._processEvents(events),
        interface: new ethers.Interface(parsedABI)
      };

      // Store with the given ID
      this.abis.set(id, abiInfo);
      return abiInfo;
    } catch (error) {
      throw new Error(`Failed to parse ABI: ${error.message}`);
    }
  }

  /**
   * Get stored ABI by ID
   * @param {string} id - The identifier for the stored ABI
   * @returns {Object} The stored ABI information
   */
  getABI(id) {
    if (!this.abis.has(id)) {
      throw new Error(`No ABI found with ID: ${id}`);
    }
    return this.abis.get(id);
  }

  /**
   * Process function definitions
   * @private
   */
  _processFunctions(functions) {
    return functions.map(fn => ({
      name: fn.name,
      inputs: fn.inputs,
      outputs: fn.outputs,
      stateMutability: fn.stateMutability,
      payable: fn.payable,
      constant: fn.constant,
      signature: `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`
    }));
  }

  /**
   * Process event definitions
   * @private
   */
  _processEvents(events) {
    return events.map(ev => ({
      name: ev.name,
      inputs: ev.inputs,
      anonymous: ev.anonymous,
      signature: `${ev.name}(${ev.inputs.map(i => i.type).join(',')})`
    }));
  }

  /**
   * Get all stored ABI IDs
   * @returns {Array} List of stored ABI IDs
   */
  getAllABIIds() {
    return Array.from(this.abis.keys());
  }

  /**
   * Remove stored ABI by ID
   * @param {string} id - The identifier for the stored ABI
   */
  removeABI(id) {
    this.abis.delete(id);
  }
}

export const abiParser = new ABIParser();