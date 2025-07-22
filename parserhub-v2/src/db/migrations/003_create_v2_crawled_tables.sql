-- v2_crawled_products 테이블 생성
-- 기존 crawled_products와 유사하지만 v2 시스템용으로 최적화

-- 쿠팡 크롤링 데이터
CREATE TABLE IF NOT EXISTS v2_crawled_products_coupang (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER,
  product_id BIGINT NOT NULL,
  vendor_item_id BIGINT,
  item_id BIGINT,
  name TEXT NOT NULL,
  href TEXT,
  thumbnail TEXT,
  rank INTEGER NOT NULL,
  real_rank INTEGER,
  page INTEGER,
  keyword VARCHAR(255) NOT NULL,
  price NUMERIC(12,2),
  rating NUMERIC(3,2),
  review_count INTEGER,
  delivery_info TEXT,
  discount_rate INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 쿠팡 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_coupang_created 
  ON v2_crawled_products_coupang(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_coupang_keyword_rank 
  ON v2_crawled_products_coupang(keyword, rank);
CREATE INDEX IF NOT EXISTS idx_v2_coupang_product_keyword 
  ON v2_crawled_products_coupang(product_id, keyword);
CREATE INDEX IF NOT EXISTS idx_v2_coupang_vendor_item 
  ON v2_crawled_products_coupang(vendor_item_id) WHERE vendor_item_id IS NOT NULL;

-- 네이버 스토어 크롤링 데이터
CREATE TABLE IF NOT EXISTS v2_crawled_products_naver_store (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER,
  product_id BIGINT NOT NULL,
  nv_mid BIGINT,
  name TEXT NOT NULL,
  href TEXT,
  thumbnail TEXT,
  rank INTEGER NOT NULL,
  real_rank INTEGER,
  page INTEGER,
  keyword VARCHAR(255) NOT NULL,
  price NUMERIC(12,2),
  store_name VARCHAR(255),
  store_grade VARCHAR(50),
  delivery_fee INTEGER,
  purchase_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 네이버 스토어 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_naver_store_created 
  ON v2_crawled_products_naver_store(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_naver_store_keyword_rank 
  ON v2_crawled_products_naver_store(keyword, rank);
CREATE INDEX IF NOT EXISTS idx_v2_naver_store_product_keyword 
  ON v2_crawled_products_naver_store(product_id, keyword);
CREATE INDEX IF NOT EXISTS idx_v2_naver_store_nv_mid 
  ON v2_crawled_products_naver_store(nv_mid) WHERE nv_mid IS NOT NULL;

-- 네이버 가격비교 크롤링 데이터
CREATE TABLE IF NOT EXISTS v2_crawled_products_naver_compare (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER,
  product_id BIGINT NOT NULL,
  nv_mid BIGINT,
  name TEXT NOT NULL,
  href TEXT,
  thumbnail TEXT,
  rank INTEGER NOT NULL,
  real_rank INTEGER,
  page INTEGER,
  keyword VARCHAR(255) NOT NULL,
  price NUMERIC(12,2),
  lowest_price NUMERIC(12,2),
  highest_price NUMERIC(12,2),
  mall_count INTEGER,
  category VARCHAR(255),
  brand VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 네이버 가격비교 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_naver_compare_created 
  ON v2_crawled_products_naver_compare(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_naver_compare_keyword_rank 
  ON v2_crawled_products_naver_compare(keyword, rank);
CREATE INDEX IF NOT EXISTS idx_v2_naver_compare_product_keyword 
  ON v2_crawled_products_naver_compare(product_id, keyword);
CREATE INDEX IF NOT EXISTS idx_v2_naver_compare_nv_mid 
  ON v2_crawled_products_naver_compare(nv_mid) WHERE nv_mid IS NOT NULL;

-- 순위 변동 분석을 위한 뷰 (옵션)
CREATE OR REPLACE VIEW v2_coupang_rank_changes AS
SELECT 
  keyword,
  product_id,
  vendor_item_id,
  DATE(created_at) as date,
  MIN(rank) as min_rank,
  MAX(rank) as max_rank,
  MAX(rank) - MIN(rank) as rank_change,
  COUNT(*) as check_count
FROM v2_crawled_products_coupang
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY keyword, product_id, vendor_item_id, DATE(created_at)
HAVING MAX(rank) - MIN(rank) > 0
ORDER BY rank_change DESC;

-- 통계 함수 (옵션)
CREATE OR REPLACE FUNCTION v2_get_product_rank_stats(
  p_platform TEXT,
  p_keyword VARCHAR(255),
  p_product_id BIGINT,
  p_days INTEGER DEFAULT 7
) RETURNS TABLE (
  avg_rank NUMERIC,
  min_rank INTEGER,
  max_rank INTEGER,
  rank_volatility NUMERIC,
  check_count BIGINT
) AS $$
BEGIN
  IF p_platform = 'coupang' THEN
    RETURN QUERY
    SELECT 
      AVG(rank)::NUMERIC,
      MIN(rank),
      MAX(rank),
      STDDEV(rank)::NUMERIC,
      COUNT(*)
    FROM v2_crawled_products_coupang
    WHERE keyword = p_keyword 
      AND product_id = p_product_id
      AND created_at > NOW() - (p_days || ' days')::INTERVAL;
  -- 네이버 플랫폼도 필요시 추가
  END IF;
END;
$$ LANGUAGE plpgsql;