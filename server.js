const http = require('http');
const { getJson } = require("serpapi");

const hostname = '127.0.0.1';
const port = 3000;
const API_KEY = "f2efc29d66dbbcd2d7dc616e6811a60176ccdb17a84b0585fa605a02935ce497";

const server = http.createServer(async (req, res) => {
  if (req.method === "POST") {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const imageUrl = parsed.imageUrl;

        if (!imageUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
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
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*'); // avoid CORS issues
        res.end(JSON.stringify(response));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === "OPTIONS") {
    // Preflight CORS request
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
