/**
 * 네이버 쇼핑 가격비교 검색 워크플로우
 * 가격비교형 카탈로그 기반 검색
 */
const { createLogger } = require('./logger');

module.exports = {
  name: 'naver-shopping-compare',
  description: '네이버 쇼핑 가격비교 검색 및 데이터 추출',
  
  async execute(page, params) {
    const { keyword, limit = null } = params;
    const log = createLogger('[naver-shopping-compare]');
    
    if (!keyword) {
      throw new Error('Keyword is required');
    }
    
    log.separator();
    log.info(`Starting price comparison search for: ${keyword}, limit: ${limit || '제한없음'}`);
    
    let allProducts = [];
    let currentPage = 1;
    const maxPages = 5; // 최대 5페이지까지만
    
    try {
      while (true) {
        // 검색 URL 구성 (가격비교 검색)
        const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&pagingIndex=${currentPage}`;
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
          const noResultElement = document.querySelector('.no_result_area');
          const productList = document.querySelector('[class*="basicList"]');
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
          
          // 가격비교 상품 아이템 선택
          const items = document.querySelectorAll('[class*="product_item"], [class*="basicList_item"]');
          
          items.forEach((item) => {
            try {
              // 광고 상품 제외
              if (item.querySelector('[class*="ad_label"]') || 
                  item.classList.contains('ad_item')) {
                return;
              }
              
              // 상품 정보 추출
              const titleElement = item.querySelector('[class*="basicList_title"] a, [class*="product_title"]');
              const linkElement = item.querySelector('[class*="basicList_link"], a[class*="product_link"]');
              const priceElement = item.querySelector('[class*="price_num"]');
              const categoryElement = item.querySelector('[class*="basicList_depth"]');
              const imageElement = item.querySelector('img[class*="thumbnail_thumb"], img[class*="product_img"]');
              const reviewElement = item.querySelector('[class*="basicList_etc"] em, [class*="product_etc"] span');
              const mallCountElement = item.querySelector('[class*="basicList_mall_count"]');
              const specElement = item.querySelector('[class*="basicList_spec"]');
              
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
              
              // 판매처 수 파싱
              const mallCountText = mallCountElement ? mallCountElement.textContent.trim() : '';
              const mallCount = mallCountText.replace(/[^\d]/g, '');
              
              // 스펙 정보 추출
              const specs = [];
              if (specElement) {
                const specItems = specElement.querySelectorAll('[class*="spec_item"]');
                specItems.forEach(spec => {
                  specs.push(spec.textContent.trim());
                });
              }
              
              products.push({
                id: productId,
                name: titleElement ? titleElement.textContent.trim() : '',
                href: linkElement ? linkElement.getAttribute('href') : '',
                price: price ? parseInt(price) : null,
                category: categoryElement ? categoryElement.textContent.trim() : '',
                thumbnail: imageElement ? imageElement.getAttribute('src') : '',
                reviewCount: reviewCount ? parseInt(reviewCount) : 0,
                mallCount: mallCount ? parseInt(mallCount) : 1,
                specs: specs,
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
          const nextButton = document.querySelector('[class*="pagination_next"]:not(.disabled)');
          return !!nextButton;
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
    
    log.success(`총 ${allProducts.length}개 가격비교 상품 추출 완료`);
    log.separator();
    
    return {
      type: 'price_comparison',
      keyword: keyword,
      count: allProducts.length,
      products: allProducts,
      totalPages: currentPage,
      searchUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
      timestamp: new Date().toISOString()
    };
  }
};