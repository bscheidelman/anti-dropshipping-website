const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class PriceScraper {
  constructor(proxies = []) {
    // Site-specific parsers registry
    this.parserRegistry = {
      'amazon.com': this.parseAmazon,
      'walmart.com': this.parseWalmart,
      'etsy.com': this.parseEtsy,
      'alibaba.com': this.parseAlibaba,
      'dhgate.com': this.parseDHGate,
      'wish.com': this.parseWish,
    };

    // Configuration
    this.config = {
      requestTimeout: 15000,
      retries: 3,
      retryDelay: 2000,
      rateLimitDelay: 1000,
      userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1'
      ]
    };

    // State management
    this.cookieJar = {};
    this.proxyList = proxies;
    this.currentProxyIndex = 0;
    this.lastRequestTime = 0;

    // Configure HTTP client
    this.httpClient = axios.create({
      timeout: this.config.requestTimeout,
      validateStatus: (status) => status < 500
    });
  }

  async getPrice(url) {
    await this.enforceRateLimit();
    try {
      const domain = this.getDomain(url);
      const html = await this.fetchPageWithRetry(url);
      const $ = cheerio.load(html);
      
      const parser = this.parserRegistry[domain] || this.genericPriceParser;
      const price = parser($);
      
      return this.normalizePrice(price);
    } catch (error) {
      console.error(`Scraping failed for ${url}: ${error.message}`);
      return null;
    }
  }

  // --- Core functionality ---
  async fetchPageWithRetry(url, retries = this.config.retries) {
    try {
      const domain = this.getDomain(url);
      const headers = this.getHeaders(domain);
      const proxy = this.getNextProxy();

      const response = await this.httpClient.get(url, {
        headers,
        proxy,
        validateStatus: null // Allow all status codes for custom handling
      });

      this.handleCookies(domain, response);
      
      if (response.status === 412) {
        throw new Error('Blocked by site security (412)');
      }

      if (response.status >= 400) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      return response.data;
    } catch (error) {
      if (retries > 0) {
        await this.delay(this.config.retryDelay * (this.config.retries - retries + 1));
        return this.fetchPageWithRetry(url, retries - 1);
      }
      throw error;
    }
  }

  // --- Helpers ---
  getDomain(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      return hostname.split('.').slice(-2).join('.');
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  getHeaders(domain) {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': `https://www.${domain}/`,
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      ...(this.cookieJar[domain] ? { 'Cookie': this.cookieJar[domain] } : {})
    };
  }

  handleCookies(domain, response) {
    if (response.headers['set-cookie']) {
      this.cookieJar[domain] = response.headers['set-cookie']
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    }
  }

  getNextProxy() {
    if (this.proxyList.length === 0) return null;
    const proxy = this.proxyList[this.currentProxyIndex % this.proxyList.length];
    this.currentProxyIndex++;
    return { protocol: 'http', host: proxy };
  }

  getRandomUserAgent() {
    return this.config.userAgents[
      Math.floor(Math.random() * this.config.userAgents.length)
    ];
  }

  async enforceRateLimit() {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.config.rateLimitDelay) {
      await this.delay(this.config.rateLimitDelay - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Price Parsers ---
  parseAmazon($) {
    const selectors = [
      '#corePrice_desktop .a-price-whole',
      'span.a-price-whole',
      'span.a-offscreen'
    ];
    return this.findFirstValidPrice($, selectors);
  }

  parseWalmart($) {
    const selectors = [
      'span[itemprop="price"]',
      '[data-testid="product-price"]',
      '[data-automation-id="product-price"]',
      'span.price-characteristic',
      'div.price-display'
    ];
    return this.findFirstValidPrice($, selectors);
  }

  parseEtsy($) {
    const selectors = [
      '[data-selector="price-text"]',
      '.wt-text-title-03.lb-price',
      '.currency-value'
    ];
    return this.findFirstValidPrice($, selectors);
  }

  // ... Add other site-specific parsers following same pattern

  genericPriceParser($) {
    const priceElements = $('*')
      .contents()
      .filter((_, el) => 
        el.type === 'text' && 
        /(\$|€|£|¥)\s?\d+[\d,.]*/.test($(el).text())
      )
      .map((_, el) => $(el).text().trim())
      .get();
  
    return this.findMostProbablePrice(priceElements);
  }

  // --- Parser Helpers ---
  findFirstValidPrice($, selectors) {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        return element.attr('content') || 
               element.attr('aria-label') || 
               element.text();
      }
    }
    return null;
  }

  findMostProbablePrice(candidates) {
    if (candidates.length === 0) return null;
    
    // Score candidates based on various factors
    const scored = candidates.map(text => ({
      text,
      score: this.calculatePriceConfidence(text)
    }));

    // Return highest scored candidate
    return scored.sort((a, b) => b.score - a.score)[0].text;
  }

  calculatePriceConfidence(text) {
    let score = 0;
    
    // Check for currency symbol
    if (/[\$\€\£\¥]/.test(text)) score += 30;
    
    // Check for decimal format
    if (/\d+\.\d{2}/.test(text)) score += 20;
    
    // Check for typical price length
    const clean = text.replace(/[^\d]/g, '');
    if (clean.length >= 2 && clean.length <= 6) score += 10;
    
    return score;
  }

  // --- Price Normalization ---
  normalizePrice(priceStr) {
    if (!priceStr) return null;
    
    // Extract numerical parts
    const clean = priceStr.replace(/[^\d.,]/g, '');
    
    // Handle different decimal formats
    const parts = clean.split(/[.,]/);
    if (parts.length === 1) return parseFloat(clean);
    
    if (parts.length === 2) {
      return parseFloat(`${parts[0]}.${parts[1]}`);
    }
    
    // Handle thousand separators
    if (parts.length > 2) {
      const main = parts.slice(0, -1).join('');
      const decimals = parts[parts.length - 1];
      return parseFloat(`${main}.${decimals}`);
    }
    
    return parseFloat(clean.replace(/[.,]/g, ''));
  }
}

module.exports = PriceScraper;