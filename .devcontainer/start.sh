#!/bin/bash
# Dev Container起動時の自動セットアップスクリプト

set -e

echo "🔧 Fixing permissions..."
sudo chown -R node:node /home/node/.claude /home/node/.serena 2>/dev/null || true

echo ""
echo "🔄 Checking Wrangler CLI..."
if wrangler --version > /dev/null 2>&1; then
  echo "✅ Wrangler CLI is available: $(wrangler --version)"
else
  echo "⚠️ Wrangler CLI not found, installing..."
  npm install -g wrangler
fi

echo ""
echo "🔄 Setting up Serena MCP server for Claude Code..."

# Serena MCPサーバーが未登録の場合のみ追加
if ! claude mcp list 2>/dev/null | grep -q "serena"; then
  echo "📦 Adding Serena MCP server..."
  claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project "$(pwd)" || true
  echo "✅ Serena MCP server added"
else
  echo "✅ Serena MCP server already configured"
fi

echo ""
echo "🎉 Dev Container is ready!"
echo ""
echo "Available commands:"
echo "   npm run dev:backend   - Start Wrangler dev server (API)"
echo "   npm run dev:frontend  - Start Astro dev server (Frontend)"
echo "   npm run test:backend  - Run API tests"
echo "   claude                - Start Claude Code CLI"
echo "   wrangler whoami       - Check Cloudflare authentication"
echo ""
