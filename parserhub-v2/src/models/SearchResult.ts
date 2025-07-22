import { query } from '../db/pool';
import { SearchResult as ISearchResult, Platform } from '../types';

export class SearchResult {
  static async create(data: ISearchResult): Promise<number> {
    const { platform, keyword, pageNumber, totalResults, crawledAt } = data;
    
    const result = await query<{ id: number }>(
      `INSERT INTO v2_search_results 
       (platform, keyword, page_number, total_results, crawled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [platform, keyword, pageNumber, totalResults, crawledAt]
    );

    return result[0].id;
  }

  static async getLatest(platform: Platform, keyword: string): Promise<ISearchResult | null> {
    const result = await query<any>(
      `SELECT * FROM v2_search_results 
       WHERE platform = $1 AND keyword = $2
       ORDER BY crawled_at DESC
       LIMIT 1`,
      [platform, keyword]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      platform: row.platform,
      keyword: row.keyword,
      pageNumber: row.page_number,
      totalResults: row.total_results,
      crawledAt: row.crawled_at,
    };
  }
}