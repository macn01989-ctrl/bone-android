import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = 'C:\\Users\\Lenovo\\Desktop\\杂活\\rolling-stone-albums-web\\work\\claude-covers';
const publicRoot = path.join(root, 'public', 'recommendations');
const englishCoverSource = path.join(sourceRoot, 'covers');
const chineseCoverSource = path.join(sourceRoot, 'chinese-covers', 'covers');
const englishCoverTarget = path.join(publicRoot, 'album-covers', 'rolling-stone');
const chineseCoverTarget = path.join(publicRoot, 'album-covers', 'chinese');
const chineseOverridesPath = path.join(root, 'tools', 'chinese-album-overrides.json');
const reviewedChineseOverridesPath = path.join(root, 'tools', 'manual-chinese-reviewed-revisions.json');
const unverifiedManualIndexesPath = path.join(root, 'tools', 'manual-chinese-unverified-indexes.json');
const manualChineseCoverMapPath = path.join(publicRoot, 'chinese-manual-cover-map.json');
const manualCoverOverrides = new Map([
  ['0067_到尽_Swing.jpg', { sourceIndex: 67, artist: 'Swing乐队', albumTitle: 'Swing到尽' }],
  ['0078果味VC_双重生命.jpg', { sourceIndex: 78, artist: '果味VC', albumTitle: '双重生命' }],
  ['0313_透明杂志_透明杂志专辑.jpg', { sourceIndex: 313, artist: '透明杂志', albumTitle: '透明杂志 FOREVER' }],
  ['四分卫_世界.jpg', { sourceIndex: 105, artist: '四分卫', albumTitle: '世界' }],
  ['呼吸乐队_呼吸.jpg', { sourceIndex: 95, artist: '呼吸乐队', albumTitle: '呼吸' }],
  ['木马_木马.png', { sourceIndex: 179, artist: '木马', albumTitle: '木马' }],
]);
const manualEnglishCoverOverrides = new Map([
  ['themagneticfields69lovesongs', {
    sourcePath: 'C:\\Users\\Lenovo\\xwechat_files\\wxid_3x67copy1c1j22_0ec1\\temp\\RWTemp\\2026-06\\9e20f478899dc29eb19741386f9343c8\\ec4bf254b8b90c5cb6d2380e37688031.jpg',
    file: 'manual_323_the_magnetic_fields_69_love_songs.jpg',
  }],
]);

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const hasLatin = (value) => /[A-Za-z]/.test(value);
const termMap = new Map([
  ['Rock', '摇滚'], ['Pop', '流行'], ['Indie Rock', '独立摇滚'], ['Indie Pop', '独立流行'],
  ['Alternative Rock', '另类摇滚'], ['Art Rock', '艺术摇滚'], ['Pop Rock', '流行摇滚'],
  ['Folk Rock', '民谣摇滚'], ['Post-Rock', '后摇滚'], ['Post-Punk', '后朋克'],
  ['Punk Rock', '朋克摇滚'], ['Chinese Rock', '中国摇滚'], ['Taiwanese Rock', '台湾摇滚'],
  ['Chinese Indie Rock', '中国独立摇滚'], ['Mandopop', '华语流行'], ['Cantopop', '粤语流行'],
  ['Dream Pop', '梦幻流行'], ['Electropop', '电子流行'], ['Synth-pop', '合成器流行'],
  ['Heavy Metal', '重金属'], ['Thrash Metal', '激流金属'], ['Nu Metal', '新金属'],
  ['Instrumental Rock', '器乐摇滚'], ['World Music', '世界音乐'], ['Mongolian Folk Rock', '蒙古民谣摇滚'],
  ['Skate Punk', '滑板朋克'], ['Dance Punk', '舞曲朋克'], ['Gothic Rock', '哥特摇滚'],
  ['Lo-fi', '低保真'], ['Ballad', '抒情曲'], ['Electronic Rock', '电子摇滚'],
  ['Britpop', '英伦摇滚'], ['New Wave', '新浪潮'], ['Shoegaze', '盯鞋摇滚'],
  ['Noise Rock', '噪音摇滚'], ['Experimental Rock', '实验摇滚'], ['Psychedelic Rock', '迷幻摇滚'],
  ['Progressive Rock', '前卫摇滚'], ['Garage Rock', '车库摇滚'], ['Hard Rock', '硬摇滚'],
  ['Hip Hop', '嘻哈'], ['R&B', '节奏布鲁斯'], ['Soul', '灵魂乐'], ['Funk', '放克'],
  ['Jazz', '爵士'], ['Folk', '民谣'], ['Electronic', '电子'], ['Ambient', '氛围音乐'],
]);

function styleTags(album) {
  const values = [...(album.genres ?? []), ...(album.styles ?? [])]
    .map((raw) => String(raw).trim())
    .map((raw) => termMap.get(raw) ?? (hasLatin(raw) ? null : raw))
    .filter(Boolean);
  return [...new Set(values)].slice(0, 7);
}

function normalizeCoverName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function matchEnglishCovers(albums, files) {
  const coverByIdentity = new Map(files.map((file) => [
    normalizeCoverName(path.parse(file).name.replace(/^\d+_/, '')),
    file,
  ]));
  const matches = albums.map((item) => {
    const identity = normalizeCoverName(`${item.input.artistName}_${item.input.albumName}`);
    const cover = coverByIdentity.get(identity);
    if (!cover) throw new Error(`Missing exact English cover for ${item.input.artistName} — ${item.input.albumName}`);
    return cover;
  });
  if (new Set(matches).size !== albums.length) throw new Error('English cover mapping is not one-to-one.');
  return matches;
}

function detailOf(item) {
  const intro = item.intro ?? {};
  const summary = item.sourceSummary ?? {};
  return {
    introTitle: intro.introTitle ?? '',
    shortIntro: intro.shortIntro ?? '',
    fullIntro: intro.fullIntro ?? '',
    listeningMoment: intro.listeningMoment ?? '',
    whyKeep: intro.whyKeep ?? '',
    basicFacts: summary.basicFacts ?? '',
    soundCharacteristics: Array.isArray(summary.soundCharacteristics) ? summary.soundCharacteristics : [],
    artistContext: summary.artistContext ?? '',
    receptionContext: summary.receptionContext ?? '',
  };
}

function albumTitleOf(item) {
  return item.matchedAlbum?.albumTitle ?? item.matchedAlbum?.albumName ?? item.input?.albumName ?? '';
}

function compactName(value) {
  return String(value ?? '').replace(/[\s_\-—–'’“”《》()（）\[\]【】.,，。:：!！?？]/g, '').toLowerCase();
}

function manuallyCorrectedItem(rawItem, manual, overrides, reviewedOverrides) {
  const hasOverride = Boolean(overrides[String(rawItem.index)] || reviewedOverrides[String(rawItem.index)]);
  const fromOverride = {
    ...rawItem,
    ...(overrides[String(rawItem.index)] ?? {}),
    ...(reviewedOverrides[String(rawItem.index)] ?? {}),
  };
  const oldArtist = fromOverride.artist ?? fromOverride.matchedAlbum?.artist ?? '';
  const oldTitle = fromOverride.name ?? albumTitleOf(fromOverride);
  const identityChanged = compactName(oldArtist) !== compactName(manual.artist)
    || compactName(oldTitle) !== compactName(manual.albumTitle);

  if (hasOverride) {
    return {
      identityChanged,
      item: {
        ...fromOverride,
        artist: manual.artist,
        name: manual.albumTitle,
        matchedAlbum: {
          ...fromOverride.matchedAlbum,
          albumTitle: manual.albumTitle,
          artist: manual.artist,
        },
      },
    };
  }

  if (!identityChanged) {
    return { item: fromOverride, identityChanged: false };
  }

  return {
    identityChanged: true,
    item: {
      ...fromOverride,
      artist: manual.artist,
      name: manual.albumTitle,
      matchedAlbum: {
        ...fromOverride.matchedAlbum,
        albumTitle: manual.albumTitle,
        artist: manual.artist,
        releaseDate: '',
        releaseYear: null,
        genres: ['摇滚'],
        styles: ['摇滚'],
        label: '',
        trackCount: null,
        notableTracks: [],
      },
      intro: {
        introTitle: manual.albumTitle,
        shortIntro: `${manual.artist}《${manual.albumTitle}》的艺人和专辑名已按人工核对封面校正。`,
        fullIntro: `这张专辑的封面、艺人和标题以人工核对结果为准。旧条目的介绍对应的是另一张作品，因此不再沿用，避免让错误资料跟着正确封面出现。`,
        listeningMoment: '',
        whyKeep: '',
        keywords: ['摇滚'],
      },
      sourceSummary: {
        basicFacts: `${manual.artist}《${manual.albumTitle}》。当前只保留已由人工封面确认的艺人和专辑名。`,
        soundCharacteristics: [],
        artistContext: '',
        receptionContext: '',
        conflictsOrUncertainty: '旧条目与人工核对封面不一致，原有背景资料已撤下，等待重新核对。',
      },
    },
  };
}

function collectManualChineseCovers(files) {
  const indexed = new Map();
  for (const file of files.slice().sort()) {
    const special = manualCoverOverrides.get(file);
    if (special) {
      indexed.set(special.sourceIndex, { file, ...special });
      continue;
    }
    const match = file.match(/^(\d{4})_(.+?)_(.+)$/);
    if (!match) continue;
    const [, sourceIndexText, artist, rawTitle] = match;
    const sourceIndex = Number(sourceIndexText);
    const albumTitle = rawTitle.replace(/\s+\(2\)(?=\.[^.]+$)/, '').replace(/\.[^.]+$/, '').trim();
    const candidate = { file, sourceIndex, artist: artist.trim(), albumTitle };
    const existing = indexed.get(sourceIndex);
    if (!existing || /\s+\(2\)\.[^.]+$/.test(existing.file)) indexed.set(sourceIndex, candidate);
  }
  return [...indexed.values()].sort((left, right) => left.sourceIndex - right.sourceIndex);
}

async function main() {
  const [english, chinese, englishFiles, chineseOverrides, reviewedChineseOverrides, manualChineseCoverFiles, unverifiedManualIndexes] = await Promise.all([
    readJson(path.join(sourceRoot, 'complete_473_albums.zh.json')),
    readJson(path.join(sourceRoot, 'chinese-rock-complete.json')),
    readdir(englishCoverSource),
    readJson(chineseOverridesPath),
    readJson(reviewedChineseOverridesPath),
    readdir(chineseCoverSource),
    readJson(unverifiedManualIndexesPath),
  ]);

  if (englishFiles.length !== english.length) {
    throw new Error(`English cover count mismatch: ${englishFiles.length}/${english.length}`);
  }
  const englishCoverMatches = matchEnglishCovers(english, englishFiles);

  await rm(path.join(publicRoot, 'album-covers'), { recursive: true, force: true });
  await Promise.all([mkdir(englishCoverTarget, { recursive: true }), mkdir(chineseCoverTarget, { recursive: true })]);

  const catalog = [];
  for (let index = 0; index < english.length; index += 1) {
    const item = english[index];
    const defaultCoverFile = englishCoverMatches[index];
    const manualCover = manualEnglishCoverOverrides.get(normalizeCoverName(`${item.input.artistName}_${item.input.albumName}`));
    const coverFile = manualCover?.file ?? defaultCoverFile;
    await cp(manualCover?.sourcePath ?? path.join(englishCoverSource, defaultCoverFile), path.join(englishCoverTarget, coverFile));
    const album = item.matchedAlbum;
    catalog.push({
      id: `rolling-stone-${String(index + 1).padStart(3, '0')}`,
      collection: 'rolling-stone-500',
      albumTitle: item.input.albumName,
      albumArtist: item.input.artistName,
      artworkUrl: `/recommendations/album-covers/rolling-stone/${encodeURIComponent(coverFile)}`,
      styleTags: styleTags(album),
      releaseDate: album.releaseDate ?? '',
      releaseYear: album.releaseYear ?? null,
      label: album.label ?? '',
      trackCount: album.trackCount ?? null,
      notableTracks: Array.isArray(album.notableTracks) ? album.notableTracks : [],
      detail: detailOf(item),
    });
  }

  const chineseByIndex = new Map(chinese.map((item) => [Number(item.index), item]));
  const excludedManualIndexes = new Set(unverifiedManualIndexes.map(Number));
  const manualMap = [];
  for (const manual of collectManualChineseCovers(manualChineseCoverFiles)) {
    if (excludedManualIndexes.has(manual.sourceIndex)) continue;
    const rawItem = chineseByIndex.get(manual.sourceIndex);
    if (!rawItem) throw new Error(`Manual cover ${manual.file} has no source index ${manual.sourceIndex}.`);
    const { item, identityChanged } = manuallyCorrectedItem(rawItem, manual, chineseOverrides, reviewedChineseOverrides);
    const identity = `${manual.artist} ${manual.albumTitle}`;
    if (/五月天|飞儿|飛兒|F\.?I\.?R/i.test(identity) || manual.albumTitle === '西北风') continue;
    const coverFile = manual.file;
    const sourceCover = path.join(chineseCoverSource, coverFile);
    await cp(sourceCover, path.join(chineseCoverTarget, coverFile));
    const album = item.matchedAlbum;
    catalog.push({
      id: `chinese-${String(item.index).padStart(3, '0')}`,
      collection: 'chinese-rock',
      albumTitle: manual.albumTitle,
      albumArtist: manual.artist,
      artworkUrl: `/recommendations/album-covers/chinese/${encodeURIComponent(coverFile)}`,
      styleTags: styleTags(album),
      releaseDate: album.releaseDate ?? '',
      releaseYear: album.releaseYear ?? null,
      label: album.label ?? '',
      trackCount: album.trackCount ?? null,
      notableTracks: Array.isArray(album.notableTracks) ? album.notableTracks : [],
      detail: detailOf(item),
    });
    manualMap.push({
      sourceIndex: manual.sourceIndex,
      coverFile,
      artist: manual.artist,
      albumTitle: manual.albumTitle,
      identityChanged,
    });
  }

  await writeFile(path.join(publicRoot, 'album-catalog.json'), `${JSON.stringify(catalog)}\n`, 'utf8');
  await writeFile(manualChineseCoverMapPath, `${JSON.stringify(manualMap)}\n`, 'utf8');
  console.log(JSON.stringify({ total: catalog.length, rollingStone: english.length, chinese: catalog.length - english.length, manuallyCorrectedChinese: manualMap.filter((item) => item.identityChanged).length }));
}

await main();
