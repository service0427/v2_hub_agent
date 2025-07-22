const logger = require('winston');

// Coupang search workflow
module.exports = {
  async execute(page, params) {
    const { keyword, pages = 1, limit = 100 } = params;
    const results = [];
    
    try {
      logger.info(`Starting Coupang search for keyword: ${keyword}`);
      
      // Navigate to Coupang
      await page.goto('https://www.coupang.com', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      // Search for keyword
      await page.fill('input[name="q"]', keyword);
      await page.press('input[name="q"]', 'Enter');
      
      // Wait for results
      await page.waitForSelector('.search-product', { timeout: 10000 });
      
      // Extract products from each page
      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        logger.info(`Extracting page ${pageNum}`);
        
        // Extract product data
        const products = await page.evaluate(() => {
          const items = [];
          const productElements = document.querySelectorAll('.search-product');
          
          productElements.forEach((el) => {
            try {
              const link = el.querySelector('a.search-product-link');
              const title = el.querySelector('.name')?.textContent?.trim();
              const price = el.querySelector('.price-value')?.textContent?.trim();
              const rating = el.querySelector('.rating')?.textContent?.trim();
              const reviewCount = el.querySelector('.rating-total-count')?.textContent?.trim();
              const delivery = el.querySelector('.badge-rocket')?.textContent?.trim();
              
              if (link && title) {
                items.push({
                  title,
                  price: price ? parseInt(price.replace(/[^0-9]/g, '')) : null,
                  rating: rating ? parseFloat(rating) : null,
                  reviewCount: reviewCount ? parseInt(reviewCount.replace(/[^0-9]/g, '')) : 0,
                  url: link.href,
                  productId: link.href.match(/products\/(\d+)/)?.[1] || null,
                  delivery,
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
          const nextButton = await page.$('a.next-page');
          if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000);
            await page.waitForSelector('.search-product', { timeout: 10000 });
          } else {
            logger.warn('No more pages available');
            break;
          }
        }
      }
      
      logger.info(`Extracted ${results.length} products`);
      
      return {
        success: true,
        keyword,
        totalProducts: results.length,
        products: results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Coupang search failed:', error);
      
      return {
        success: false,
        error: error.message,
        keyword,
        timestamp: new Date().toISOString()
      };
    }
  }
};