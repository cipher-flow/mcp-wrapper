# MCP Wrapper

## Introduction

MCP Wrapper is a powerful tool that streamlines blockchain development by automatically converting Solidity ABI into an MCP (Model Context Protocol) Server. This conversion eliminates the need for developers to write custom MCP code or manage their own servers. Instead, developers receive a ready-to-use MCP Server URL for immediate smart contract interactions.

## Key Features

* **Automated Solidity ABI Conversion**: Transform your smart contract ABI into a fully functional MCP Server with minimal setup.
* **Comprehensive Smart Contract Integration**:
    * **Read Operations**: Complete support for `view` and `pure` functions (state-independent operations)
    * **Write Operations**: Secure three-step process for state-modifying functions:
        1. **Transaction Preparation**: Generate transaction data using the `constructTransactionData` tool by providing function name and parameters
        2. **Local Transaction Signing**: Sign transactions securely on your machine using your private key (MCP Wrapper never handles private keys)
        3. **Network Broadcasting**: Submit signed transactions to the blockchain using the `sendSignedTransaction` tool

## Getting Started

### 1. Obtain an Invite Code

* Access to MCP Wrapper requires an invite code
* Request an invite code through:
    * Referral from existing users
    * Application form at <https://forms.gle/eUbXK7NgNwRnztRJA>
* Each invite code enables:
    * Creation of up to 100 servers
    * 10,000 MCP tool calls

### 2. Set Up Your MCP Server

1. Navigate to <https://mcpwrapper.xyz/>
2. Create a new server with the following information:
    * **Invite Code**: Your valid access code
    * **Server Name**: Choose a descriptive identifier
    * **Chain RPC URL**: Blockchain network endpoint
    * **Smart Contract ABI**: Contract interface in JSON format, example:

```json
[
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
    }
]
```

1. Upon successful setup, you'll receive your MCP Server URL

### 3. Server Management

Access and manage your servers by entering your invite code in the management interface.

## Using Your MCP Server

Once configured, interact with your MCP Server through various client tools:

### Reading Contract Data

1. **Client Configuration**
   Configure your client with the MCP Server URL. Example for Claude client (requires supergateway):

```json
{
    "mcpServers": {
        "usdt": {
            "command": "npx",
            "args": [
                "-y",
                "supergateway",
                "--sse",
                "https://mcpwrapper.xyz/sse/SERURL_NAME"
            ]
        }
    }
}
```

2. **Query Execution**
   * Use natural language to query contract data
   * Example: "What is the total supply of this contract: xxx?"

3. **Response Handling**
   * Receive formatted results from contract queries
   * Example: Total supply returned as a numeric value

### Writing to Contracts

1. **Transaction Preparation**
   * Describe your transaction in natural language
   * Example: "Construct a transfer transaction from [your address] to [recipient address] with value [amount] for contract [contract address]"
   * Receive transaction data through the `constructTransactionData` tool

2. **Transaction Signing**
   * Sign the transaction data locally using your private key
   * Maintain complete control over your private keys

3. **Transaction Submission**
   * Submit signed transaction using `sendSignedTransaction`
   * Monitor transaction status and confirmation

## Security Considerations

* **Invite Code Security**: Protect your invite code to maintain server access control
* **Private Key Management**: Never share private keys; all signing occurs locally
* **Transaction Verification**: Review transaction data before signing

## Additional Resources

Visit our GitHub repository at [cipher-flow/mcp-wrapper](https://github.com/cipher-flow/mcp-wrapper) for:
* Source code access
* Issue tracking
* Project updates
* Community contributions

For questions, feedback, or support, please use the GitHub issues section.