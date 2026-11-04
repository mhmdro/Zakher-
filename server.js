import http from 'node:http';
import { readFile } from 'node:fs/promises';

const allowedFiles = [
  'app.js', 'style.css', 'domain.js', 'vehicle-art.js',
  'assets/fonts/tajawal-arabic-400-normal.woff2',
  'assets/fonts/tajawal-arabic-500-normal.woff2',
  'assets/fonts/tajawal-arabic-700-normal.woff2',
  'assets/fonts/tajawal-latin-400-normal.woff2',
  'assets/fonts/tajawal-latin-500-normal.woff2',
  'assets/fonts/tajawal-latin-700-normal.woff2',
  'assets/vehicles/generic.svg',
  'assets/vehicles/pickup.svg',
  'assets/vehicles/sedan-altima.svg',
  'assets/vehicles/sedan-camry.svg',
  'assets/vehicles/sedan-compact.svg',
  'assets/vehicles/sedan-luxury.svg',
  'assets/vehicles/sedan-sport.svg',
  'assets/vehicles/suv-crossover.svg',
  'assets/vehicles/suv-large.svg',
  'assets/fonts/OFL.txt',
  'assets/fonts/README.md',
];
const files = Object.fromEntries([
  ['/', 'index.html'],
  ...allowedFiles.map(file => [`/${file}`, file]),
]);
const types = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
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
