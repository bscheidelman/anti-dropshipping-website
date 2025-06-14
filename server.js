const http = require('http');
const { getJson } = require("serpapi");
const puppeteer = require('puppeteer');

const hostname = '127.0.0.1';
const port = 3000;
const API_KEY = "f2efc29d66dbbcd2d7dc616e6811a60176ccdb17a84b0585fa605a02935ce497";

const server = http.createServer(async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === "OPTIONS") {
    // Preflight CORS request
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "POST") {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        
        if (req.url === '/scrape-price') {
          // Handle price scraping request
          const { url } = parsed;
          if (!url) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing url" }));
            return;
          }

          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          
          const price = await page.evaluate(() => {
            const priceElement = document.querySelector('.a-price .a-offscreen') || 
                                document.querySelector('#priceblock_ourprice') ||
                                document.querySelector('#priceblock_dealprice');
            return priceElement ? priceElement.textContent.trim() : null;
          });
          
          await browser.close();
          res.statusCode = 200;
          res.end(JSON.stringify({ price }));
          return;
        } else {
          // Handle reverse image search request
          const imageUrl = parsed.imageUrl;
          if (!imageUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing imageUrl" }));
            return;
          }

          const response = await getJson({
            engine: "google_reverse_image",
            api_key: API_KEY,
            google_domain: "google.com",
            image_url: imageUrl
          });

          res.statusCode = 200;
          res.end(JSON.stringify(response));
        }
      } catch (error) {
        console.error("Error:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
