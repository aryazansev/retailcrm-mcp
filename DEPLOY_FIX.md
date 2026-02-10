# Simple Railway App Template

## 🚀 Quick Deploy Instructions

### Option A: Railway UI (Recommended)

1. **Go to Railway:** https://railway.app/new
2. **Choose "Deploy from GitHub repo"**
3. **Select:** `aryazansev/retailcrm-mcp`
4. **In Railway Settings:**
   - Build: **Dockerfile** (not Nixpacks)
   - Start Command: `node build/test-server.js`
   - Health Check Path: `/health`
   - Port: `3002`

### Option B: Fix Current Deploy

1. **Go to your Railway project**
2. **Settings → Build**
3. **Change Builder to: Dockerfile**
4. **Save and Redeploy**

### Option C: Try Render Instead

**Render is often more reliable for Node.js apps:**

1. **Go to:** https://render.com/deploy?repo=https://github.com/aryazansev/retailcrm-mcp
2. **Connect GitHub**
3. **Set environment variables:**
   ```
   RETAILCRM_URL=https://your-account.retailcrm.ru
   RETAILCRM_API_KEY=your_api_key
   ```
4. **Deploy**

---

## 🔧 Why Railway Might Fail

- **Port binding:** Railway expects PORT, not MCP_PORT
- **Health check:** Needs 0.0.0.0 binding
- **Builder conflicts:** Nixpacks vs Dockerfile issues

## 🎯 Test Server Features

The test server (`src/test-server.ts` has:
- ✅ Proper 0.0.0.0 binding
- ✅ Simple health check returning "OK"
- ✅ PORT environment variable support
- ✅ Comprehensive error logging
- ✅ Zero RetailCRM dependencies

**This should work on any platform!**