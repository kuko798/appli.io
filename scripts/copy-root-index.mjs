import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist', 'src', 'home', 'index.html');
const dest = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(src)) {
    console.error('copy-root-index: missing', src, '— run vite build first');
    process.exit(1);
}
fs.copyFileSync(src, dest);
console.log('copy-root-index: dist/src/home/index.html → dist/index.html');
