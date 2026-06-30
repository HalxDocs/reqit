const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const dir = path.join(__dirname, 'flux', 'frontend', 'dist-web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  let file = url === '/' ? 'index.html' : url.slice(1);
  file = path.join(dir, file);

  try {
    const content = fs.readFileSync(file);
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    // SPA fallback — return index.html for any path
    try {
      const content = fs.readFileSync(path.join(dir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`reqit serving on http://0.0.0.0:${port}`);
});
