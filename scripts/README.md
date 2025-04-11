# Deployment Scripts

## Deploying to Cloudflare Workers

This directory contains scripts for deploying the application to Cloudflare Workers.

### deploy.js

The `deploy.js` script reads KV namespace IDs from environment variables, writes them to the `wrangler.jsonc` file, and then deploys the application.

#### Usage

1. Make sure the following variables are set in your `.env` file or environment variables:
   ```
   INVITE_CODES_KV_ID=your_invite_codes_kv_id
   INVITE_CODES_PREVIEW_KV_ID=your_invite_codes_preview_kv_id
   SERVERS_KV_ID=your_servers_kv_id
   SERVERS_PREVIEW_KV_ID=your_servers_preview_kv_id
   ```

2. Run the deployment command:
   ```bash
   npm run deploy
   ```

   This command will:
   - Run the `prepare-deploy` script to read KV namespace IDs from environment variables and update the `wrangler.jsonc` file
   - Run the `wrangler:deploy` command to deploy the application to Cloudflare Workers

#### Running Scripts Separately

If you only want to update the `wrangler.jsonc` file without deploying the application, run:
```bash
npm run prepare-deploy
```

Then you can manually run the deployment command:
```bash
npm run wrangler:deploy
```

## Notes

- Make sure your Cloudflare account is properly set up and you're logged in to Wrangler CLI
- Ensure you've created the required KV namespaces and obtained their IDs
- Before deploying, make sure your application has passed all tests
