// Serves the reference prototype. Usage: node kit/reference/night-rig/serve.mjs [port]
// The page imports three and gsap from a CDN. This server rewrites those imports to the
// repository's own node_modules when they exist, so the prototype runs offline after npm install.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = path.resolve(here, '../../../node_modules');
const local = fs.existsSync(path.join(modules, 'three/build/three.module.js')) && fs.existsSync(path.join(modules, 'gsap/index.js'));
const port = Number(process.argv[2]) || 5319;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const base = p.startsWith('/node_modules/') ? modules : here;
  const file = path.join(base, p.startsWith('/node_modules/') ? p.slice('/node_modules/'.length) : p);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  const head = { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (file.endsWith('.html') && local) {
    res.writeHead(200, head);
    res.end(fs.readFileSync(file, 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.187.0/', '/node_modules/three/').replaceAll('https://cdn.jsdelivr.net/npm/gsap@3.15.1/', '/node_modules/gsap/'));
    return;
  }
  res.writeHead(200, head);
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`reference prototype on http://127.0.0.1:${port}/index.html · ${local ? 'local modules' : 'cdn modules'}`));
