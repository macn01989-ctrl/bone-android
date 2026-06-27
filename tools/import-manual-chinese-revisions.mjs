import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = 'C:\\Users\\Lenovo\\WorkBuddy\\2026-06-23-16-31-37\\remaining_29_revised.json';
const outputPath = path.join(root, 'tools', 'manual-chinese-reviewed-revisions.json');
const unresolvedPath = path.join(root, 'tools', 'manual-chinese-unverified-indexes.json');

const input = JSON.parse(await readFile(inputPath, 'utf8'));
const verified = {};
const unresolved = [];
for (const item of input) {
  if (item.verified === true) {
    verified[String(item.sourceIndex)] = {
      matchedAlbum: item.matchedAlbum,
      sourceSummary: item.sourceSummary,
      intro: item.intro,
    };
  } else {
    unresolved.push(Number(item.sourceIndex));
  }
}
await writeFile(outputPath, `${JSON.stringify(verified, null, 2)}\n`, 'utf8');
await writeFile(unresolvedPath, `${JSON.stringify(unresolved, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ imported: Object.keys(verified).length, unresolved: unresolved.length }));
