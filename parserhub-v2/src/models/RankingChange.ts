import { query } from '../db/pool';
import { RankingChange as IRankingChange } from '../types';

export class RankingChange {
  static async create(data: IRankingChange): Promise<void> {
    const { productId, keyword, previousRank, currentRank, rankChange, changedAt } = data;
    
    await query(
      `INSERT INTO v2_ranking_changes 
       (product_id, keyword, previous_rank, current_rank, rank_change, changed_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, keyword, previousRank, currentRank, rankChange, changedAt]
    );
  }

  static async detectAndSave(
    productId: number, 
    keyword: string, 
    currentRank: number,
    changedAt: Date
  ): Promise<void> {
    // Get previous rank
    const previous = await query<{ rank: number }>(
      `SELECT rank FROM v2_ranking_history 
       WHERE product_id = $1 AND keyword = $2
       AND crawled_at < $3
       ORDER BY crawled_at DESC
       LIMIT 1`,
      [productId, keyword, changedAt]
    );

    if (previous.length > 0 && previous[0].rank !== currentRank) {
      const previousRank = previous[0].rank;
      const rankChange = previousRank - currentRank; // positive = improved, negative = dropped

      await this.create({
        productId,
        keyword,
        previousRank,
        currentRank,
        rankChange,
        changedAt,
      });
    }
  }

  static async getLatestChange(productId: number, keyword: string): Promise<IRankingChange | null> {
    const result = await query<any>(
      `SELECT * FROM v2_ranking_changes 
       WHERE product_id = $1 AND keyword = $2
       ORDER BY changed_at DESC
       LIMIT 1`,
      [productId, keyword]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      productId: row.product_id,
      keyword: row.keyword,
      previousRank: row.previous_rank,
      currentRank: row.current_rank,
      rankChange: row.rank_change,
      changedAt: row.changed_at,
    };
  }
}