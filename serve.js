const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const dir = process.argv[2] || '.';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

const SPA_EXTS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.txt', '.xml', '.json'];

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  let file = url === '/' ? 'index.html' : url.slice(1);
  const ext = path.extname(file);

  // Serve static assets directly — no SPA fallback for non-HTML
  if (ext && ext !== '.html') {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // HTML routes — SPA fallback to index.html
  const filePath = path.join(dir, file);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  } catch {
    try {
      const content = fs.readFileSync(path.join(dir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}).listen(port);
