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
console.log(`Static demo exported to dist/ (${files.length + 1} files, including local fonts and vehicle illustrations).`);
