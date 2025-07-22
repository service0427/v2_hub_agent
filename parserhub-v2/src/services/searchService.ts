import { logger } from '../utils/logger';
import { Platform } from '../types';
import { config } from '../config';
import { 
  generateCoupangSearchResult, 
  generateNaverStoreSearchResult, 
  generateNaverCompareSearchResult 
} from '../utils/sampleDataGenerator';
import { rankingService } from './rankingService';
import { agentManager } from '../socket/agentManager';
import { v4 as uuidv4 } from 'uuid';
import { CrawledProductsModel } from '../models/CrawledProducts';
import { MonitoringKeywordModel } from '../models/MonitoringKeyword';

class SearchService {
  async search(platform: Platform, keyword: string, limit: number = 10) {
    logger.info(`Searching ${platform} for keyword: ${keyword}, limit: ${limit}`);

    try {
      // In development mode or when no agents available, use sample data
      if (config.devMode || agentManager.getOnlineAgents().length === 0) {
        logger.info('Using sample data for search');
        
        let result;
        switch (platform) {
          case 'coupang':
            result = generateCoupangSearchResult(keyword, limit);
            break;
          case 'naver_store':
            result = generateNaverStoreSearchResult(keyword, limit);
            break;
          case 'naver_compare':
            result = generateNaverCompareSearchResult(keyword, limit);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Process and save products
        const requestId = Math.floor(Math.random() * 1000) + 1;
        
        if (result.products && result.products.length > 0) {
          const processedProducts = result.products.map(product => this.processProduct(platform, product));
          
          // Save to v2 ranking system
          await rankingService.saveSearchResults(
            platform,
            keyword,
            1, // page number
            processedProducts
          );

          // Save to v2_crawled_products for historical tracking
          const crawledProducts = processedProducts.map(product => ({
            ...product,
            requestId,
            keyword,
          }));
          
          await CrawledProductsModel.saveToV2(platform, crawledProducts);
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

        // Add request ID and agent info
        return {
          ...result,
          requestId,
          agentId: `agent-${uuidv4()}`,
          duration: Math.floor(Math.random() * 3000) + 1000
        };
      }

      // In production, create actual agent task
      // This would be implemented when agents are available
      throw new Error('Agent-based search not yet implemented');

    } catch (error) {
      logger.error(`Search error for ${platform}:`, error);
      throw error;
    }
  }

  private processProduct(platform: Platform, product: any) {
    // Normalize product data across platforms
    const processed: any = {
      id: product.id,
      name: product.name,
      href: product.href,
      thumbnail: product.thumbnail,
      rank: parseInt(product.rank) || product.realRank,
      page: product.page || 1,
    };

    // Platform-specific fields
    switch (platform) {
      case 'coupang':
        processed.productId = product.productId;
        processed.vendorItemId = product.vendorItemId;
        processed.itemId = product.itemId;
        break;
        
      case 'naver_store':
      case 'naver_compare':
        processed.productId = product.productId || product.id;
        processed.nvMid = product.nvMid || product.id;
        // Extract nvMid from URL if needed
        if (!processed.nvMid && product.href) {
          const match = product.href.match(/nvMid=(\d+)/);
          if (match) processed.nvMid = match[1];
        }
        break;
    }

    // Copy additional fields
    if (product.price) processed.price = product.price;
    if (product.rating) processed.rating = product.rating;
    if (product.storeName) processed.storeName = product.storeName;
    if (product.storeGrade) processed.storeGrade = product.storeGrade;
    if (product.deliveryFee !== undefined) processed.deliveryFee = product.deliveryFee;
    if (product.purchaseCount) processed.purchaseCount = product.purchaseCount;
    if (product.lowestPrice) processed.lowestPrice = product.lowestPrice;
    if (product.highestPrice) processed.highestPrice = product.highestPrice;
    if (product.mallCount) processed.mallCount = product.mallCount;
    if (product.category) processed.category = product.category;
    if (product.brand) processed.brand = product.brand;

    return processed;
  }
}

export const searchService = new SearchService();