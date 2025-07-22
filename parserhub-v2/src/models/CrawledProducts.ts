import { query } from '../db/pool';
import { Platform } from '../types';
import { logger } from '../utils/logger';

interface CrawledProduct {
  requestId?: number;
  productId: string | number;  // 문자열로 받아서 숫자로 변환
  name: string;
  href?: string;
  thumbnail?: string;
  rank: number;
  realRank?: number;
  page?: number;
  keyword: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  vendorItemId?: string | number;
  itemId?: string | number;
  nvMid?: string | number;
  deliveryInfo?: string;
  discountRate?: number;
  storeName?: string;
  storeGrade?: string;
  deliveryFee?: number;
  purchaseCount?: number;
  lowestPrice?: number;
  highestPrice?: number;
  mallCount?: number;
  category?: string;
  brand?: string;
}

export class CrawledProductsModel {
  // 문자열을 안전하게 숫자로 변환
  private static toNumber(value: string | number | undefined): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  // v2 테이블에 배치 저장 (INSERT ONLY - 순위 변동 추적을 위해 UPDATE 없음)
  static async saveToV2(platform: Platform, products: CrawledProduct[]): Promise<void> {
    if (products.length === 0) return;

    const tableName = `v2_crawled_products_${platform}`;
    
    try {
      if (platform === 'coupang') {
        // 배치 INSERT를 위한 값 배열 준비
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        products.forEach((product) => {
          placeholders.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
          );
          
          values.push(
            product.requestId,
            this.toNumber(product.productId),
            this.toNumber(product.vendorItemId),
            this.toNumber(product.itemId),
            product.name,
            product.href,
            product.thumbnail,
            product.rank,
            product.realRank || product.rank,
            product.page || 1,
            product.keyword,
            product.price,
            product.rating,
            product.reviewCount,
            product.deliveryInfo,
            product.discountRate
          );
        });

        const insertQuery = `
          INSERT INTO ${tableName} 
          (request_id, product_id, vendor_item_id, item_id, name, href, thumbnail, 
           rank, real_rank, page, keyword, price, rating, review_count, 
           delivery_info, discount_rate)
          VALUES ${placeholders.join(', ')}
        `;

        await query(insertQuery, values);
        logger.info(`Saved ${products.length} products to ${tableName}`);

      } else if (platform === 'naver_store') {
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        products.forEach((product) => {
          placeholders.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
          );
          
          values.push(
            product.requestId,
            this.toNumber(product.productId),
            this.toNumber(product.nvMid),
            product.name,
            product.href,
            product.thumbnail,
            product.rank,
            product.realRank || product.rank,
            product.page || 1,
            product.keyword,
            product.price,
            product.storeName,
            product.storeGrade,
            product.deliveryFee,
            product.purchaseCount
          );
        });

        const insertQuery = `
          INSERT INTO ${tableName} 
          (request_id, product_id, nv_mid, name, href, thumbnail, rank, real_rank,
           page, keyword, price, store_name, store_grade, delivery_fee, purchase_count)
          VALUES ${placeholders.join(', ')}
        `;

        await query(insertQuery, values);
        logger.info(`Saved ${products.length} products to ${tableName}`);

      } else if (platform === 'naver_compare') {
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        products.forEach((product) => {
          placeholders.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
            `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
          );
          
          values.push(
            product.requestId,
            this.toNumber(product.productId),
            this.toNumber(product.nvMid),
            product.name,
            product.href,
            product.thumbnail,
            product.rank,
            product.realRank || product.rank,
            product.page || 1,
            product.keyword,
            product.price,
            product.lowestPrice,
            product.highestPrice,
            product.mallCount,
            product.category,
            product.brand
          );
        });

        const insertQuery = `
          INSERT INTO ${tableName} 
          (request_id, product_id, nv_mid, name, href, thumbnail, rank, real_rank,
           page, keyword, price, lowest_price, highest_price, mall_count, category, brand)
          VALUES ${placeholders.join(', ')}
        `;

        await query(insertQuery, values);
        logger.info(`Saved ${products.length} products to ${tableName}`);
      }
    } catch (error) {
      logger.error(`Error saving products to ${tableName}:`, error);
      throw error;
    }
  }

  // 기존 v1 테이블에도 저장 (하위 호환성)
  static async saveProducts(platform: Platform, products: CrawledProduct[]): Promise<void> {
    // 기존 코드 유지...
  }
}