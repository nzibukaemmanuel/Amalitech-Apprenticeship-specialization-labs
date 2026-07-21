// Zero-dependency static file server. Its only job is to serve this project's
// own files over http:// so the browser can load web/app.js as a real ES
// module and follow its relative imports into src/ — opening index.html
// directly via file:// blocks module imports under CORS rules.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function resolveRequestedPath(url) {
  const decoded = decodeURIComponent(url.split('?')[0]);
  const resolved = path.resolve(ROOT, `.${decoded}`);
  const withinRoot = resolved === ROOT || resolved.startsWith(ROOT + path.sep);
  return withinRoot ? resolved : null;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(302, { Location: '/web/index.html' });
    res.end();
    return;
  }

  const filePath = resolveRequestedPath(req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${req.url}`);
  }
});

server.listen(PORT, () => {
  console.log(`Web interface running at http://localhost:${PORT}`);
});
