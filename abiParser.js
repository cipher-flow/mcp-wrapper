import { ethers } from 'ethers';

export class ABIParser {
  constructor() {
    this.abi = null; // Store single ABI
  }

  /**
   * Validate and store ABI
   * @param {string|Array} abi - The ABI to parse (can be JSON string or array)
   * @returns {Object} Parsed ABI information
   */
  parseAndStore(abi) {
    try {
      // Parse ABI (handles both string and array input)
      const parsedABI = typeof abi === 'string' ? JSON.parse(abi) : abi;

      if (!Array.isArray(parsedABI)) {
        throw new Error('ABI must be an array or JSON string representing an array');
      }

      // Extract function and event information
      const functions = parsedABI.filter(item => item.type === 'function');
      const events = parsedABI.filter(item => item.type === 'event');

      this.abi = {
        raw: parsedABI,
        functions: this._processFunctions(functions),
        events: this._processEvents(events),
        interface: new ethers.Interface(parsedABI)
      };

      return this.abi;
    } catch (error) {
      throw new Error(`Failed to parse ABI: ${error.message}`);
    }
  }

  /**
   * Get stored ABI
   * @returns {Object} The stored ABI information
   */
  getABI() {
    if (!this.abi) {
      throw new Error('No ABI stored');
    }
    return this.abi;
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
   * Remove stored ABI
   */
  removeABI() {
    this.abi = null;
  }
}

export const abiParser = new ABIParser();