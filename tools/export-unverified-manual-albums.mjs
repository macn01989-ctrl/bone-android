import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\claude-covers\\chinese-rock-complete.json';
const indexesPath = path.join(root, 'tools', 'manual-chinese-unverified-indexes.json');
const outputPath = path.join(root, 'tools', 'four-unverified-manual-cover-albums.json');
const promptPath = path.join(root, 'tools', 'four-unverified-manual-cover-albums-prompt.md');

const [source, indexes] = await Promise.all([
  readFile(sourcePath, 'utf8').then(JSON.parse),
  readFile(indexesPath, 'utf8').then(JSON.parse),
]);
const records = indexes.map((index) => source.find((item) => Number(item.index) === Number(index))).filter(Boolean);

const prompt = `你是一名严谨的中国独立音乐资料核查员。请逐条核实以下 4 条记录中“人工确认的封面、艺人、专辑名”是否真实对应。必须优先查找可靠的一手或主流资料（乐队官方、厂牌、豆瓣音乐、网易云音乐、QQ 音乐、Discogs 等）；不能凭封面风格或原有介绍猜测。\n\n若确认真实对应：输出完整的自然中文专辑资料，修订 intro、matchedAlbum、sourceSummary，并写明可核验来源链接。\n若不能确认或确认不对应：明确标记 verified:false，说明原因，不要编造。\n\n严格只输出 JSON 数组。每项保留 index、name、artist、coverPath，新增 verified、evidenceUrls、matchedAlbum、sourceSummary、intro。所有除专名外的说明使用自然中文。`;

await Promise.all([
  writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8'),
  writeFile(promptPath, `${prompt}\n`, 'utf8'),
]);
console.log(JSON.stringify({ count: records.length, outputPath, promptPath }));
