/**
 * 네이버 쇼핑 Smart Store 검색 워크플로우
 * Smart Store 중심의 개별 상품 리스트 추출
 */
const { createLogger } = require('./logger');

module.exports = {
  name: 'naver-shopping-store',
  description: '네이버 쇼핑 Smart Store 상품 검색 및 데이터 추출',
  
  async execute(page, params) {
    const { keyword, limit = null } = params;
    const log = createLogger('[naver-shopping-store]');
    
    if (!keyword) {
      throw new Error('Keyword is required');
    }
    
    log.separator();
    log.info(`Starting Smart Store search for: ${keyword}, limit: ${limit || '제한없음'}`);
    
    let allProducts = [];
    let currentPage = 1;
    const maxPages = 5; // 최대 5페이지까지만
    
    try {
      while (true) {
        // 검색 URL 구성 (Smart Store 검색)
        const searchUrl = `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(keyword)}&page=${currentPage}`;
        log.log(`Navigating to: ${searchUrl}`);
        
        // 페이지 이동
        await page.goto(searchUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        // 검색 결과 로드 대기
        await page.waitForTimeout(2000);
        
        // 검색 결과 확인
        const hasResults = await page.evaluate(() => {
          // 검색 결과 없음 체크
          const noResultElement = document.querySelector('.search_no_result');
          const productList = document.querySelector('[class*="product_list"]');
          return !noResultElement && !!productList;
        });
        
        if (!hasResults) {
          log.log('검색 결과가 없습니다.');
          break;
        }
        
        // 스크롤하여 모든 상품 로드
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);
        
        // 상품 데이터 추출
        const pageProducts = await page.evaluate(() => {
          const products = [];
          
          // Smart Store 상품 아이템 선택
          const items = document.querySelectorAll('[class*="product_item"]');
          
          items.forEach((item, index) => {
            try {
              // 상품 정보 추출
              const titleElement = item.querySelector('[class*="product_title"]');
              const linkElement = item.querySelector('a[class*="product_link"]');
              const priceElement = item.querySelector('[class*="price_num"]');
              const storeElement = item.querySelector('[class*="product_mall"]');
              const imageElement = item.querySelector('img[class*="product_img"]');
              const reviewElement = item.querySelector('[class*="product_etc"] span:nth-child(2)');
              const deliveryElement = item.querySelector('[class*="product_delivery"]');
              
              // 링크에서 상품 ID 추출
              const href = linkElement ? linkElement.getAttribute('href') : '';
              let productId = null;
              if (href) {
                const idMatch = href.match(/nvMid=(\d+)/);
                productId = idMatch ? idMatch[1] : null;
              }
              
              // 가격 파싱
              const priceText = priceElement ? priceElement.textContent.trim() : '';
              const price = priceText.replace(/[^\d]/g, '');
              
              // 리뷰 수 파싱
              const reviewText = reviewElement ? reviewElement.textContent.trim() : '';
              const reviewCount = reviewText.replace(/[^\d]/g, '');
              
              products.push({
                id: productId,
                name: titleElement ? titleElement.textContent.trim() : '',
                href: linkElement ? linkElement.getAttribute('href') : '',
                price: price ? parseInt(price) : null,
                store: storeElement ? storeElement.textContent.trim() : '',
                thumbnail: imageElement ? imageElement.getAttribute('src') : '',
                reviewCount: reviewCount ? parseInt(reviewCount) : 0,
                delivery: deliveryElement ? deliveryElement.textContent.trim() : '',
                rank: null, // URL에서 추출할 수 있으면 추가
                realRank: null // 실제 순위는 외부에서 설정
              });
            } catch (error) {
              console.error('Error extracting product:', error);
            }
          });
          
          return products;
        });
        
        // 실제 순위 추가
        pageProducts.forEach((product, index) => {
          product.realRank = allProducts.length + index + 1;
          product.page = currentPage;
        });
        
        log.log(`페이지 ${currentPage}: ${pageProducts.length}개 상품 추출됨`);
        
        // 전체 목록에 추가
        allProducts = allProducts.concat(pageProducts);
        
        // 종료 조건 체크
        if (limit && allProducts.length >= limit) {
          allProducts = allProducts.slice(0, limit);
          break;
        }
        
        if (pageProducts.length === 0 || currentPage >= maxPages) {
          break;
        }
        
        // 다음 페이지 존재 여부 확인
        const hasNextPage = await page.evaluate(() => {
          const nextButton = document.querySelector('a[class*="pagination_next"]');
          return nextButton && !nextButton.classList.contains('disabled');
        });
        
        if (!hasNextPage) {
          log.log('더 이상 페이지가 없습니다.');
          break;
        }
        
        currentPage++;
        await page.waitForTimeout(1000); // 페이지 간 대기
      }
      
    } catch (error) {
      log.error(`Error during crawling: ${error.message}`);
      throw error;
    }
    
    log.success(`총 ${allProducts.length}개 Smart Store 상품 추출 완료`);
    log.separator();
    
    return {
      type: 'smart_store',
      keyword: keyword,
      count: allProducts.length,
      products: allProducts,
      totalPages: currentPage,
      searchUrl: `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(keyword)}`,
      timestamp: new Date().toISOString()
    };
  }
};