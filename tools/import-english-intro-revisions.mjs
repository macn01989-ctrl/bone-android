import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\claude-covers\\complete_473_albums.zh.json';
const revisionsPath = 'C:\\Users\\Lenovo\\WorkBuddy\\2026-06-23-16-31-37\\english-intro-revised.json';
const chineseOverridesPath = path.join(root, 'tools', 'chinese-album-overrides.json');

const [albums, revisions, chineseOverrides] = await Promise.all([
  readFile(sourcePath, 'utf8').then(JSON.parse),
  readFile(revisionsPath, 'utf8').then(JSON.parse),
  readFile(chineseOverridesPath, 'utf8').then(JSON.parse),
]);

let rollingStoneCount = 0;
let chineseCount = 0;
for (const revision of revisions) {
  if (revision.sourceType === 'rolling-stone') {
    const index = Number(revision.index);
    const existing = albums[index];
    if (!existing || existing.input?.albumName !== revision.input?.albumName || existing.input?.artistName !== revision.input?.artistName) {
      throw new Error(`Rolling Stone identity mismatch at index ${revision.index}.`);
    }
    albums[index] = {
      ...existing,
      matchedAlbum: revision.matchedAlbum,
      sourceSummary: revision.sourceSummary,
      intro: revision.intro,
    };
    rollingStoneCount += 1;
    continue;
  }

  if (revision.sourceType === 'chinese-manual-cover') {
    const index = String(revision.sourceIndex);
    const existing = chineseOverrides[index];
    if (!existing || existing.matchedAlbum?.albumTitle !== revision.input?.albumName || existing.matchedAlbum?.artist !== revision.input?.artistName) {
      throw new Error(`Chinese manual identity mismatch at source index ${revision.sourceIndex}.`);
    }
    chineseOverrides[index] = {
      ...existing,
      matchedAlbum: revision.matchedAlbum,
      sourceSummary: revision.sourceSummary,
      intro: revision.intro,
    };
    chineseCount += 1;
    continue;
  }

  throw new Error(`Unsupported revision sourceType: ${revision.sourceType}`);
}

if (rollingStoneCount !== 39 || chineseCount !== 2) {
  throw new Error(`Expected 39 Rolling Stone and 2 Chinese revisions, got ${rollingStoneCount}/${chineseCount}.`);
}

await Promise.all([
  writeFile(sourcePath, `${JSON.stringify(albums, null, 2)}\n`, 'utf8'),
  writeFile(chineseOverridesPath, `${JSON.stringify(chineseOverrides, null, 2)}\n`, 'utf8'),
]);
console.log(JSON.stringify({ rollingStoneCount, chineseCount }));
