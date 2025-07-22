import { pool, query } from '../db/pool';
import { Product as IProduct, Platform } from '../types';

export class Product {
  static async findOrCreate(data: IProduct & { platform: Platform }): Promise<number> {
    const { platform, id, productId, vendorItemId, itemId, nvMid, name, href, thumbnail } = data;
    
    // Try to find existing product
    const existing = await query<{ id: number }>(
      `SELECT id FROM v2_products 
       WHERE platform = $1 AND product_id = $2`,
      [platform, productId || id]
    );

    if (existing.length > 0) {
      // Update product info
      await query(
        `UPDATE v2_products 
         SET name = $3, href = $4, thumbnail = $5, 
             vendor_item_id = $6, item_id = $7, nv_mid = $8
         WHERE platform = $1 AND product_id = $2`,
        [platform, productId || id, name, href, thumbnail, vendorItemId, itemId, nvMid]
      );
      return existing[0].id;
    }

    // Create new product
    const result = await query<{ id: number }>(
      `INSERT INTO v2_products 
       (platform, product_id, vendor_item_id, item_id, nv_mid, name, href, thumbnail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [platform, productId || id, vendorItemId, itemId, nvMid, name, href, thumbnail]
    );

    return result[0].id;
  }

  static async findByCode(platform: Platform, code: string): Promise<number | null> {
    const result = await query<{ id: number }>(
      `SELECT id FROM v2_products 
       WHERE platform = $1 AND (
         product_id = $2 OR 
         vendor_item_id = $2 OR 
         item_id = $2 OR 
         nv_mid = $2
       )
       LIMIT 1`,
      [platform, code]
    );

    return result.length > 0 ? result[0].id : null;
  }

  static async getById(id: number): Promise<IProduct | null> {
    const result = await query<any>(
      `SELECT * FROM v2_products WHERE id = $1`,
      [id]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.product_id,
      productId: row.product_id,
      vendorItemId: row.vendor_item_id,
      itemId: row.item_id,
      nvMid: row.nv_mid,
      name: row.name,
      href: row.href,
      thumbnail: row.thumbnail,
    };
  }
}