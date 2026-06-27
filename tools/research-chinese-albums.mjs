import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'public', 'recommendations', 'album-catalog.json');
const outputPath = path.join(root, 'tools', 'chinese-album-research.json');
const strictUnknown = /信息有限|待核实|无法确认|尚不明确|资料不足|未能确认|信息存疑|不详|高度不确定|等待重新核对/;
const manualCorrection = /人工核对封面校正|当前只保留已由人工封面确认/;

const clean = (value) => String(value ?? '')
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#(?:34|39);/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

function findSearchJson(html) {
  const match = html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\});\s*window\.__USER__/);
  return match ? JSON.parse(match[1]) : null;
}

function extractField(html, label) {
  const pattern = new RegExp(`<span class="pl">${label}:<\\/span>\\s*&nbsp;([\\s\\S]*?)(?:<br\\s*\\/>|<br\\s*>|<\\/div>)`, 'i');
  return clean(html.match(pattern)?.[1] ?? '');
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function research(target) {
  const query = `${target.albumArtist} ${target.albumTitle}`;
  const searchUrl = `https://music.douban.com/subject_search?search_text=${encodeURIComponent(query)}&cat=1003`;
  try {
    const searchHtml = await fetchHtml(searchUrl);
    const result = findSearchJson(searchHtml);
    const candidates = result?.items ?? [];
    const chosen = candidates.find((item) => item.title === target.albumTitle)
      ?? candidates.find((item) => item.abstract?.includes(target.albumArtist))
      ?? candidates[0];
    if (!chosen?.url) return { ...target, query, status: 'not-found', candidates: candidates.slice(0, 3) };

    const subjectHtml = await fetchHtml(chosen.url);
    const summary = clean(subjectHtml.match(/property="v:summary">([\s\S]*?)<\/span>/i)?.[1] ?? '');
    return {
      ...target,
      query,
      status: 'found',
      subjectUrl: chosen.url,
      searchTitle: chosen.title,
      searchAbstract: chosen.abstract ?? '',
      performer: extractField(subjectHtml, '表演者'),
      genre: extractField(subjectHtml, '流派'),
      releaseDate: extractField(subjectHtml, '发行时间'),
      label: extractField(subjectHtml, '出版者'),
      summary,
    };
  } catch (error) {
    return { ...target, query, status: 'error', error: String(error) };
  }
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const targets = catalog
  .filter((item) => item.collection === 'chinese-rock')
  .filter((item) => strictUnknown.test([item.detail.introTitle, item.detail.shortIntro, item.detail.fullIntro, item.detail.basicFacts, item.detail.artistContext, item.detail.receptionContext].join('\n'))
    || manualCorrection.test([item.detail.introTitle, item.detail.shortIntro, item.detail.fullIntro, item.detail.basicFacts].join('\n')));
const output = [];
for (const target of targets) {
  output.push(await research(target));
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ targets: targets.length, found: output.filter((item) => item.status === 'found').length, outputPath }));
