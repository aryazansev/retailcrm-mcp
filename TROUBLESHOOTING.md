# 🔧 Troubleshooting Deployment

## Common Issues and Solutions

### ❌ Docker Build Fails with TypeScript Error

**Problem:** `tsc` shows help instead of compiling

**Solution:** Fixed in latest commit - Docker now copies `tsconfig.json` separately

**Manual fix:**
```dockerfile
# Copy tsconfig.json before npm ci
COPY package*.json tsconfig.json ./
```

---

### ❌ Railway Deployment Fails

**Problem:** Build fails or server doesn't start

**Solutions:**

1. **Check start command:**
   ```toml
   [deploy]
   startCommand = "node build/server.js"  # NOT npm run server:prod
   ```

2. **Verify environment variables:**
   ```
   RETAILCRM_URL=https://your-account.retailcrm.ru
   RETAILCRM_API_KEY=your_api_key
   MCP_PORT=3002
   NODE_ENV=production
   ```

3. **Check Railway logs:**
   ```bash
   railway logs
   ```

---

### ❌ Memory Issues on Railway

**Problem:** Container crashes due to memory limits

**Solution:** Add to `railway.toml`:
```toml
[env]
  NODE_OPTIONS="--max-old-space-size=256"
```

---

### ❌ Port Already in Use

**Problem:** `EADDRINUSE: address already in use :::3002`

**Solutions:**

1. **Change port:**
   ```bash
   export MCP_PORT=3003
   npm run server
   ```

2. **Kill existing process:**
   ```bash
   lsof -ti:3002 | xargs kill
   ```

---

### ❌ API Key Issues

**Problem:** Authentication failures with RetailCRM

**Solutions:**

1. **Check API key permissions:**
   - Orders: read/write
   - Customers: read/write  
   - Products: read
   - Tasks: read/write

2. **Verify URL format:**
   ```
   ✅ https://your-account.retailcrm.ru
   ❌ https://your-account.retailcrm.ru/
   ```

3. **Test API key:**
   ```bash
   curl -X GET "https://your-account.retailcrm.ru/api/v5/orders" \
        -H "X-API-KEY: your_api_key"
   ```

---

### ❌ CORS Issues with AI Studio

**Problem:** AI Studio cannot connect to your server

**Solution:** CORS is pre-configured, but verify domains:

```javascript
app.use(cors({
  origin: [
    'https://ai.anthropic.com',
    'https://claude.ai',
    // Add your custom domains if needed
  ]
}));
```

---

### ❌ Health Check Failures

**Problem:** Health check returns errors

**Solutions:**

1. **Verify server is running:**
   ```bash
   curl http://localhost:3002/health
   ```

2. **Check environment variables:**
   ```bash
   echo $RETAILCRM_URL
   echo $RETAILCRM_API_KEY
   ```

3. **Check Railway health check configuration:**
   ```toml
   [deploy]
   healthcheckPath = "/health"
   healthcheckTimeout = 100
   ```

---

### 🚀 Quick Test Commands

**Local testing:**
```bash
# Build and run locally
npm run build
npm run server:prod

# Test endpoints
curl http://localhost:3002/health
curl http://localhost:3002/manifest
curl http://localhost:3002/tools
```

**Docker testing:**
```bash
# Build and test Docker image
docker build -t retailcrm-mcp .
docker run -p 3002:3002 \
  -e RETAILCRM_URL="https://your-account.retailcrm.ru" \
  -e RETAILCRM_API_KEY="your_api_key" \
  retailcrm-mcp

# Test in another terminal
curl http://localhost:3002/health
```

---

### 📞 Getting Help

If you're still having issues:

1. **Check the GitHub Issues:** https://github.com/aryazansev/retailcrm-mcp/issues
2. **Create a new issue** with:
   - Platform (Railway/Render/local)
   - Error messages
   - Environment variables (hide API keys)
   - Railway/Render logs

3. **Join the discussion:** Check GitHub Discussions for community support

---

### ✅ Pre-Deployment Checklist

Before deploying, verify:

- [ ] API key has correct permissions
- [ ] RETAILCRM_URL is correct format
- [ ] Server builds locally: `npm run build`
- [ ] Server runs locally: `npm run server:prod`
- [ ] Health check works: `curl http://localhost:3002/health`
- [ ] Environment variables set in deployment platform
- [ ] Railway/Render service restart policy configured

---

### 🎯 Expected URLs After Deployment

**Railway:** `https://your-app.railway.app`
- Health: `https://your-app.railway.app/health`
- Manifest: `https://your-app.railway.app/manifest`
- Tools: `https://your-app.railway.app/tools`

**Render:** `https://your-app.onrender.com`
- Same endpoints with `.onrender.com` domain

Use the manifest URL in AI Studio to connect! 🚀