#!/bin/bash

ADMIN_KEY="YOUR_API_KEY"
BASE_URL="http://mkt.techb.kr:8445"

echo "Testing Naver Search APIs..."
echo ""

# Test Naver Store Search (v2 endpoint)
echo "1. Naver Store Search (v2):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"노트북","limit":5}' \
  "$BASE_URL/api/v2/search/naver_store" | jq .
echo ""

# Test Naver Compare Search (v2 endpoint)
echo "2. Naver Compare Search (v2):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"노트북","limit":5}' \
  "$BASE_URL/api/v2/search/naver_compare" | jq .
echo ""

# Test legacy Naver Store endpoint (v1 compatibility)
echo "3. Legacy Naver Store Search:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"잔기지떡","limit":3}' \
  "$BASE_URL/api/workflow/naver-store-search" | jq .
echo ""

# Test legacy Naver Compare endpoint (v1 compatibility)
echo "4. Legacy Naver Compare Search:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"잔기지떡","limit":3}' \
  "$BASE_URL/api/workflow/naver-compare-search" | jq .
echo ""

# Test Coupang for comparison
echo "5. Coupang Search (for comparison):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"잔기지떡21","limit":3}' \
  "$BASE_URL/api/workflow/coupang-search" | jq .
echo ""