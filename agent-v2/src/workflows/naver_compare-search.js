const winston = require('winston');

// Naver Compare (price comparison) search workflow
module.exports = {
  async execute(page, params) {
    const { keyword, pages = 1, limit = 100 } = params;
    const results = [];
    
    try {
      winston.info(`Starting Naver Compare search for keyword: ${keyword}`);
      
      // Navigate to Naver Shopping price comparison
      const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      // Wait for results
      await page.waitForSelector('[class*="basicList_"], [class*="product_"]', { timeout: 10000 });
      
      // Extract products from each page
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        winston.info(`Extracting page ${pageNum}`);
        
        // Extract product data
        const products = await page.evaluate(() => {
          const items = [];
          const productElements = document.querySelectorAll('[class*="basicList_item_"], [class*="product_item_"]');
          
          productElements.forEach((el, index) => {
            try {
              const link = el.querySelector('a[class*="link_"], a[class*="basicList_link_"]');
              const title = el.querySelector('[class*="title_"], [class*="basicList_title_"]')?.textContent?.trim();
              const priceEl = el.querySelector('[class*="price_num_"], [class*="basicList_price_"]');
              const price = priceEl?.textContent?.trim();
              const category = el.querySelector('[class*="category_"], [class*="basicList_category_"]')?.textContent?.trim();
              const compareCount = el.querySelector('[class*="mall_count_"], [class*="basicList_mall_count_"]')?.textContent?.trim();
              
              if (link && title) {
                items.push({
                  title,
                  price: price ? parseInt(price.replace(/[^0-9]/g, '')) : null,
                  category,
                  compareCount: compareCount ? parseInt(compareCount.replace(/[^0-9]/g, '')) : 0,
                  url: link.href,
                  productId: link.href.match(/nvMid=(\d+)/)?.[1] || null,
                  rank: items.length + 1
                });
              }
            } catch (err) {
              console.error('Error extracting product:', err);
            }
          });
          
          return items;
        });
        
        results.push(...products);
        
        // Check if we've reached the limit
        if (results.length >= limit) {
          results.splice(limit);
          break;
        }
        
        // Go to next page if needed
        if (pageNum < pages) {
          const nextButton = await page.$('a[class*="pagination_next_"], button[class*="paginator_next_"]');
          if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000);
            await page.waitForSelector('[class*="basicList_"], [class*="product_"]', { timeout: 10000 });
          } else {
            winston.warn('No more pages available');
            break;
          }
        }
      }
      
      winston.info(`Extracted ${results.length} products`);
      
      return {
        success: true,
        keyword,
        totalProducts: results.length,
        products: results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      winston.error('Naver Compare search failed:', error);
      
      return {
        success: false,
        error: error.message,
        keyword,
        timestamp: new Date().toISOString()
      };
    }
  }
};