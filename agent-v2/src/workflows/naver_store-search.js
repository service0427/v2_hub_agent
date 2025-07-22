const winston = require('winston');

// Naver Store search workflow
module.exports = {
  async execute(page, params) {
    const { keyword, pages = 1, limit = 100 } = params;
    const results = [];
    
    try {
      winston.info(`Starting Naver Store search for keyword: ${keyword}`);
      
      // Navigate to Naver Shopping
      const searchUrl = `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      // Wait for results
      await page.waitForSelector('[class*="item_"], [class*="product_"]', { timeout: 10000 });
      
      // Extract products from each page
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        winston.info(`Extracting page ${pageNum}`);
        
        // Extract product data
        const products = await page.evaluate(() => {
          const items = [];
          const productElements = document.querySelectorAll('[class*="item_"], [class*="product_"]');
          
          productElements.forEach((el, index) => {
            try {
              const link = el.querySelector('a[class*="link_"], a[class*="product_link_"]');
              const title = el.querySelector('[class*="title_"], [class*="name_"]')?.textContent?.trim();
              const priceEl = el.querySelector('[class*="price_num_"], [class*="price_value_"]');
              const price = priceEl?.textContent?.trim();
              const store = el.querySelector('[class*="store_"], [class*="mall_"]')?.textContent?.trim();
              const reviewCount = el.querySelector('[class*="review_"], [class*="count_"]')?.textContent?.trim();
              
              if (link && title) {
                items.push({
                  title,
                  price: price ? parseInt(price.replace(/[^0-9]/g, '')) : null,
                  store,
                  reviewCount: reviewCount ? parseInt(reviewCount.replace(/[^0-9]/g, '')) : 0,
                  url: link.href,
                  productId: link.href.match(/products\/(\d+)/)?.[1] || null,
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
          const nextButton = await page.$('a[class*="next_"], button[class*="next_"]');
          if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000);
            await page.waitForSelector('[class*="item_"], [class*="product_"]', { timeout: 10000 });
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
      winston.error('Naver Store search failed:', error);
      
      return {
        success: false,
        error: error.message,
        keyword,
        timestamp: new Date().toISOString()
      };
    }
  }
};