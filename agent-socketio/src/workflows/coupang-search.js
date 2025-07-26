/**
 * 쿠팡 상품 검색 워크플로우 (페이지네이션 지원)
 * 키워드로 검색하여 상품 목록 추출
 */
const { createLogger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'coupang-search',
  description: '쿠팡에서 상품 검색 및 데이터 추출',
  
  async execute(page, params) {
    const { keyword, limit = null, pages = null, targetCode = null } = params;
    const log = createLogger('[coupang-search]');
    
    if (!keyword) {
      throw new Error('Keyword is required');
    }
    
    log.separator();
    log.info(`Starting search for: ${keyword}, limit: ${limit || '제한없음'}, pages: ${pages || '기본 4페이지'}, targetCode: ${targetCode || '없음'}`);
    
    // 보안 정보 수집을 위한 이벤트 리스너
    let tlsInfo = null;
    let tlsCollected = false;
    page.on('response', async (response) => {
      if (response.url().includes('coupang.com') && !tlsCollected) {
        log.debug(`Response from: ${response.url().substring(0, 50)}...`);
        try {
          const security = response.securityDetails();
          if (security) {
            log.info(`Security details found for: ${response.url().substring(0, 50)}...`);
            tlsInfo = {
              protocol: security.protocol(),
              subjectName: security.subjectName(),
              issuer: security.issuer()
            };
            log.info(`TLS Info - Protocol: ${security.protocol()}, Subject: ${security.subjectName()}, Issuer: ${security.issuer()}`);
            
            // CDP로 더 자세한 정보 얻기 시도
            try {
              const client = await page.context().newCDPSession(page);
              const { visibleSecurityState } = await client.send('Security.getVisibleSecurityState');
              if (visibleSecurityState) {
                log.info(`Security State: ${JSON.stringify(visibleSecurityState.securityState)}`);
                if (visibleSecurityState.certificateSecurityState) {
                  log.info(`Cipher Suite: ${visibleSecurityState.certificateSecurityState.cipher || 'unknown'}`);
                  tlsInfo.cipher = visibleSecurityState.certificateSecurityState.cipher;
                }
              }
            } catch (cdpError) {
              log.debug(`CDP error: ${cdpError.message}`);
            }
            
            // TLS 정보를 파일로 저장
            try {
              const tlsLogDir = path.join(__dirname, '../../logs');
              await fs.mkdir(tlsLogDir, { recursive: true });
              
              // 브라우저 특성 정보 수집 (JA3 관련)
              const browserFingerprint = await page.evaluate(() => {
                return {
                  // Navigator 정보
                  userAgent: navigator.userAgent,
                  platform: navigator.platform,
                  language: navigator.language,
                  languages: navigator.languages,
                  hardwareConcurrency: navigator.hardwareConcurrency,
                  deviceMemory: navigator.deviceMemory,
                  
                  // WebGL 정보
                  webglVendor: (() => {
                    try {
                      const canvas = document.createElement('canvas');
                      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                      return {
                        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                      };
                    } catch (e) {
                      return null;
                    }
                  })(),
                  
                  // Canvas 핑거프린트
                  canvasFingerprint: (() => {
                    try {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      ctx.textBaseline = 'top';
                      ctx.font = '14px Arial';
                      ctx.fillText('fingerprint', 2, 2);
                      return canvas.toDataURL().slice(-50);
                    } catch (e) {
                      return null;
                    }
                  })(),
                  
                  // TLS 관련 지원 기능
                  crypto: {
                    subtle: !!window.crypto?.subtle,
                    getRandomValues: !!window.crypto?.getRandomValues
                  }
                };
              });
              
              const tlsLogFile = path.join(tlsLogDir, `tls-info-${Date.now()}.json`);
              const tlsData = {
                timestamp: new Date().toISOString(),
                keyword: keyword,
                url: response.url(),
                tlsInfo: tlsInfo,
                browserFingerprint: browserFingerprint,
                // JA3는 서버 측에서 계산되지만, 관련 정보 저장
                ja3Related: {
                  comment: "JA3 is calculated server-side from TLS handshake",
                  tlsVersion: tlsInfo?.protocol,
                  cipher: tlsInfo?.cipher,
                  userAgent: browserFingerprint.userAgent
                }
              };
              
              await fs.writeFile(tlsLogFile, JSON.stringify(tlsData, null, 2));
              log.info(`TLS info saved to: ${tlsLogFile}`);
              tlsCollected = true; // 한 번만 저장
            } catch (saveError) {
              log.error(`Failed to save TLS info: ${saveError.message}`);
            }
          }
        } catch (e) {
          // 무시
        }
      }
    });
    
    // 페이지를 깨끗한 상태로 만드는 함수
    const cleanupPage = async () => {
      try {
        // 페이지가 유효한지 확인
        if (!page || page.isClosed()) {
          log.warn('Page is closed or invalid, skipping cleanup');
          return;
        }
        
        // about:blank로 이동 (빠른 처리를 위해 timeout 단축)
        await page.goto('about:blank', {
          waitUntil: 'domcontentloaded',
          timeout: 1000
        }).catch((error) => {
          log.warn(`Failed to navigate to about:blank: ${error.message}`);
        });
        
        log.info('Page cleaned up - navigated to about:blank');
      } catch (error) {
        log.debug(`Page cleanup skipped: ${error.message}`);
      }
    };
    
    // 페이지당 최대 72개, 광고 제외하면 실제로는 더 적을 수 있음
    const pageSize = 72;
    let allProducts = [];
    let currentPage = 1;
    let shouldContinue = true;
    let relatedKeywords = []; // 연관 검색어
    
    // 네트워크 응답 모니터링 설정
    let networkBlocked = false;
    let failedRequests = [];
    
    const requestFailedHandler = (request) => {
      const url = request.url();
      const failure = request.failure();
      if (url.includes('coupang.com')) {
        log.warn(`Request failed: ${url}`);
        log.warn(`Failure reason: ${failure?.errorText}`);
        failedRequests.push({
          url: url,
          error: failure?.errorText
        });
        if (failure?.errorText === 'net::ERR_BLOCKED_BY_CLIENT' || 
            failure?.errorText === 'net::ERR_FAILED' ||
            failure?.errorText === 'net::ERR_HTTP2_PROTOCOL_ERROR' ||
            failure?.errorText === 'net::ERR_CONNECTION_REFUSED' ||
            failure?.errorText === 'net::ERR_CONNECTION_RESET') {
          networkBlocked = true;
        }
      }
    };
    
    page.on('requestfailed', requestFailedHandler);
    
    try {
      while (shouldContinue) {
        log.log(`\n페이지 ${currentPage} 크롤링 시작...`);
        
        // 검색 URL 생성
        const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user&failRedirectApp=true&page=${currentPage}&listSize=${pageSize}`;
        log.log(`Navigating to: ${searchUrl}`);
        
        // 페이지 이동
        let response;
        try {
          response = await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
        } catch (error) {
          log.error(`Navigation failed: ${error.message}`);
          await cleanupPage();
          return {
            keyword: keyword,
            count: allProducts.length,
            products: allProducts,
            searchUrl: searchUrl,
            blocked: true,
            blockType: 'NAVIGATION_FAILED',
            message: '네트워크 레벨 차단 (Navigation failed)',
            error: error.message,
            failedRequests: failedRequests,
            timestamp: new Date().toISOString()
          };
        }
        
        const status = response ? response.status() : 0;
        const currentUrl = page.url();
        log.log(`Response status: ${status}`);
        log.log(`Current URL: ${currentUrl}`);
        
        // HTTP 상태 코드로 차단 감지
        if (status === 403) {
          log.error(`HTTP 403 Forbidden - 쿠팡이 접근을 차단했습니다.`);
          await cleanupPage();
          return {
            keyword: keyword,
            count: 0,
            products: [],
            searchUrl: searchUrl,
            blocked: true,
            blockType: 'HTTP_403_FORBIDDEN',
            message: 'HTTP 403 - 쿠팡이 접근을 차단했습니다',
            status: status,
            timestamp: new Date().toISOString()
          };
        }
        
        if (status === 429) {
          log.error(`HTTP 429 Too Many Requests - 요청이 너무 많습니다.`);
          await cleanupPage();
          return {
            keyword: keyword,
            count: 0,
            products: [],
            searchUrl: searchUrl,
            blocked: true,
            blockType: 'HTTP_429_TOO_MANY_REQUESTS',
            message: 'HTTP 429 - 너무 많은 요청으로 차단되었습니다',
            status: status,
            timestamp: new Date().toISOString()
          };
        }

        // chrome-error URL은 네트워크 차단을 의미
        if (currentUrl.startsWith('chrome-error://') || networkBlocked) {
          log.error(`네트워크 레벨 차단 감지됨!`);
          log.error(`차단된 URL: ${currentUrl}`);
          if (failedRequests.length > 0) {
            log.error(`실패한 요청들:`, failedRequests);
          }
          await cleanupPage();
          return {
            keyword: keyword,
            count: allProducts.length,
            products: allProducts,
            searchUrl: currentUrl,
            blocked: true,
            blockType: 'NETWORK_LEVEL_BLOCK',
            message: '네트워크 레벨에서 차단됨',
            networkBlocked: true,
            failedRequests: failedRequests,
            timestamp: new Date().toISOString()
          };
        }
        
        // 페이지 초기 로드 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // "검색결과가 없습니다" 체크
        const quickCheck = await page.evaluate(() => {
          const noResultElement = document.querySelector('[class^=no-result_magnifier]');
          const noResultText = document.body?.innerText?.includes('에 대한 검색결과가 없습니다');
          const hasProductList = !!document.querySelector('#product-list');
          
          return {
            hasNoResult: !!noResultElement || !!noResultText,
            hasProductList: hasProductList
          };
        });
        
        if (quickCheck.hasNoResult && currentPage === 1) {
          log.warn(`검색 결과 없음 - "${keyword}"에 대한 검색결과가 없습니다.`);
          await cleanupPage();
          return {
            keyword: keyword,
            count: 0,
            products: [],
            searchUrl: page.url(),
            message: `"${keyword}"에 대한 검색결과가 없습니다`,
            noResults: true,
            timestamp: new Date().toISOString()
          };
        }
        
        // 상품 리스트 대기
        if (!quickCheck.hasProductList) {
          try {
            await page.waitForSelector('#product-list', { timeout: 5000 });
          } catch (error) {
            log.warn(`페이지 ${currentPage}: 상품 리스트를 찾을 수 없음`);
            break;
          }
        }
        
        // 상품 데이터 추출
        const pageProducts = await page.evaluate((maxItems) => {
          const items = document.querySelectorAll('#product-list > li[data-id]');
          
          const filteredItems = Array.from(items)
            .filter(i => {
              // 광고 상품 제외
              const linkElement = i.querySelector('a');
              const adMarkElement = i.querySelector('[class*=AdMark]');
              const href = linkElement ? linkElement.getAttribute('href') : '';
              return !adMarkElement && !href.includes('sourceType=srp_product_ads');
            });
          
          return filteredItems.map(i => {
            const linkElement = i.querySelector('a');
            const imgElement = i.querySelector('img');
            const href = linkElement ? linkElement.getAttribute('href') : '';
            
            // URL에서 rank 추출
            let rank = null;
            let productId = null;
            let itemId = null;
            let vendorItemId = null;
            
            if (href) {
              const rankMatch = href.match(/rank=(\d+)/);
              rank = rankMatch ? rankMatch[1] : null;
              
              // 상품 ID 추출 (URL 경로에서)
              const productIdMatch = href.match(/\/vp\/products\/(\d+)/);
              productId = productIdMatch ? productIdMatch[1] : null;
              
              // itemId 추출
              const itemIdMatch = href.match(/itemId=(\d+)/);
              itemId = itemIdMatch ? itemIdMatch[1] : null;
              
              // vendorItemId 추출
              const vendorItemIdMatch = href.match(/vendorItemId=(\d+)/);
              vendorItemId = vendorItemIdMatch ? vendorItemIdMatch[1] : null;
            }
            
            // 가격 추출
            let price = null;
            try {
              const priceElement = i.querySelector('[class*="Price_priceValue__"]');
              if (priceElement) {
                // "9,370원" 형식에서 숫자만 추출
                const priceText = priceElement.textContent || priceElement.innerText;
                const priceMatch = priceText.match(/[\d,]+/);
                if (priceMatch) {
                  // 콤마 제거하고 숫자로 변환
                  price = parseInt(priceMatch[0].replace(/,/g, ''));
                }
              }
            } catch (e) {
              // 가격 추출 실패 시 무시
            }
            
            // 평점 추출
            let rating = null;
            let reviewCount = null;
            
            try {
              // 평점 부분을 찾기 위한 여러 시도
              const ratingContainer = i.querySelector('[class*="ProductRating_productRating__"]');
              if (ratingContainer) {
                // 평점 숫자가 직접 텍스트로 있는 경우 (예: "4.5")
                const ratingSpan = ratingContainer.querySelector('[class*="ProductRating_rating__"]');
                if (ratingSpan) {
                  const ratingText = ratingSpan.textContent.trim();
                  const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                  if (ratingMatch) {
                    rating = parseFloat(ratingMatch[1]).toFixed(1);
                  }
                }
                
                // 그래도 못찾으면 star element의 width로 계산
                if (!rating) {
                  const starElement = ratingContainer.querySelector('[class*="ProductRating_star__"]');
                  if (starElement) {
                    const widthStyle = starElement.getAttribute('style');
                    if (widthStyle) {
                      const widthMatch = widthStyle.match(/width:\s*(\d+(\.\d+)?)/);
                      if (widthMatch) {
                        const widthPercent = parseFloat(widthMatch[1]);
                        rating = (widthPercent / 20).toFixed(1); // 100% = 5점
                      }
                    } else {
                      // style 속성이 없으면 innerText 확인
                      const text = starElement.textContent || starElement.innerText;
                      if (text && !isNaN(text)) {
                        rating = parseFloat(text).toFixed(1);
                      }
                    }
                  }
                }
                
                // 리뷰 수 추출
                const reviewCountElement = ratingContainer.querySelector('[class*="ProductRating_ratingCount__"]');
                if (reviewCountElement) {
                  // (7291) 형식에서 숫자만 추출
                  const reviewText = reviewCountElement.textContent || reviewCountElement.innerText;
                  const reviewMatch = reviewText.match(/\(?\s*(\d+)\s*\)?/);
                  if (reviewMatch) {
                    reviewCount = parseInt(reviewMatch[1]);
                  }
                }
              }
            } catch (e) {
              // 평점 추출 실패 시 무시
            }
            
            return {
              id: i.dataset.id,
              name: i.querySelector('[class*=productName]')?.innerText,
              href: linkElement ? 'https://www.coupang.com' + href : null,
              thumbnail: imgElement ? imgElement.getAttribute('src') : null,
              rank: rank,
              productId: productId,
              itemId: itemId,
              vendorItemId: vendorItemId,
              price: price,
              rating: rating,
              reviewCount: reviewCount,
              realRank: null, // 실제 순위는 외부에서 설정
              page: null // 페이지 번호는 외부에서 설정
            };
          });
        });
        
        // 페이지 번호 및 실제 순위 추가
        pageProducts.forEach((product, index) => {
          product.page = currentPage;
          // realRank 계산: 전체 상품 목록에서의 실제 순서
          product.realRank = allProducts.length + index + 1;
        });
        
        log.log(`페이지 ${currentPage}: ${pageProducts.length}개 상품 추출됨`);
        
        // 1페이지에서만 연관 검색어 추출
        if (currentPage === 1) {
          log.log('연관 검색어 추출 시도 중...');
          try {
            // 연관 검색어 영역이 로드될 때까지 잠시 대기
            await page.waitForTimeout(1000);
            
            // 연관 검색어 추출
            relatedKeywords = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('[class^="srp_relatedKeywords"] a'))
                .map(a => a.textContent.trim())
                .filter(keyword => keyword.length > 0);
            });
            
            if (relatedKeywords.length > 0) {
              log.log(`연관 검색어 ${relatedKeywords.length}개 추출됨: ${relatedKeywords.slice(0, 5).join(', ')}${relatedKeywords.length > 5 ? ' ...' : ''}`);
            } else {
              log.log('연관 검색어를 찾을 수 없음');
            }
          } catch (error) {
            log.warn('연관 검색어 추출 실패:', error.message);
          }
        }
        
        // 전체 상품 목록에 추가
        allProducts = allProducts.concat(pageProducts);
        
        // targetCode가 있으면 해당 제품을 찾았는지 확인
        if (targetCode) {
          const foundProduct = pageProducts.find(product => {
            const codeStr = String(targetCode);
            return String(product.id) === codeStr || 
                   String(product.productId) === codeStr || 
                   String(product.itemId) === codeStr || 
                   String(product.vendorItemId) === codeStr;
          });
          
          if (foundProduct) {
            log.success(`타겟 제품을 찾았습니다: ${foundProduct.name} (페이지 ${currentPage})`);
            log.info(`찾은 제품 ID - id: ${foundProduct.id}, productId: ${foundProduct.productId}, itemId: ${foundProduct.itemId}, vendorItemId: ${foundProduct.vendorItemId}`);
            shouldContinue = false; // 즉시 종료
          }
        }
        
        // 마지막 상품의 순위 확인
        let lastRank = 0;
        if (pageProducts.length > 0) {
          const lastProduct = pageProducts[pageProducts.length - 1];
          if (lastProduct.rank) {
            lastRank = parseInt(lastProduct.rank);
          }
        }
        
        // 종료 조건 체크
        if (limit && allProducts.length >= limit) {
          // limit에 도달하면 필요한 만큼만 잘라내고 종료
          allProducts = allProducts.slice(0, limit);
          shouldContinue = false;
        } else if (pageProducts.length === 0) {
          // 더 이상 상품이 없으면 종료
          log.log(`페이지 ${currentPage}: 더 이상 상품이 없습니다.`);
          shouldContinue = false;
        } else if (!limit && lastRank >= 300) {
          // 순위 300위 이상이면 종료
          log.log(`순위 ${lastRank}위에 도달하여 크롤링을 종료합니다.`);
          shouldContinue = false;
        } else if (pages && currentPage >= pages) {
          // pages 파라미터가 있으면 해당 페이지까지만
          log.log(`지정된 페이지 수(${pages})에 도달했습니다.`);
          shouldContinue = false;
        } else if (!pages && !limit && currentPage >= 4) {
          // pages와 limit이 없으면 기본 4페이지까지만
          log.log(`최대 페이지 수(4)에 도달했습니다.`);
          shouldContinue = false;
        } else {
          // 다음 페이지로
          currentPage++;
          await new Promise(resolve => setTimeout(resolve, 500)); // 페이지 간 대기 단축
        }
      }
      
    } finally {
      // 이벤트 리스너 제거
      page.off('requestfailed', requestFailedHandler);
    }
    
    // 상품이 0개인 경우 차단 가능성 체크
    if (allProducts.length === 0 && currentPage === 1) {
      log.error(`상품이 0개입니다. 쿠팡 차단 가능성이 높습니다.`);
      
      // 페이지 스크린샷 저장 (디버깅용)
      try {
        const screenshotPath = `logs/coupang-blocked-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log.warn(`차단 의심 스크린샷 저장: ${screenshotPath}`);
      } catch (e) {
        log.error(`스크린샷 저장 실패: ${e.message}`);
      }
      
      // 차단 결과 준비
      const blockResult = {
        keyword: keyword,
        count: 0,
        products: [],
        blocked: true,
        blockType: 'NO_PRODUCTS_FOUND',
        message: '상품이 0개입니다. 쿠팡에서 검색을 차단했을 가능성이 높습니다.',
        searchUrl: `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`,
        totalPages: currentPage,
        timestamp: new Date().toISOString()
      };
      
      // 페이지 정리는 비동기로 처리
      cleanupPage().catch(err => log.debug(`Cleanup error (ignored): ${err.message}`));
      
      return blockResult;
    }
    
    log.success(`총 ${allProducts.length}개 상품 추출 완료`);
    log.separator();
    
    // 결과 준비
    const result = {
      keyword: keyword,
      count: allProducts.length,
      products: allProducts,
      relatedKeywords: relatedKeywords,
      totalPages: currentPage,
      searchUrl: `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`,
      timestamp: new Date().toISOString()
    };
    
    // 페이지 정리는 비동기로 처리 (응답 지연 방지)
    cleanupPage().catch(err => log.debug(`Cleanup error (ignored): ${err.message}`));
    
    return result;
  }
};