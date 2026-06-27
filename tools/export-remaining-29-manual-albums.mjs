import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\claude-covers';
const source = JSON.parse(await readFile(path.join(sourceRoot, 'chinese-rock-complete.json'), 'utf8'));
const indexes = JSON.parse(await readFile(path.join(root, 'tools', 'manual-chinese-unverified-indexes.json'), 'utf8'));
const files = await readdir(path.join(sourceRoot, 'chinese-covers', 'covers'));
const special = new Map([
  ['0078果味VC_双重生命.jpg', { sourceIndex: 78, artist: '果味VC', albumTitle: '双重生命' }],
  ['四分卫_世界.jpg', { sourceIndex: 105, artist: '四分卫', albumTitle: '世界' }],
  ['呼吸乐队_呼吸.jpg', { sourceIndex: 95, artist: '呼吸乐队', albumTitle: '呼吸' }],
  ['木马_木马.png', { sourceIndex: 179, artist: '木马', albumTitle: '木马' }],
]);
const byIndex = new Map(source.map((item) => [Number(item.index), item]));
const manual = new Map();
for (const file of files.slice().sort()) {
  const extra = special.get(file);
  if (extra) {
    manual.set(extra.sourceIndex, { file, ...extra });
    continue;
  }
  const match = file.match(/^(\d{4})_(.+?)_(.+)$/);
  if (!match) continue;
  const [, indexText, artist, rawTitle] = match;
  const sourceIndex = Number(indexText);
  const candidate = {
    file,
    sourceIndex,
    artist: artist.trim(),
    albumTitle: rawTitle.replace(/\s+\(2\)(?=\.[^.]+$)/, '').replace(/\.[^.]+$/, '').trim(),
  };
  const existing = manual.get(sourceIndex);
  if (!existing || /\s+\(2\)\.[^.]+$/.test(existing.file)) manual.set(sourceIndex, candidate);
}

const output = indexes.map((sourceIndex) => {
  const current = byIndex.get(Number(sourceIndex));
  const confirmed = manual.get(Number(sourceIndex));
  if (!current || !confirmed) throw new Error(`Missing source or manual cover for index ${sourceIndex}`);
  return {
    sourceIndex: Number(sourceIndex),
    manualCover: confirmed,
    oldRecord: {
      input: { albumName: current.name, artistName: current.artist },
      matchedAlbum: current.matchedAlbum,
      sourceSummary: current.sourceSummary,
      intro: current.intro,
    },
  };
});

const prompt = `你是一名严谨的中文音乐资料编辑。请为随后给出的 29 张中国乐队/音乐人专辑重写资料。\n\n最重要的事实来源是每条的 manualCover：它是人工核对过的封面，manualCover.artist 与 manualCover.albumTitle 必须被视为唯一正确的艺人和专辑名称。oldRecord 是旧资料，可能属于另一张专辑；不得把其中与人工封面冲突的年份、厂牌、曲目、风格、介绍或评价照搬过来。\n\n请联网核查每张专辑。只采用能核对到的公开来源事实；查不到可靠来源时，不要编造，不要猜测，也不要写“待核实”“信息有限”“可能是”“无法确认”等话。此类条目请把 verified 设为 false，并把其余字段留为最小、空白的安全值。\n\n输出严格 JSON 数组，条数和输入一致。每项格式：\n{\n  "sourceIndex": 1,\n  "verified": true,\n  "matchedAlbum": {"albumTitle":"","artist":"","releaseDate":"","releaseYear":null,"genres":[],"styles":[],"label":"","trackCount":null,"notableTracks":[]},\n  "sourceSummary": {"basicFacts":"","soundCharacteristics":[],"artistContext":"","receptionContext":"","conflictsOrUncertainty":""},\n  "intro": {"introTitle":"","shortIntro":"","fullIntro":"","listeningMoment":"","whyKeep":"","keywords":[]}\n}\n\n规则：\n1. verified=true 时，专辑名和艺人必须逐字使用 manualCover。\n2. genres、styles、keywords 必须全为中文。\n3. fullIntro 写 2-3 段自然中文，不要 Markdown，不要鸡汤，不要无依据的评价。\n4. verified=false 时只保留 manualCover 确认的 albumTitle、artist；其余资料字段留空数组、空字符串或 null。\n5. 不要输出解释、代码块或任何 JSON 以外内容。\n`;

const outputPath = path.join(sourceRoot, 'remaining_29_manual_cover_research.json');
const promptPath = path.join(sourceRoot, 'remaining_29_manual_cover_research_prompt.md');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
await writeFile(promptPath, prompt, 'utf8');
console.log(JSON.stringify({ count: output.length, outputPath, promptPath }));
