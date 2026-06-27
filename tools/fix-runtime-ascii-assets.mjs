import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const golden = path.join(root, 'recovery/good-apk-public');
const catalogPath = path.join(golden, 'recommendations/album-catalog.json');
const jsPath = path.join(golden, 'assets/index-1_-kxmKC.js');

function copyFileIfExists(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing asset source: ${from}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const asciiCoverDir = path.join(golden, 'recommendations/album-covers/chinese-ascii');
fs.rmSync(asciiCoverDir, { recursive: true, force: true });
fs.mkdirSync(asciiCoverDir, { recursive: true });

let chineseIndex = 0;
for (const item of catalog) {
  if (item.collection !== 'chinese-rock') continue;
  chineseIndex += 1;
  const originalRelative = decodeURIComponent(item.artworkUrl).replace(/^\//, '');
  const originalPath = path.join(golden, originalRelative);
  const asciiName = `${String(chineseIndex).padStart(4, '0')}.jpg`;
  copyFileIfExists(originalPath, path.join(asciiCoverDir, asciiName));
  item.artworkUrl = `/recommendations/album-covers/chinese-ascii/${asciiName}`;
}
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

const kd = path.join(golden, 'kd');
const kdCopies = [
  ['黑.jpg', 'black.jpg'],
  ['白.png', 'white.png'],
  ['黄.png', 'yellow.png'],
  ['蓝.png', 'blue.png'],
  ['红.jpg', 'red.jpg'],
  ['玛丽莲.png', 'marilyn.png'],
  ['地下 (1) (1) (1).png', 'underground.png'],
];
for (const [from, to] of kdCopies) {
  copyFileIfExists(path.join(kd, from), path.join(kd, to));
}

let js = fs.readFileSync(jsPath, 'utf8');
const jsReplacements = [
  [
    'Mn={fit:`/kd/fit.jpg`,black:`/kd/%E9%BB%91.jpg`,white:`/kd/%E7%99%BD.png`,yellow:`/kd/%E9%BB%84.png`,blue:`/kd/%E8%93%9D.png`,red:`/kd/%E7%BA%A2.jpg`,b:`/kd/B.jpg`}',
    'Mn={fit:`/kd/fit.jpg`,black:`/kd/black.jpg`,white:`/kd/white.png`,yellow:`/kd/yellow.png`,blue:`/kd/blue.png`,red:`/kd/red.jpg`,b:`/kd/B.jpg`}',
  ],
  ['er=`/kd/%E7%8E%9B%E4%B8%BD%E8%8E%B2.png`', 'er=`/kd/marilyn.png`'],
  ['tr=`/kd/%E5%9C%B0%E4%B8%8B%20(1)%20(1)%20(1).png`', 'tr=`/kd/underground.png`'],
];
for (const [from, to] of jsReplacements) {
  if (!js.includes(from)) {
    throw new Error(`Runtime asset path patch target not found: ${from}`);
  }
  js = js.replace(from, to);
}
fs.writeFileSync(jsPath, js);

console.log(`ascii chinese covers: ${chineseIndex}`);
console.log(`ascii kd aliases: ${kdCopies.length}`);
