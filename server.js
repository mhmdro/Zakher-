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
  'assets/brands/nissan.svg',
  'assets/brands/toyota.svg',
  'assets/brands/bmw.svg',
  'assets/brands/honda.svg',
  'assets/brands/hyundai.svg',
  'assets/brands/kia.svg',
  'assets/brands/audi.svg',
  'assets/brands/volkswagen.svg',
  'assets/brands/ford.svg',
  'assets/brands/chevrolet.svg',
  'assets/brands/mitsubishi.svg',
  'assets/brands/mazda.svg',
  'assets/brands/suzuki.svg',
  'assets/brands/subaru.svg',
  'assets/brands/renault.svg',
  'assets/brands/peugeot.svg',
  'assets/brands/porsche.svg',
  'assets/brands/tesla.svg',
  'assets/brands/volvo.svg',
  'assets/brands/jeep.svg',
  'assets/brands/infiniti.svg',
  'assets/brands/cadillac.svg',
  'assets/brands/bentley.svg',
  'assets/brands/mini.svg',
  'assets/brands/skoda.svg',
  'assets/brands/rollsroyce.svg',
  'assets/brands/mercedes.svg',
  'assets/brands/landrover.svg',
  'assets/brands/LICENSE.md',
  'assets/brands/README.md',
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
