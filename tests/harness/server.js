// Minimal static file server for the repo root, so the tests do not depend on
// any globally installed web server or a fixed port being free.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

let server = null;
let origin = null;

function start() {
  if (origin) return Promise.resolve(origin);

  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    // Never serve outside the repo.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, body) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(body);
    });
  });

  return new Promise((resolve) => {
    // Port 0 = let the OS pick a free one.
    server.listen(0, '127.0.0.1', () => {
      // Do not let a listening socket keep the process alive: without this the
      // test finishes, prints its result, and then hangs forever.
      server.unref();
      origin = `http://127.0.0.1:${server.address().port}`;
      resolve(origin);
    });
  });
}

function stop() {
  if (server) {
    server.close();
    server = null;
    origin = null;
  }
}

module.exports = { start, stop, ROOT };
