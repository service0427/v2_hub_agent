import { Product, Platform } from '../types';

class SampleDataService {
  private generateCoupangProducts(keyword: string, limit: number): Product[] {
    const products: Product[] = [];
    
    for (let i = 1; i <= limit; i++) {
      const productId = Math.floor(Math.random() * 900000000) + 100000000;
      const vendorItemId = Math.floor(Math.random() * 90000000000) + 10000000000;
      
      products.push({
        id: productId.toString(),
        productId: productId.toString(),
        vendorItemId: vendorItemId.toString(),
        name: `${keyword} 상품 ${i} - 쿠팡`,
        href: `https://www.coupang.com/vp/products/${productId}?vendorItemId=${vendorItemId}`,
        thumbnail: `https://thumbnail.coupang.com/thumbnails/remote/${productId}.jpg`,
        price: Math.floor(Math.random() * 100000) + 10000,
        rating: Math.floor(Math.random() * 5) + 1,
        rank: i,
        page: Math.ceil(i / 36),
      });
    }
    
    return products;
  }

  private generateNaverStoreProducts(keyword: string, limit: number): Product[] {
    const products: Product[] = [];
    
    for (let i = 1; i <= limit; i++) {
      const nvMid = Math.floor(Math.random() * 90000000000) + 10000000000;
      
      products.push({
        id: nvMid.toString(),
        nvMid: nvMid.toString(),
        name: `${keyword} 상품 ${i} - 네이버 스토어`,
        href: `https://smartstore.naver.com/main/products/${nvMid}`,
        thumbnail: `https://shopping-phinf.pstatic.net/${nvMid}_main.jpg`,
        price: Math.floor(Math.random() * 100000) + 10000,
        rating: Math.floor(Math.random() * 5) + 1,
        rank: i,
        page: Math.ceil(i / 40),
      });
    }
    
    return products;
  }

  private generateNaverCompareProducts(keyword: string, limit: number): Product[] {
    const products: Product[] = [];
    
    for (let i = 1; i <= limit; i++) {
      const nvMid = Math.floor(Math.random() * 90000000000) + 10000000000;
      const itemId = Math.floor(Math.random() * 900000000) + 100000000;
      
      products.push({
        id: nvMid.toString(),
        nvMid: nvMid.toString(),
        itemId: itemId.toString(),
        name: `${keyword} 상품 ${i} - 네이버 가격비교`,
        href: `https://search.shopping.naver.com/catalog/${nvMid}`,
        thumbnail: `https://shopping-phinf.pstatic.net/${nvMid}_main.jpg`,
        price: Math.floor(Math.random() * 100000) + 10000,
        rating: Math.floor(Math.random() * 5) + 1,
        rank: i,
        page: Math.ceil(i / 20),
      });
    }
    
    return products;
  }

  getProducts(platform: Platform, keyword: string, limit: number = 50): Product[] {
    switch (platform) {
      case 'coupang':
        return this.generateCoupangProducts(keyword, limit);
      case 'naver_store':
        return this.generateNaverStoreProducts(keyword, limit);
      case 'naver_compare':
        return this.generateNaverCompareProducts(keyword, limit);
      default:
        return [];
    }
  }

  getProduct(platform: Platform, code: string): Product | undefined {
    // Generate a single product for the given code
    const products = this.getProducts(platform, 'sample', 100);
    return products.find(p => 
      p.id === code ||
      p.productId === code ||
      p.vendorItemId === code ||
      p.itemId === code ||
      p.nvMid === code
    );
  }
}

export const sampleDataService = new SampleDataService();