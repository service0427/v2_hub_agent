#!/bin/bash

API_KEY="YOUR_API_KEY"
BASE_URL="http://localhost:8447"

echo "================================"
echo "Auto Keyword Registration Test"
echo "================================"
echo ""

# 1. 현재 monitoring_keywords 확인
echo "### 1. Current monitoring keywords ###"
echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c \
"SELECT keyword, platform, interval_hours, is_active, last_crawled_at 
FROM v2_monitoring_keywords 
ORDER BY created_at DESC LIMIT 10;" 2>&1 | grep -v "password"

echo ""
echo "### 2. Testing search API with new keywords ###"
echo ""

# 2. 여러 API로 검색 테스트
echo "Search API - '게이밍마우스':"
curl -s -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"게이밍마우스","limit":5}' \
  "$BASE_URL/api/v2/search/coupang" | jq -r '.success'

echo "Workflow API - '기계식키보드':"
curl -s -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow":"search","params":{"keyword":"기계식키보드","limit":5}}' \
  "$BASE_URL/api/v2/workflows/naver_store/execute" | jq -r '.success'

echo "Public Ranking API - '게이밍헤드셋':"
curl -s -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"게이밍헤드셋","code":"12345"}' \
  "$BASE_URL/api/v2/public/ranking/naver_compare" | jq -r '.success'

echo ""
echo "### 3. Check if keywords were added ###"
sleep 2
echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c \
"SELECT keyword, platform, interval_hours, is_active, created_at 
FROM v2_monitoring_keywords 
WHERE keyword IN ('게이밍마우스', '기계식키보드', '게이밍헤드셋')
ORDER BY created_at DESC;" 2>&1 | grep -v "password"

echo ""
echo "### 4. Test duplicate keyword (should update) ###"
echo ""

echo "Searching '게이밍마우스' again:"
curl -s -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"게이밍마우스","limit":5}' \
  "$BASE_URL/api/v2/search/coupang" | jq -r '.success'

echo ""
echo "Check logs for 'already exists' message:"
pm2 logs crawler-hub-v2 --lines 5 --nostream | grep "게이밍마우스"

echo ""
echo "================================"
echo "Test completed!"
echo "================================"