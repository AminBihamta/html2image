const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const files = { '/': 'index.html', '/app.js': 'public/app.js', '/privacy.html': 'privacy.html', '/robots.txt': 'public/robots.txt', '/sitemap.xml': 'public/sitemap.xml' };
  const file = files[pathname];
  if (!file || req.method !== 'GET') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  try {
    const body = await readFile(path.join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('Could not load the app.');
  }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`HTML to JPG is ready at http://127.0.0.1:${process.env.PORT || 4173}`));
