import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const files = ['index.html', 'app.js', 'domain.js', 'style.css'];

// Only this dedicated build output is cleared; repository files stay intact.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) {
  await copyFile(resolve(root, file), resolve(output, file));
}
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Static demo exported to dist/ (5 files).');
