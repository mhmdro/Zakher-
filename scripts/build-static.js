import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const files = [
  'index.html', 'app.js', 'domain.js', 'vehicle-art.js', 'style.css',
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

// Only this dedicated build output is cleared; repository files stay intact.
// Copy an explicit allowlist so unrelated assets and customer data stay private.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}
await writeFile(resolve(output, '.nojekyll'), '');
console.log(`Static demo exported to dist/ (${files.length + 1} files, including local fonts and manufacturer logos).`);
