# ⚡ Quick Railway Deploy Guide

## 🚀 One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/retailcrm-mcp)

## 📋 Step-by-Step Instructions

### 1. Click the Button Above
This opens Railway with the pre-configured project.

### 2. Connect GitHub
Choose the repository: `aryazansev/retailcrm-mcp`

### 3. Set Environment Variables
In Railway dashboard, add these variables:

```
RETAILCRM_URL=https://your-account.retailcrm.ru
RETAILCRM_API_KEY=your_api_key_here
MCP_PORT=3002
NODE_ENV=production
```

### 4. Deploy!
Click "Deploy" and wait 2-3 minutes.

### 5. Get Your URL
Your server will be at: `https://your-app-name.railway.app`

## 🔍 Test Your Deployment

```bash
# Health check
curl https://your-app-name.railway.app/health

# Get manifest for AI Studio
curl https://your-app-name.railway.app/manifest

# List tools
curl https://your-app-name.railway.app/tools
```

## 🎯 Connect to AI Studio

Use this URL in AI Studio:
```
https://your-app-name.railway.app/manifest
```

## 🛠️ If Build Fails

### Option A: Use Nixpacks (Recommended)
Railway should automatically detect and use Nixpacks configuration.

### Option B: Switch to Docker
In Railway settings:
1. Go to Settings → Build 
2. Change "Builder" to Dockerfile
3. Redeploy

### Option C: Check Logs
```bash
railway logs
```

Common issues:
- Missing `tsconfig.json` (should be fixed now)
- Source code copied before dependencies installed (fixed)
- Incorrect start command (fixed: `node build/server.js`)

## 📊 What You Get

✅ **Free Tier:** 500 hours/month  
✅ **Always-on:** MCP server runs 24/7  
✅ **Custom URL:** `.railway.app` domain  
✅ **Auto-deploy:** Updates from GitHub  
✅ **Health checks:** Automatic monitoring  
✅ **AI Studio Ready:** Direct integration  

## 🔐 Security Notes

- API keys are encrypted in Railway
- Use read-only API keys when possible
- Railway provides HTTPS automatically
- CORS configured for AI Studio domains

Need help? Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)