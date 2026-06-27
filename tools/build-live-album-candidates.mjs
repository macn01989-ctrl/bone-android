import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\a.json';
const catalogPath = path.join(root, 'public', 'recommendations', 'album-catalog.json');
const outputPath = path.join(root, 'public', 'recommendations', 'album-live-candidates.json');

const excludedArtists = new Set([
  '周迅', '周深', '猪头皮', '周笔畅', '周华健', '张学友', '张国荣', '张惠妹', '张靓颖', '伊能静',
  '小老虎', '王力宏', '田馥甄', '谭晶', '尚雯婕', '任贤齐', '群星', '齐秦', '卢冠廷', '刘雨昕',
  '刘德华', '刘欢', '林俊杰', '梁静茹', '李小龙', '李荣浩', '李健', '郭富城', '范玮琪', '范晓萱',
  '蔡依林', '蔡健雅', '五月天', '飞儿乐团', '飞儿', 'F.I.R',
]);

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/[\s\-—–'’“”《》()（）.,，。:：!！?？]/g, '');
}

const [raw, localCatalog] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(catalogPath, 'utf8').then(JSON.parse),
]);
const localIdentities = new Set(localCatalog.map((item) => normalize(`${item.albumArtist}|${item.albumTitle}`)));
const unique = new Map();
for (const line of raw.split(/\r?\n/)) {
  const text = line.trim();
  if (!text) continue;
  let item;
  try { item = JSON.parse(text); } catch { continue; }
  const artist = String(item.artist ?? '').trim();
  const name = String(item.name ?? '').trim();
  if (!artist || !name || excludedArtists.has(artist) || /五月天|飞儿|飛兒|F\.?I\.?R/i.test(artist) || name === '西北风') continue;
  if (localIdentities.has(normalize(`${artist}|${name}`))) continue;
  const id = String(item._id ?? item.id ?? `${artist}-${name}`);
  unique.set(normalize(`${artist}|${name}`), { id, artist, name });
}
const candidates = [...unique.values()];
await writeFile(outputPath, `${JSON.stringify(candidates)}\n`, 'utf8');
console.log(JSON.stringify({ sourceLines: raw.split(/\r?\n/).filter(Boolean).length, candidates: candidates.length, outputPath }));
