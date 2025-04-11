# Deployment Scripts

## Deploying to Cloudflare Workers

This directory contains scripts for deploying the application to Cloudflare Workers.

### deploy.js

The `deploy.js` script performs two main functions:

1. Reads KV namespace IDs from environment variables and writes them to the `wrangler.jsonc` file
2. Updates the `.dev.vars` file with all environment variables for local development

#### Usage

1. Make sure the following variables are set in your `.env` file or environment variables:

   ```env
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
   - Update the `.dev.vars` file with all environment variables for local development
   - Run the `wrangler:deploy` command to deploy the application to Cloudflare Workers

#### Running Scripts Separately

If you only want to update the configuration files without deploying the application, run:

```bash
npm run prepare-deploy
```

This will update both the `wrangler.jsonc` file and the `.dev.vars` file with values from your environment variables.

Then you can manually run the deployment command:

```bash
npm run wrangler:deploy
```

## Notes

- Make sure your Cloudflare account is properly set up and you're logged in to Wrangler CLI
- Ensure you've created the required KV namespaces and obtained their IDs
- The `.dev.vars` file is used by Wrangler for local development and contains all environment variables
- The script will copy all environment variables defined in `additionalEnvVars` array if they exist in your environment, otherwise they will be ignored
- Before deploying, make sure your application has passed all tests
