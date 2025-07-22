#!/bin/bash

ADMIN_KEY="YOUR_API_KEY"
BASE_URL="http://mkt.techb.kr:8445"

echo "================================"
echo "파서허브 v2 전체 API 테스트"
echo "================================"
echo ""

# V2 검색 API 테스트
echo "### V2 검색 API 테스트 ###"
echo ""

echo "1. 쿠팡 검색 (v2):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"노트북","limit":3}' \
  "$BASE_URL/api/v2/search/coupang" | jq '.success, .data.count, (.data.products | length)'
echo ""

echo "2. 네이버 스토어 검색 (v2):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"마우스","limit":3}' \
  "$BASE_URL/api/v2/search/naver_store" | jq '.success, .data.count, (.data.products | length)'
echo ""

echo "3. 네이버 가격비교 검색 (v2):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"키보드","limit":3}' \
  "$BASE_URL/api/v2/search/naver_compare" | jq '.success, .data.count, (.data.products | length)'
echo ""

# Legacy API 테스트
echo "### Legacy API 테스트 (v1 호환) ###"
echo ""

echo "4. 쿠팡 검색 (legacy):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"모니터","limit":3}' \
  "$BASE_URL/api/workflow/coupang-search" | jq '.success, .data.count, (.data.products | length)'
echo ""

echo "5. 네이버 스토어 검색 (legacy):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"헤드셋","limit":3}' \
  "$BASE_URL/api/workflow/naver-store-search" | jq '.success, .data.count, (.data.products | length)'
echo ""

echo "6. 네이버 가격비교 검색 (legacy):"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"스피커","limit":3}' \
  "$BASE_URL/api/workflow/naver-compare-search" | jq '.success, .data.count, (.data.products | length)'
echo ""

# 데이터 구조 검증
echo "### 데이터 구조 검증 ###"
echo ""

echo "7. 쿠팡 상품 데이터 구조 확인:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"테스트","limit":1}' \
  "$BASE_URL/api/v2/search/coupang" | jq '.data.products[0] | keys'
echo ""

echo "8. 네이버 스토어 상품 데이터 구조 확인:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"테스트","limit":1}' \
  "$BASE_URL/api/v2/search/naver_store" | jq '.data.products[0] | keys'
echo ""

echo "9. 네이버 가격비교 상품 데이터 구조 확인:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"테스트","limit":1}' \
  "$BASE_URL/api/v2/search/naver_compare" | jq '.data.products[0] | keys'
echo ""

# 에러 처리 테스트
echo "### 에러 처리 테스트 ###"
echo ""

echo "10. 잘못된 플랫폼:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"test"}' \
  "$BASE_URL/api/v2/search/invalid_platform" | jq '.success, .error'
echo ""

echo "11. 키워드 없음:"
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit":5}' \
  "$BASE_URL/api/v2/search/coupang" | jq '.success, .error'
echo ""

echo "12. API 키 없음:"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"keyword":"test"}' \
  "$BASE_URL/api/v2/search/coupang" | jq '.success, .error'
echo ""

# 기타 API 테스트
echo "### 기타 API 테스트 ###"
echo ""

echo "13. Health Check:"
curl -s "$BASE_URL/health" | jq '.status, .uptime'
echo ""

echo "14. 스케줄러 상태:"
curl -s -H "X-API-Key: $ADMIN_KEY" \
  "$BASE_URL/api/v2/scheduler/status" | jq '.success, .data.rankingCrawl.isRunning'
echo ""

# 성능 테스트
echo "### 성능 테스트 ###"
echo ""

echo "15. 응답 시간 측정 (5회 평균):"
total_time=0
for i in {1..5}; do
  response_time=$(curl -s -o /dev/null -w "%{time_total}" \
    -X POST -H "X-API-Key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"keyword":"test","limit":10}' \
    "$BASE_URL/api/v2/search/coupang")
  total_time=$(echo "$total_time + $response_time" | bc)
  echo "  테스트 $i: ${response_time}초"
done
average_time=$(echo "scale=3; $total_time / 5" | bc)
echo "  평균 응답 시간: ${average_time}초"
echo ""

echo "================================"
echo "테스트 완료!"
echo "================================"