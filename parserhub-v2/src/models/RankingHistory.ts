import { query } from '../db/pool';
import { RankingHistory as IRankingHistory, Platform } from '../types';

export class RankingHistory {
  static async create(searchResultId: number, data: IRankingHistory): Promise<void> {
    const { productId, keyword, rank, page, price, rating, reviewCount, crawledAt } = data;
    
    await query(
      `INSERT INTO v2_ranking_history 
       (search_result_id, product_id, keyword, rank, page, price, rating, review_count, crawled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [searchResultId, productId, keyword, rank, page, price, rating, reviewCount, crawledAt]
    );
  }

  static async getLatest(productId: number, keyword: string): Promise<IRankingHistory | null> {
    const result = await query<any>(
      `SELECT * FROM v2_ranking_history 
       WHERE product_id = $1 AND keyword = $2
       ORDER BY crawled_at DESC
       LIMIT 1`,
      [productId, keyword]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      productId: row.product_id,
      keyword: row.keyword,
      rank: row.rank,
      page: row.page,
      price: row.price,
      rating: row.rating,
      reviewCount: row.review_count,
      crawledAt: row.crawled_at,
    };
  }

  static async getHistory(productId: number, keyword: string, days: number): Promise<IRankingHistory[]> {
    const result = await query<any>(
      `SELECT * FROM v2_ranking_history 
       WHERE product_id = $1 AND keyword = $2
       AND crawled_at >= NOW() - INTERVAL '${days} days'
       ORDER BY crawled_at DESC`,
      [productId, keyword]
    );

    return result.map(row => ({
      id: row.id,
      productId: row.product_id,
      keyword: row.keyword,
      rank: row.rank,
      page: row.page,
      price: row.price,
      rating: row.rating,
      reviewCount: row.review_count,
      crawledAt: row.crawled_at,
    }));
  }

  static async getTopProducts(platform: Platform, keyword: string, limit: number): Promise<any[]> {
    const result = await query<any>(
      `SELECT DISTINCT ON (p.id) 
         p.*, 
         rh.rank,
         rh.price,
         rh.rating,
         rh.review_count,
         rh.crawled_at
       FROM v2_products p
       INNER JOIN v2_ranking_history rh ON p.id = rh.product_id
       WHERE p.platform = $1 AND rh.keyword = $2
       ORDER BY p.id, rh.crawled_at DESC, rh.rank ASC
       LIMIT $3`,
      [platform, keyword, limit]
    );

    return result;
  }
}