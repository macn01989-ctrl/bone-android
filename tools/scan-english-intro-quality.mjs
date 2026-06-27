import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\claude-covers\\complete_473_albums.zh.json';
const outputPath = path.join(root, 'tools', 'english-intro-quality-candidates.json');
const promptPath = path.join(root, 'tools', 'english-intro-quality-prompt.md');
const manualRulingsPath = path.join(root, 'tools', 'manual-chinese-cover-rulings.json');
const chineseOverridesPath = path.join(root, 'tools', 'chinese-album-overrides.json');

function englishTokens(text) {
  return (String(text).match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? []);
}

function knownTokens(item) {
  return new Set(englishTokens([
    item.input?.albumName,
    item.input?.artistName,
    item.matchedAlbum?.albumTitle,
    item.matchedAlbum?.artist,
    ...(item.matchedAlbum?.notableTracks ?? []),
  ].join(' ')).map((token) => token.toLowerCase()));
}

function reasons(item) {
  const text = [
    item.sourceSummary?.basicFacts,
    ...(item.sourceSummary?.soundCharacteristics ?? []),
    item.sourceSummary?.artistContext,
    item.sourceSummary?.receptionContext,
    item.intro?.introTitle,
    item.intro?.shortIntro,
    item.intro?.fullIntro,
    item.intro?.listeningMoment,
    item.intro?.whyKeep,
  ].join('\n');
  const flags = [];
  if (/�/.test(text)) flags.push('存在乱码替换字符');
  if (/[。！？]{2,}|\.{3,}/.test(text)) flags.push('异常连续标点');
  const compact = text.replace(/\s+/g, '');
  if (/(值得反复聆听){2,}/.test(compact)) flags.push('疑似重复句子');
  return flags;
}

const [source, manualRulings, chineseOverrides] = await Promise.all([
  readFile(sourcePath, 'utf8').then(JSON.parse),
  readFile(manualRulingsPath, 'utf8').then(JSON.parse),
  readFile(chineseOverridesPath, 'utf8').then(JSON.parse),
]);
// 438–472 是同一批未完成中文化的连续数据：不是英文专名，而是整段编辑草稿残留。
// 另外也收录任何明确乱码或连续标点异常的记录。
const englishCandidates = source.map((item, index) => ({ index, item, reasons: reasons(item) }))
  .filter((entry) => entry.index >= 438 || entry.reasons.length > 0)
  .map(({ index, item, reasons: flags }) => ({
    sourceType: 'rolling-stone',
    index,
    input: item.input,
    matchedAlbum: item.matchedAlbum,
    sourceSummary: item.sourceSummary,
    intro: item.intro,
    qualityFlags: flags,
  }));
const manualCandidates = manualRulings
  .filter((ruling) => ruling.action === 'correct_identity')
  .map((ruling) => {
    const revision = chineseOverrides[String(ruling.sourceIndex)];
    return {
      sourceType: 'chinese-manual-cover',
      sourceIndex: ruling.sourceIndex,
      coverFile: ruling.coverFile,
      input: { albumName: ruling.albumTitle, artistName: ruling.artist },
      matchedAlbum: revision.matchedAlbum,
      sourceSummary: revision.sourceSummary,
      intro: revision.intro,
      qualityFlags: ['人工确认了封面、艺人和专辑名；现有介绍为安全占位，需以可靠来源补全'],
    };
  });
const candidates = [...englishCandidates, ...manualCandidates];
const prompt = `你是一名严谨的中文音乐编辑与音乐资料核查员。请修订随后给出的专辑资料。\n\nsourceType 为 rolling-stone 的条目：已被质量扫描标记为可能有乱码、英文句子残留、异常标点、重复句或不自然的中英混杂。不得改变 input 中的专辑名和艺人名；不得编造任何新事实。\n\nsourceType 为 chinese-manual-cover 的条目：人工已确认封面、艺人和专辑名，绝对不得改动这三项；当前介绍只是安全占位，需要查阅可靠来源后补全。若没有可靠资料，保留事实空白，不要猜测。\n\n艺人名、专辑名、曲名、厂牌名等专名可保留原文；除专名外，所有说明必须是自然中文。请只输出严格 JSON 数组。每项必须保留 sourceType；rolling-stone 保留 index，chinese-manual-cover 保留 sourceIndex、coverFile；所有项保留 input、matchedAlbum、sourceSummary、intro。genres/styles 只能使用中文。intro 与 sourceSummary 去除乱码、英语残句、重复和异常标点；fullIntro 写为 2-3 段自然中文。\n`;
await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');
await writeFile(promptPath, prompt, 'utf8');
console.log(JSON.stringify({ candidates: candidates.length, outputPath, promptPath }));
