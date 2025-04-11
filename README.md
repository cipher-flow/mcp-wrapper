# MCP Wrapper

MCP Wrapper is a powerful tool that automatically converts Solidity ABI into an MCP (Model Context Protocol) Server, streamlining blockchain development workflows. By eliminating the need for custom MCP code or server management, developers can instantly interact with smart contracts through a ready-to-use MCP Server URL.

## Key Features

- **Automated Solidity ABI Conversion**: Transform smart contract ABIs into fully functional MCP Servers with minimal setup
- **Comprehensive Smart Contract Integration**:
  - **Read Operations**: Full support for `view` and `pure` functions
  - **Write Operations**: Secure transaction handling with a three-step process:
    1. Transaction data construction
    2. Local transaction signing (private keys never leave your machine)
    3. Network transaction broadcasting
- **Developer-Friendly**: Simple setup process with clear documentation
- **Secure Design**: Private keys are never handled by the server

## Prerequisites

- Node.js (v14 or higher)
- npm or pnpm package manager
- Valid invite code (required for server creation)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcp-wrapper
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Usage

### Development

Start the development server:
```bash
npm run dev
```

### Production

For production deployment to Cloudflare Workers:
```bash
# Set up your environment variables in .env file
npm run deploy
```

This will:
1. Read KV namespace IDs from environment variables
2. Update wrangler.jsonc with these values
3. Deploy the application to Cloudflare Workers

For local production testing:
```bash
npm start
```

### Creating an MCP Server

1. Visit [MCP Wrapper](https://mcpwrapper.xyz/)
2. Provide required information:
   - Invite code
   - Server name
   - Chain RPC URL
   - Smart contract ABI
3. Click "Create Server" to receive your MCP Server URL

## Scripts

- `generateInviteCodes.js`: Generate new invite codes
- `generateSignedTx.js`: Create signed transactions
- `sendSignedTx.js`: Broadcast signed transactions
- `deploy.js`: Deploy script that updates wrangler.jsonc with KV namespace IDs from environment variables

## Configuration

Key configuration files:
- `.env`: Environment variables
- `rpcConfig.js`: RPC endpoint configuration
- `config.js`: General application settings

## Testing

Run the test suite:
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.