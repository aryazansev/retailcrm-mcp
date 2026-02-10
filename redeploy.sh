#!/bin/bash

# Force Railway redeploy script
echo "🔄 Forcing Railway redeploy..."

# Add a small change to trigger rebuild
echo "// Force rebuild $(date)" >> src/force-rebuild.txt

git add .
git commit -m "Force Railway redeploy - $(date)"
git push

echo "✅ Redeploy triggered! Railway should rebuild with latest changes."
echo "📍 Check: https://railway.app/project/retailcrm-mcp"
echo "⏳ Wait 2-3 minutes for deployment to complete."