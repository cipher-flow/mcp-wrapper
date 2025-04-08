# Deployment Guide: AWS EC2

This guide outlines the steps to deploy the MCP Wrapper application to AWS EC2.

## Prerequisites

1. AWS Account with EC2 access
2. SSH key pair for EC2 instance
3. AWS CLI installed and configured locally

## Step 1: Launch EC2 Instance

1. Go to AWS Console > EC2 Dashboard
2. Click "Launch Instance"
3. Choose Amazon Linux 2023 AMI
4. Select t2.micro (free tier) or larger instance type
5. Configure Security Group:
   - Allow SSH (Port 22) from your IP
   - Allow HTTP (Port 80) from anywhere
   - Allow HTTPS (Port 443) from anywhere
   - Allow Custom TCP (Port 3000) from anywhere
6. Launch instance with your SSH key pair

## Step 2: Connect to EC2 Instance

```bash
ssh -i path/to/your-key.pem ec2-user@your-instance-ip
```

## Step 3: Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install PM2 globally
sudo npm install -y pm2 -g
```

## Step 3.5: Setup GitHub Access

Choose either SSH or HTTPS method for repository access:

### SSH Method (Recommended)

1. Generate SSH key:
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

2. Start SSH agent and add key:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

3. Copy public key and add to GitHub:
```bash
cat ~/.ssh/id_ed25519.pub
```
- Go to GitHub > Settings > SSH Keys
- Add new SSH key with the copied content

### HTTPS Method (Alternative)

If using HTTPS, you'll need a GitHub Personal Access Token:
1. Go to GitHub > Settings > Developer settings > Personal access tokens
2. Generate new token with 'repo' scope
3. Save the token securely

## Step 4: Clone and Setup Application

```bash
# Clone repository (Choose one method)

# SSH Method
git clone git@github.com:cipher-flow/mcp-wrapper.git
# OR HTTPS Method
git clone https://github.com/cipher-flow/mcp-wrapper.git

cd mcp-wrapper

# Install dependencies
npm install

# Copy environment file and update with your values
cp .env.example .env
nano .env
```

## Step 5: Configure PM2

Create a PM2 ecosystem file (ecosystem.config.cjs):

```javascript
module.exports = {
  apps: [{
    name: 'mcp-wrapper',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    time: true
  }]
}
```

## Step 6: Start Application

```bash
# Start application with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list and configure startup
pm2 save
pm2 startup
```

## Step 7: Setup Reverse Proxy (Optional)

Install and configure Nginx to proxy requests to your Node.js application:

```bash
# Install Nginx
sudo apt install -y nginx

# Copy our custom Nginx configuration
sudo cp nginx.conf /etc/nginx/nginx.conf

# Test the configuration
sudo nginx -t

# If test is successful, restart Nginx
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

Note: The custom Nginx configuration (`nginx.conf`) is provided in the repository and includes all necessary proxy settings and optimizations for the Node.js application. It will replace the default Nginx configuration to ensure our application is served correctly.
}
```

## Maintenance

### Updating Application

```bash
# Pull latest changes
git pull

# Install dependencies
npm install

# Restart application
pm2 restart all
```

### Viewing Logs

```bash
# View application logs
pm2 logs

# Monitor application
pm2 monit
```

### Common Issues

1. If the application fails to start, check logs:
   ```bash
   pm2 logs mcp-wrapper
   ```

2. If port 3000 is already in use:
   ```bash
   sudo lsof -i :3000
   ```

3. Check Node.js version:
   ```bash
   node --version
   ```

## Security Considerations

1. Keep your system and packages updated
2. Use strong SSH keys and disable password authentication
3. Configure firewall rules properly
4. Use HTTPS for production environments
5. Regularly backup your data
6. Monitor system resources and logs

## Backup

Regularly backup your environment file and any persistent data:

```bash
# Backup environment file
cp .env .env.backup

# Backup storage directory
tar -czf storage-backup.tar.gz storage/
```