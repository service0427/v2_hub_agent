import { RankingRequest, RankingResponse, Product, Platform, DetailedRankingResponse } from '../types';
import { getCache, setCache, deleteCache, clearCache } from '../db/redis';
import { logger } from '../utils/logger';
import { config } from '../config';
import { sampleDataService } from './sampleDataService';
import { Product as ProductModel } from '../models/Product';
import { SearchResult } from '../models/SearchResult';
import { RankingHistory } from '../models/RankingHistory';
import { RankingChange } from '../models/RankingChange';
import { MonitoringKeywordModel } from '../models/MonitoringKeyword';

class RankingService {
  private getCacheKey(platform: Platform, keyword: string, code: string): string {
    return `ranking:${platform}:${keyword}:${code}`;
  }

  async getRanking(request: RankingRequest): Promise<RankingResponse> {
    const { platform, keyword, code, limit = 50 } = request;
    const cacheKey = this.getCacheKey(platform, keyword, code);

    try {
      // Check cache first
      const cached = await getCache<RankingResponse>(cacheKey);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
        };
      }

      // In dev mode, use sample data
      if (config.devMode) {
        const products = sampleDataService.getProducts(platform, keyword, limit);
        const product = this.findProductByCode(products, code);

        const response: RankingResponse = {
          success: true,
          keyword,
          code,
          rank: product?.rank,
          product,
          collectedAt: new Date(),
          fromCache: false,
        };

        // Cache the result
        await setCache(cacheKey, response, 300); // 5 minutes cache
        return response;
      }

      // 자동으로 monitoring_keywords에 추가 (기본 1시간 주기)
      try {
        await MonitoringKeywordModel.create(
          keyword,
          platform,
          2,  // priority: 2 (medium)
          1   // interval_hours: 1시간
        );
        logger.info(`Added keyword "${keyword}" to monitoring for platform ${platform}`);
      } catch (error) {
        // 이미 존재하는 경우 무시 (ON CONFLICT로 처리됨)
        logger.debug(`Keyword "${keyword}" already exists in monitoring for platform ${platform}`);
      }

      // In production, this would query the database or trigger a crawl
      // For now, return not found
      return {
        success: false,
        keyword,
        code,
        message: 'Product not found in rankings',
        fromCache: false,
      };

    } catch (error) {
      logger.error('Ranking service error:', error);
      return {
        success: false,
        error: 'Failed to get ranking',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private findProductByCode(products: Product[], code: string): Product | undefined {
    // Flexible matching - check multiple ID formats
    return products.find(p => 
      p.id === code ||
      p.productId === code ||
      p.vendorItemId === code ||
      p.itemId === code ||
      p.nvMid === code ||
      p.href?.includes(code)
    );
  }

  async clearCache(platform: Platform, keyword?: string): Promise<void> {
    if (keyword) {
      await clearCache(`ranking:${platform}:${keyword}:*`);
      await clearCache(`page:${platform}:${keyword}:*`);
    } else {
      await clearCache(`ranking:${platform}:*`);
      await clearCache(`page:${platform}:*`);
    }
  }

  // Save search results to database
  async saveSearchResults(
    platform: Platform,
    keyword: string,
    pageNumber: number,
    products: Product[]
  ): Promise<void> {
    try {
      const crawledAt = new Date();
      
      // Create search result record
      const searchResultId = await SearchResult.create({
        platform,
        keyword,
        pageNumber,
        totalResults: products.length,
        crawledAt,
      });

      // Save each product and its ranking
      for (const product of products) {
        // Find or create product
        const productId = await ProductModel.findOrCreate({
          ...product,
          platform,
        });

        // Save ranking history
        await RankingHistory.create(searchResultId, {
          productId,
          keyword,
          rank: product.rank || 0,
          page: product.page || pageNumber,
          price: product.price,
          rating: product.rating,
          reviewCount: undefined, // Add if available
          crawledAt,
        });

        // Detect and save ranking changes
        await RankingChange.detectAndSave(productId, keyword, product.rank || 0, crawledAt);

        // Cache individual product ranking
        const cacheKey = this.getCacheKey(platform, keyword, product.id);
        const rankingData: RankingResponse = {
          success: true,
          keyword,
          code: product.id,
          rank: product.rank,
          product,
          collectedAt: crawledAt,
          fromCache: false,
        };
        await setCache(cacheKey, rankingData, config.redis.ttl);
      }

      // Cache the entire page
      const pageCacheKey = `page:${platform}:${keyword}:${pageNumber}`;
      await setCache(pageCacheKey, {
        products,
        crawledAt,
        totalCount: products.length,
      }, config.redis.ttl);

      logger.info(`Saved ${products.length} products for ${platform}:${keyword} page ${pageNumber}`);
    } catch (error) {
      logger.error('Error saving search results:', error);
      throw error;
    }
  }

  // Get ranking history
  async getRankingHistory(
    platform: Platform,
    keyword: string,
    code: string,
    days: number
  ): Promise<DetailedRankingResponse> {
    try {
      // Find product by code
      const productId = await ProductModel.findByCode(platform, code);
      
      if (!productId) {
        return {
          success: false,
          keyword,
          code,
          message: 'Product not found',
        };
      }

      // Get product details
      const product = await ProductModel.getById(productId);
      
      // Get ranking history
      const history = await RankingHistory.getHistory(productId, keyword, days);
      
      // Get latest ranking change
      const latestChange = await RankingChange.getLatestChange(productId, keyword);

      return {
        success: true,
        keyword,
        code,
        product: product || undefined,
        rankHistory: latestChange ? {
          previous: latestChange.previousRank || 0,
          change: latestChange.rankChange || 0,
          lastChecked: latestChange.changedAt,
        } : undefined,
        history: history.map(h => ({
          date: h.crawledAt,
          rank: h.rank,
          price: h.price,
        })),
        collectedAt: new Date(),
        fromCache: false,
      };
    } catch (error) {
      logger.error('Error getting ranking history:', error);
      return {
        success: false,
        error: 'Failed to get ranking history',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get top competitors
  async getTopCompetitors(
    platform: Platform,
    keyword: string,
    limit: number
  ): Promise<Product[]> {
    try {
      const topProducts = await RankingHistory.getTopProducts(platform, keyword, limit);
      
      return topProducts.map(row => ({
        id: row.product_id,
        productId: row.product_id,
        vendorItemId: row.vendor_item_id,
        itemId: row.item_id,
        nvMid: row.nv_mid,
        name: row.name,
        href: row.href,
        thumbnail: row.thumbnail,
        price: row.price,
        rating: row.rating,
        rank: row.rank,
      }));
    } catch (error) {
      logger.error('Error getting top competitors:', error);
      return [];
    }
  }
}

export const rankingService = new RankingService();