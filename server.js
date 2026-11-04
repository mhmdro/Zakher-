import http from 'node:http';
import { readFile } from 'node:fs/promises';
import {publicFiles} from './static-files.js';

const files=Object.fromEntries([['/','index.html'],...publicFiles.map(file=>['/'+file,file])]);
const types = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  gz: 'application/gzip',
  json: 'application/json',
};

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = Object.hasOwn(files, pathname) ? files[pathname] : null;
  if (!file) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    res.setHeader('Content-Type', types[file.split('.').pop()]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(await readFile(new URL(file, import.meta.url)));
  } catch {
    res.writeHead(500).end('Server error');
  }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('Zakher running on port ' + (process.env.PORT || 3000));
});
