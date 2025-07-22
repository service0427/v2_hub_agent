import { Product, Platform } from '../types';

export const generateSampleProducts = (platform: Platform, keyword: string, count: number = 20): Product[] => {
  const products: Product[] = [];
  
  for (let i = 1; i <= count; i++) {
    if (platform === 'coupang') {
      products.push({
        id: Math.floor(Math.random() * 900000000 + 100000000).toString(),
        productId: Math.floor(Math.random() * 900000000 + 100000000).toString(),
        vendorItemId: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        name: `${keyword} 상품 ${i} - 쿠팡`,
        href: `https://www.coupang.com/vp/products/${Math.floor(Math.random() * 900000000 + 100000000)}?vendorItemId=${Math.floor(Math.random() * 90000000000 + 10000000000)}`,
        thumbnail: `https://thumbnail.coupang.com/thumbnails/remote/${Math.floor(Math.random() * 900000000 + 100000000)}.jpg`,
        price: Math.floor(Math.random() * 90000 + 10000),
        rating: Math.floor(Math.random() * 5) + 1,
        rank: i,
        page: Math.ceil(i / 40), // 40 products per page
      });
    } else if (platform === 'naver_store') {
      products.push({
        id: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        productId: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        nvMid: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        name: `${keyword} 상품 ${i} - 네이버 스토어`,
        href: `https://smartstore.naver.com/products/${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        thumbnail: `https://shopping-phinf.pstatic.net/main_${Math.floor(Math.random() * 9000000 + 1000000)}/original.jpg`,
        price: Math.floor(Math.random() * 90000 + 10000),
        rank: i,
        page: Math.ceil(i / 40),
      });
    } else if (platform === 'naver_compare') {
      products.push({
        id: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        productId: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        nvMid: Math.floor(Math.random() * 90000000000 + 10000000000).toString(),
        name: `${keyword} 상품 ${i} - 네이버 가격비교`,
        href: `https://search.shopping.naver.com/catalog/${Math.floor(Math.random() * 90000000000 + 10000000000)}`,
        thumbnail: `https://shopping-phinf.pstatic.net/main_${Math.floor(Math.random() * 9000000 + 1000000)}/original.jpg`,
        price: Math.floor(Math.random() * 90000 + 10000),
        rank: i,
        page: Math.ceil(i / 20), // 20 products per page for catalog
      });
    }
  }
  
  return products;
};

// 쿠팡 검색결과 형식에 맞춘 샘플 데이터 생성
export const generateCoupangSearchResult = (keyword: string, limit: number = 10) => {
  const products = [];
  
  for (let i = 1; i <= limit; i++) {
    const productId = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const itemId = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    const vendorItemId = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    
    products.push({
      id: vendorItemId,
      name: `${keyword} 상품 ${i}`,
      href: `https://www.coupang.com/vp/products/${productId}?itemId=${itemId}&vendorItemId=${vendorItemId}&q=${encodeURIComponent(keyword)}&rank=${i}`,
      thumbnail: `https://thumbnail${Math.floor(Math.random() * 9) + 1}.coupangcdn.com/thumbnails/remote/320x320ex/image/vendor_inventory/${Math.random().toString(36).substring(7)}.jpg`,
      rank: i.toString(),
      productId: productId,
      itemId: itemId,
      vendorItemId: vendorItemId,
      realRank: i,
      page: Math.ceil(i / 72)
    });
  }
  
  return {
    keyword,
    count: limit,
    products,
    relatedKeywords: [],
    totalPages: Math.ceil(limit / 72),
    searchUrl: `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`,
    timestamp: new Date().toISOString()
  };
};

// 네이버 스토어 검색결과 형식
export const generateNaverStoreSearchResult = (keyword: string, limit: number = 10) => {
  const products = [];
  
  for (let i = 1; i <= limit; i++) {
    const productId = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    const nvMid = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    
    products.push({
      id: productId,
      productId: productId,
      nvMid: nvMid,
      name: `${keyword} 상품 ${i} - 스마트스토어`,
      href: `https://smartstore.naver.com/products/${productId}`,
      thumbnail: `https://shopping-phinf.pstatic.net/main_${Math.floor(Math.random() * 9000000 + 1000000)}/original.jpg`,
      rank: i.toString(),
      realRank: i,
      page: Math.ceil(i / 40),
      price: Math.floor(Math.random() * 90000 + 10000),
      storeName: `스토어${Math.floor(Math.random() * 1000)}`,
      storeGrade: ['POWER', 'PREMIUM', 'BASIC'][Math.floor(Math.random() * 3)],
      deliveryFee: Math.random() > 0.5 ? 0 : 3000,
      purchaseCount: Math.floor(Math.random() * 10000)
    });
  }
  
  return {
    keyword,
    count: limit,
    products,
    searchUrl: `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(keyword)}`,
    timestamp: new Date().toISOString()
  };
};

// 네이버 가격비교 검색결과 형식
export const generateNaverCompareSearchResult = (keyword: string, limit: number = 10) => {
  const products = [];
  
  for (let i = 1; i <= limit; i++) {
    const productId = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    const nvMid = Math.floor(Math.random() * 90000000000 + 10000000000).toString();
    const lowestPrice = Math.floor(Math.random() * 90000 + 10000);
    
    products.push({
      id: productId,
      productId: productId,
      nvMid: nvMid,
      name: `${keyword} 상품 ${i} - 가격비교`,
      href: `https://search.shopping.naver.com/catalog/${productId}`,
      thumbnail: `https://shopping-phinf.pstatic.net/main_${Math.floor(Math.random() * 9000000 + 1000000)}/original.jpg`,
      rank: i.toString(),
      realRank: i,
      page: Math.ceil(i / 20),
      price: lowestPrice,
      lowestPrice: lowestPrice,
      highestPrice: lowestPrice + Math.floor(Math.random() * 20000),
      mallCount: Math.floor(Math.random() * 50) + 1,
      category: ['전자제품', '패션', '뷰티', '식품', '생활용품'][Math.floor(Math.random() * 5)],
      brand: `브랜드${Math.floor(Math.random() * 100)}`
    });
  }
  
  return {
    keyword,
    count: limit,
    products,
    searchUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
    timestamp: new Date().toISOString()
  };
};