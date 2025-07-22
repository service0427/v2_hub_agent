#!/bin/bash

ADMIN_KEY="YOUR_API_KEY"
PUBLIC_KEY="5d41402abc4b2a76b9719d911017c592"  # Using existing api_keys table
BASE_URL="http://mkt.techb.kr:8445"

echo "Testing ParserHub v2 API..."
echo ""

# Health check
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq .
echo ""

# Detailed health check
echo "2. Detailed Health Check:"
curl -s "$BASE_URL/health/detailed" | jq .
echo ""

# Test public API (using URL parameter)
echo "3. Public API - Ranking (Coupang):"
curl -s "$BASE_URL/api/v2/public/ranking/coupang?key=$PUBLIC_KEY&keyword=laptop&code=123456" | jq .
echo ""

# Test public API with Korean (using URL parameter)
echo "4. Public API - Ranking (Korean keyword):"
curl -s "$BASE_URL/api/v2/public/ranking/naver_store?key=$PUBLIC_KEY&keyword=$(echo -n '노트북' | jq -sRr @uri)&code=98765432" | jq .
echo ""

# Test admin ranking API
echo "5. Admin API - Ranking:"
curl -s -H "X-API-Key: $ADMIN_KEY" \
  "$BASE_URL/api/v2/ranking/coupang?keyword=laptop&code=123456" | jq .
echo ""

# Test workflow API with ignoreCache
echo "6. Workflow API (ignoreCache):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow":"search","params":{"keyword":"laptop","limit":10,"ignoreCache":true}}' \
  "$BASE_URL/api/v2/workflows/coupang/execute" | jq .
echo ""

# Test agents API
echo "7. List Agents:"
curl -s -H "X-API-Key: $ADMIN_KEY" \
  "$BASE_URL/api/v2/agents" | jq .
echo ""

# Test admin stats
echo "8. Admin Stats:"
curl -s -H "X-API-Key: $ADMIN_KEY" \
  "$BASE_URL/api/v2/admin/stats" | jq .
echo ""