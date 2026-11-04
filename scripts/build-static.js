import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {publicFiles} from '../static-files.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'dist');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of publicFiles){const target=resolve(output,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,file),target)}
await writeFile(resolve(output,'.nojekyll'),'');
console.log(`Exported ${publicFiles.length+1} allowlisted static files, including local OCR.`);
