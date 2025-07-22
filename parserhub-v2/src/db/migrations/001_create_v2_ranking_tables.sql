-- ParserHub v2 Ranking Tables
-- Created: 2025-01-22

-- 1. Search Results Table
CREATE TABLE IF NOT EXISTS v2_search_results (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  page_number INTEGER NOT NULL,
  total_results INTEGER,
  crawled_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v2_search_platform_keyword_time 
  ON v2_search_results(platform, keyword, crawled_at DESC);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS v2_products (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  vendor_item_id VARCHAR(255),
  item_id VARCHAR(255),
  nv_mid VARCHAR(255),
  name TEXT NOT NULL,
  href TEXT,
  thumbnail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_v2_platform_product 
  ON v2_products(platform, product_id);

CREATE INDEX IF NOT EXISTS idx_v2_products_vendor_item 
  ON v2_products(vendor_item_id) WHERE vendor_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v2_products_item_id 
  ON v2_products(item_id) WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v2_products_nv_mid 
  ON v2_products(nv_mid) WHERE nv_mid IS NOT NULL;

-- 3. Ranking History Table
CREATE TABLE IF NOT EXISTS v2_ranking_history (
  id SERIAL PRIMARY KEY,
  search_result_id INTEGER REFERENCES v2_search_results(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES v2_products(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  rank INTEGER NOT NULL,
  page INTEGER NOT NULL,
  price DECIMAL(10,2),
  rating DECIMAL(3,2),
  review_count INTEGER,
  crawled_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v2_ranking_product_time 
  ON v2_ranking_history(product_id, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_ranking_keyword_rank 
  ON v2_ranking_history(keyword, rank, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_ranking_search_result 
  ON v2_ranking_history(search_result_id);

-- 4. Ranking Changes Table
CREATE TABLE IF NOT EXISTS v2_ranking_changes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES v2_products(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  previous_rank INTEGER,
  current_rank INTEGER,
  rank_change INTEGER, -- positive: up, negative: down
  changed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v2_changes_product_time 
  ON v2_ranking_changes(product_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_changes_keyword_time 
  ON v2_ranking_changes(keyword, changed_at DESC);

-- 5. Create update trigger for products
CREATE OR REPLACE FUNCTION update_v2_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_v2_products_updated_at_trigger
  BEFORE UPDATE ON v2_products
  FOR EACH ROW
  EXECUTE FUNCTION update_v2_products_updated_at();

-- 6. Partition for ranking_history (optional, for better performance)
-- Example: Create monthly partitions
-- CREATE TABLE v2_ranking_history_2025_01 PARTITION OF v2_ranking_history
--   FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');