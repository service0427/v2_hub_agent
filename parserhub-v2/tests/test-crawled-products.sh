#!/bin/bash

ADMIN_KEY="YOUR_API_KEY"
BASE_URL="http://mkt.techb.kr:8445"

echo "================================"
echo "v2_crawled_products 테스트"
echo "================================"
echo ""

# 1. 다양한 키워드로 크롤링 실행
echo "### 1. 크롤링 실행 ###"
echo ""

KEYWORDS=("노트북" "마우스" "키보드" "모니터" "헤드셋")
PLATFORMS=("coupang" "naver_store" "naver_compare")

for keyword in "${KEYWORDS[@]}"; do
  for platform in "${PLATFORMS[@]}"; do
    echo "크롤링: $platform - $keyword"
    curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"keyword\":\"$keyword\",\"limit\":10}" \
      "$BASE_URL/api/v2/search/$platform" | jq -r '.success' | xargs echo "  결과:"
    sleep 0.5
  done
done

echo ""
echo "### 2. 저장된 데이터 확인 ###"
echo ""

echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT 
    'coupang' as platform,
    COUNT(*) as total_products,
    COUNT(DISTINCT keyword) as keywords,
    COUNT(DISTINCT product_id) as unique_products
FROM v2_crawled_products_coupang
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    'naver_store' as platform,
    COUNT(*) as total_products,
    COUNT(DISTINCT keyword) as keywords,
    COUNT(DISTINCT product_id) as unique_products
FROM v2_crawled_products_naver_store
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    'naver_compare' as platform,
    COUNT(*) as total_products,
    COUNT(DISTINCT keyword) as keywords,
    COUNT(DISTINCT product_id) as unique_products
FROM v2_crawled_products_naver_compare
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY platform;" 2>&1 | grep -v "password"

echo ""
echo "### 3. 데이터 타입 검증 ###"
echo ""

echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT 
    product_id,
    vendor_item_id,
    item_id,
    pg_typeof(product_id) as product_id_type,
    pg_typeof(vendor_item_id) as vendor_item_type,
    pg_typeof(item_id) as item_id_type
FROM v2_crawled_products_coupang
WHERE keyword = '노트북'
LIMIT 1;" 2>&1 | grep -v "password"

echo ""
echo "### 4. 중복 크롤링 테스트 (같은 키워드 재검색) ###"
echo ""

# 노트북 키워드로 다시 크롤링
curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"노트북","limit":10}' \
  "$BASE_URL/api/v2/search/coupang" | jq '.success'

sleep 1

echo ""
echo "중복 크롤링 후 데이터 확인:"
echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT 
    keyword,
    product_id,
    COUNT(*) as crawl_count,
    MIN(created_at) as first_crawl,
    MAX(created_at) as last_crawl,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as seconds_diff
FROM v2_crawled_products_coupang
WHERE keyword = '노트북' 
  AND created_at > NOW() - INTERVAL '10 minutes'
GROUP BY keyword, product_id
HAVING COUNT(*) > 1
ORDER BY crawl_count DESC
LIMIT 5;" 2>&1 | grep -v "password"

echo ""
echo "### 5. 순위 변동 시뮬레이션 ###"
echo ""

# 랜덤하게 순위가 바뀌는 상황 시뮬레이션
for i in {1..3}; do
  echo "시뮬레이션 $i회차:"
  curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"keyword":"순위테스트","limit":5}' \
    "$BASE_URL/api/v2/search/coupang" | jq '.success'
  sleep 2
done

echo ""
echo "순위 변동 분석:"
echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT 
    product_id,
    MIN(rank) as min_rank,
    MAX(rank) as max_rank,
    MAX(rank) - MIN(rank) as rank_change,
    COUNT(*) as check_count,
    ARRAY_AGG(rank ORDER BY created_at) as rank_history
FROM v2_crawled_products_coupang
WHERE keyword = '순위테스트'
GROUP BY product_id
HAVING COUNT(*) >= 2
ORDER BY rank_change DESC
LIMIT 5;" 2>&1 | grep -v "password"

echo ""
echo "### 6. 성능 테스트 (대량 데이터) ###"
echo ""

echo "100개 상품 크롤링 시간 측정:"
time curl -s -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"대량테스트","limit":100}' \
  "$BASE_URL/api/v2/search/coupang" -o /dev/null

echo ""
echo "저장된 대량 데이터 확인:"
echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT COUNT(*) as saved_count
FROM v2_crawled_products_coupang
WHERE keyword = '대량테스트';" 2>&1 | grep -v "password"

echo ""
echo "### 7. 뷰(View) 동작 확인 ###"
echo ""

echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT * FROM v2_coupang_rank_changes
LIMIT 5;" 2>&1 | grep -v "password"

echo ""
echo "### 8. 통계 함수 테스트 ###"
echo ""

echo "Tech1324!" | sudo -S -u postgres psql -d productparser_db -c "
SELECT * FROM v2_get_product_rank_stats('coupang', '노트북', 
  (SELECT product_id FROM v2_crawled_products_coupang 
   WHERE keyword = '노트북' LIMIT 1), 7);" 2>&1 | grep -v "password"

echo ""
echo "================================"
echo "테스트 완료!"
echo "================================"