import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const runtimePath = resolve(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');

let code = readFileSync(runtimePath, 'utf8');

const oldText = 'children:p.albumIntro||`暂无介绍`';
const newText =
  'children:(p.detail?.fullIntro?`${p.detail.shortIntro?`${p.detail.shortIntro}\\n\\n`:``}${p.detail.fullIntro}${p.detail.whyKeep?`\\n\\n${p.detail.whyKeep}`:``}`:p.albumIntro)||`暂无介绍`';

if (!code.includes(newText)) {
  if (!code.includes(oldText)) {
    throw new Error('favorites album popup intro render target not found');
  }
  code = code.replace(oldText, newText);
}

writeFileSync(runtimePath, code, 'utf8');
console.log('patched favorites album popup to show full intro first');
