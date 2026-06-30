import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export type RecommendationKind = 'album' | 'podcast';

type AlbumCandidate = {
  id: string;
  collection: 'rolling-stone-500' | 'chinese-rock' | 'apple-music' | '1001-albums';
  albumTitle: string;
  albumArtist: string;
  artworkUrl: string;
  styleTags: string[];
  releaseDate: string;
  releaseYear: number | null;
  label: string;
  trackCount: number | null;
  notableTracks: string[];
  detail: {
    introTitle: string;
    shortIntro: string;
    fullIntro: string;
    listeningMoment: string;
    whyKeep: string;
    basicFacts: string;
    soundCharacteristics: string[];
    artistContext: string;
    receptionContext: string;
  };
};

type PodcastCandidate = {
  id: string;
  sequence: number;
  name: string;
  platforms: string;
  author?: string;
  artworkUrl?: string;
  xiaoyuzhouUrl?: string;
  applePodcastUrl?: string;
  rssUrl?: string;
};

type LiveAlbumCandidate = {
  id: string;
  name: string;
  artist: string;
};

export type RecommendationAlbum = {
  id: string;
  albumTitle: string;
  albumArtist: string;
  artworkUrl: string;
  originalArtworkUrl?: string;
  albumIntro: string;
  collection: AlbumCandidate['collection'];
  styleTags: string[];
  releaseDate: string;
  releaseYear: number | null;
  label: string;
  trackCount: number | null;
  notableTracks: string[];
  detail: AlbumCandidate['detail'];
  timestamp: number;
  applePoolItemId?: string;
  applePoolCandidateId?: string;
  applePoolCoverPath?: string;
};

export type RecommendationPodcast = {
  id: string;
  title: string;
  author: string;
  platforms: string;
  artworkUrl: string;
  episodes: Array<{ title: string; date?: string }>;
  timestamp: number;
};

type ITunesResult = {
  wrapperType?: string;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  artworkUrl1000?: string;
  feedUrl?: string;
  collectionId?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  trackCount?: number;
};

type ITunesResponse = { results?: ITunesResult[] };

const HISTORY_LIMIT = 600;
const APPLE_POOL_TARGET = 1;
const APPLE_POOL_KEY = 'bone.apple-album-pool.v1';
const APPLE_POOL_READY_KEY = 'bone.apple-album-pool.ready.v1';
const APPLE_POOL_USED_KEY = 'bone.apple-album-pool.used.v1';
const APPLE_POOL_RUNNING_KEY = 'bone.apple-album-pool.running.v1';
const APPLE_POOL_COVER_DIR = 'apple-album-pool';
const APPLE_POOL_APPLE_BATCH_SIZE = 1;
const APPLE_POOL_METADATA_QUEUE_LIMIT = 4;
const APPLE_POOL_PAUSE_UNTIL_KEY = 'bone.apple-album-pool.pause-until.v1';
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const SILICONFLOW_CHAT_COMPLETIONS_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const catalogCache = new Map<RecommendationKind, Promise<AlbumCandidate[] | PodcastCandidate[]>>();
let liveAlbumCandidatesCache: Promise<LiveAlbumCandidate[]> | null = null;
let prefetchedLiveAlbum: RecommendationAlbum | null = null;
let liveAlbumPrefetchInFlight: Promise<RecommendationAlbum | null> | null = null;
let liveAlbumPrefetchCooldownUntil = 0;
let applePoolWorkerInFlight: Promise<void> | null = null;
let applePoolLatestConfig: LiveAlbumConfig | null = null;
const usedLiveAlbumIds = new Set<string>();
const ApplePoolNative = registerPlugin<{
  start(): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
  pause(options: { until: number }): Promise<{ pausedUntil: number }>;
  getState(): Promise<{ pool?: string; used?: string; ready?: string; running?: string }>;
  setState(options: { pool: string; used: string; ready: string }): Promise<{ ok: boolean }>;
}>('ApplePool');
const NativeHttp = registerPlugin<{
  get(options: { url: string; timeoutMs?: number }): Promise<{ status: number; body: string; url?: string }>;
}>('NativeHttp');

type StoredApplePoolAlbum = RecommendationAlbum & {
  applePoolItemId: string;
  applePoolCandidateId: string;
  originalArtworkUrl: string;
  applePoolCoverPath?: string;
  poolCreatedAt: number;
};

type QueuedAppleMetadata = {
  candidate: LiveAlbumCandidate;
  apple: ITunesResult;
};

export type LiveAlbumConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  connected?: boolean;
  lastError?: string;
};

function historyKey(kind: RecommendationKind) {
  return `bone.recommendation-history.${kind}`;
}

function readHistory(kind: RecommendationKind): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(historyKey(kind)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function recordHistory(kind: RecommendationKind, id: string) {
  try {
    const next = [id, ...readHistory(kind).filter((item) => item !== id)].slice(0, HISTORY_LIMIT);
    window.localStorage.setItem(historyKey(kind), JSON.stringify(next));
  } catch {
    // 推荐历史只是去重优化；本地存储不可用时不阻断推荐。
  }
}

function resetHistory(kind: RecommendationKind) {
  try {
    window.localStorage.removeItem(historyKey(kind));
  } catch {
    // Ignore unavailable local storage.
  }
}

async function waitForApplePoolPauseIfNeeded() {
  let until = 0;
  try {
    until = Number(window.localStorage.getItem(APPLE_POOL_PAUSE_UNTIL_KEY) || 0);
  } catch {
    until = 0;
  }
  const remaining = until - Date.now();
  if (remaining > 0) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(remaining, 5_000)));
  }
}

function readApplePool(): StoredApplePoolAlbum[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPLE_POOL_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is StoredApplePoolAlbum =>
        item &&
        typeof item.applePoolItemId === 'string' &&
        typeof item.applePoolCandidateId === 'string' &&
        typeof item.albumTitle === 'string' &&
        typeof item.albumArtist === 'string' &&
        typeof item.originalArtworkUrl === 'string',
      )
      : [];
  } catch {
    return [];
  }
}

function writeApplePool(items: StoredApplePoolAlbum[]) {
  try {
    const next = items.slice(0, APPLE_POOL_TARGET);
    window.localStorage.setItem(APPLE_POOL_KEY, JSON.stringify(next));
    if (next.length >= APPLE_POOL_TARGET) {
      window.localStorage.setItem(APPLE_POOL_READY_KEY, '1');
    } else {
      window.localStorage.removeItem(APPLE_POOL_READY_KEY);
    }
    void pushApplePoolStateToNative();
  } catch {
    // 池子只是后台库存，写失败不影响本地推荐继续使用。
  }
}

function readApplePoolUsed(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPLE_POOL_USED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function markApplePoolUsed(candidateId: string | undefined) {
  if (!candidateId) return;
  try {
    const next = [candidateId, ...readApplePoolUsed().filter((item) => item !== candidateId)].slice(0, 1200);
    window.localStorage.setItem(APPLE_POOL_USED_KEY, JSON.stringify(next));
    void pushApplePoolStateToNative();
  } catch {
    // 去重失败也不阻断后台工厂。
  }
}

function isNativeApplePoolAvailable() {
  return Capacitor.isNativePlatform();
}

function parseStoredPool(raw: string | undefined): StoredApplePoolAlbum[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is StoredApplePoolAlbum =>
        item &&
        typeof item.applePoolItemId === 'string' &&
        typeof item.applePoolCandidateId === 'string' &&
        typeof item.albumTitle === 'string' &&
        typeof item.albumArtist === 'string' &&
        typeof item.originalArtworkUrl === 'string',
      )
      : [];
  } catch {
    return [];
  }
}

function parseStringArray(raw: string | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mergeStringList(primary: string[], secondary: string[]) {
  return Array.from(new Set([...primary, ...secondary])).slice(0, 1200);
}

function filterPoolByUsed(items: StoredApplePoolAlbum[], used: string[]) {
  const blocked = new Set(used);
  const seen = new Set<string>();
  return items.filter((item) => {
    if (blocked.has(item.applePoolCandidateId) || seen.has(item.applePoolCandidateId)) return false;
    seen.add(item.applePoolCandidateId);
    return true;
  });
}

function pushApplePoolStateToNative() {
  if (!isNativeApplePoolAvailable()) return Promise.resolve();
  return ApplePoolNative.setState({
    pool: window.localStorage.getItem(APPLE_POOL_KEY) ?? '[]',
    used: window.localStorage.getItem(APPLE_POOL_USED_KEY) ?? '[]',
    ready: window.localStorage.getItem(APPLE_POOL_READY_KEY) ?? '',
  }).catch(() => undefined);
}

export async function syncAppleAlbumPoolFromNative() {
  if (!isNativeApplePoolAvailable()) return;
  const state = await ApplePoolNative.getState().catch(() => null);
  if (!state) return;

  const mergedUsed = mergeStringList(parseStringArray(state.used), readApplePoolUsed());
  window.localStorage.setItem(APPLE_POOL_USED_KEY, JSON.stringify(mergedUsed));
  const mergedPool = filterPoolByUsed([...readApplePool(), ...parseStoredPool(state.pool)], mergedUsed).slice(0, APPLE_POOL_TARGET);
  window.localStorage.setItem(APPLE_POOL_KEY, JSON.stringify(mergedPool));
  if (mergedPool.length >= APPLE_POOL_TARGET && (state.ready === '1' || window.localStorage.getItem(APPLE_POOL_READY_KEY) === '1')) {
    window.localStorage.setItem(APPLE_POOL_READY_KEY, '1');
  } else if (mergedPool.length < APPLE_POOL_TARGET) {
    window.localStorage.removeItem(APPLE_POOL_READY_KEY);
  }
  if (state.running === '1') {
    window.localStorage.setItem(APPLE_POOL_RUNNING_KEY, '1');
  } else {
    window.localStorage.removeItem(APPLE_POOL_RUNNING_KEY);
  }
  void pushApplePoolStateToNative();
}

export function startNativeAppleAlbumPoolService(config: LiveAlbumConfig) {
  if (!isNativeApplePoolAvailable()) return;
  if (!isApplePoolConfigReady(config)) {
    void ApplePoolNative.stop().catch(() => undefined);
    return;
  }
  if (getAppleAlbumPoolCount() >= APPLE_POOL_TARGET) return;
  void ApplePoolNative.start().catch(() => undefined);
}

export function triggerLiveAlbumReserve(config: LiveAlbumConfig) {
  if (!isApplePoolConfigReady(config)) return;
  if (getAppleAlbumPoolCount() >= APPLE_POOL_TARGET || prefetchedLiveAlbum || liveAlbumPrefetchInFlight) return;
  if (Capacitor.isNativePlatform()) {
    startNativeAppleAlbumPoolService(config);
    return;
  }
  void prefetchLiveAlbum(config);
}

export function getAppleAlbumPoolCount() {
  return readApplePool().length;
}

export function getAppleAlbumPoolDisplayInterval() {
  const count = getAppleAlbumPoolCount();
  if (count <= 0) return Number.POSITIVE_INFINITY;
  const hasReachedTarget = window.localStorage.getItem(APPLE_POOL_READY_KEY) === '1';
  if (!hasReachedTarget) return 4;
  return count <= 15 ? 3 : 1;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] || '' : value);
    };
    reader.onerror = () => reject(reader.error || new Error('cover read failed'));
    reader.readAsDataURL(blob);
  });
}

async function cacheApplePoolArtwork(poolItemId: string, url: string): Promise<{ artworkUrl: string; coverPath?: string }> {
  if (!url) return { artworkUrl: url };

  try {
    const extension = url.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const coverPath = `${APPLE_POOL_COVER_DIR}/${poolItemId}.${extension}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`cover ${response.status}`);
    const data = await blobToBase64(await response.blob());
    await Filesystem.writeFile({
      path: coverPath,
      data,
      directory: Directory.Data,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path: coverPath, directory: Directory.Data });
    return { artworkUrl: Capacitor.convertFileSrc(uri), coverPath };
  } catch {
    return { artworkUrl: url };
  }
}

async function resolveApplePoolArtwork(item: StoredApplePoolAlbum): Promise<StoredApplePoolAlbum | null> {
  try {
    if (item.applePoolCoverPath) {
      await Filesystem.stat({ path: item.applePoolCoverPath, directory: Directory.Data });
      const { uri } = await Filesystem.getUri({ path: item.applePoolCoverPath, directory: Directory.Data });
      return { ...item, artworkUrl: Capacitor.convertFileSrc(uri) };
    }
  } catch {
    // 本地文件丢失时继续尝试用原始 Apple 封面重新缓存。
  }

  const cached = await cacheApplePoolArtwork(item.applePoolItemId, item.originalArtworkUrl);
  if (!cached.coverPath) return null;
  return {
    ...item,
    artworkUrl: cached.artworkUrl,
    applePoolCoverPath: cached.coverPath,
  };
}

async function deleteApplePoolCover(coverPath: string | undefined) {
  if (!coverPath) return;
  try {
    await Filesystem.deleteFile({ path: coverPath, directory: Directory.Data });
  } catch {
    // 文件可能已被系统清理；忽略。
  }
}

export async function discardApplePoolAlbum(album: Pick<RecommendationAlbum, 'applePoolCandidateId' | 'applePoolCoverPath'>) {
  markApplePoolUsed(album.applePoolCandidateId);
  await deleteApplePoolCover(album.applePoolCoverPath);
}

export function keepApplePoolAlbum(album: Pick<RecommendationAlbum, 'applePoolCandidateId'>) {
  markApplePoolUsed(album.applePoolCandidateId);
}

function shouldUseNativeHttp(url: string) {
  return Capacitor.isNativePlatform() && /^https?:\/\//i.test(url);
}

async function nativeHttpGet(url: string, timeoutMs: number): Promise<string> {
  const response = await NativeHttp.get({ url, timeoutMs });
  if (response.status < 200 || response.status >= 300) throw new Error(`请求失败（${response.status}）`);
  return response.body;
}

async function fetchJson<T>(url: string, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (shouldUseNativeHttp(url)) {
    return JSON.parse(await nativeHttpGet(url, timeoutMs)) as T;
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([timeout, signal]) : timeout;
  const response = await fetch(url, { signal: requestSignal });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  return (await response.json()) as T;
}

async function fetchText(url: string, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  if (shouldUseNativeHttp(url)) {
    return nativeHttpGet(url, timeoutMs);
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([timeout, signal]) : timeout;
  const response = await fetch(url, { signal: requestSignal });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  return response.text();
}

function loadCatalog(kind: RecommendationKind) {
  const existing = catalogCache.get(kind);
  if (existing) return existing;

  const request = fetchJson<AlbumCandidate[] | PodcastCandidate[]>(
    `/recommendations/${kind === 'album' ? 'album-catalog' : 'podcasts'}.json`,
    8_000,
  ).catch((error: unknown) => {
    catalogCache.delete(kind);
    throw error;
  });
  catalogCache.set(kind, request);
  return request;
}

function loadLiveAlbumCandidates() {
  if (!liveAlbumCandidatesCache) {
    liveAlbumCandidatesCache = fetchJson<LiveAlbumCandidate[]>('/recommendations/album-live-candidates.json', 8_000)
      .catch((error: unknown) => {
        liveAlbumCandidatesCache = null;
        throw error;
      });
  }
  return liveAlbumCandidatesCache;
}

function normalize(value: string | undefined) {
  return (value ?? '').toLocaleLowerCase().replace(/[\s\-—–'’“”《》()（）.,，。:：!！?？]/g, '');
}

function similarity(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  const rows = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = rows[0];
    rows[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = rows[j];
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return (Math.max(a.length, b.length) - rows[b.length]) / Math.max(a.length, b.length);
}

function hdArtwork(result: ITunesResult) {
  const source = result.artworkUrl1000 ?? result.artworkUrl600 ?? result.artworkUrl100;
  return source?.replace(/\/\d+x\d+(?:bb)?\.jpg$/, '/800x800bb.jpg') ?? '';
}

function hdPodcastArtwork(url: string | undefined) {
  if (!url) return '';
  const clean = url.replace(/&amp;/g, '&');
  if (clean.includes('mzstatic.com')) {
    return clean
      .replace(/\?.*$/, '')
      .replace(/\/\d+x\d+(?:bb)?\.(jpg|jpeg|png)$/i, '/600x600bb.$1');
  }
  return clean;
}

async function searchITunes(term: string, entity: 'album' | 'podcast', timeoutMs = 5_000, signal?: AbortSignal): Promise<ITunesResult | null> {
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=${entity}&limit=5&country=cn`;
  const response = await fetchJson<ITunesResponse>(url, timeoutMs, signal);
  const best = (response.results ?? [])
    .map((item) => ({ item, score: similarity(term, item.collectionName ?? item.trackName ?? '') }))
    .sort((left, right) => right.score - left.score)[0];
  return best && best.score >= 0.7 && hdArtwork(best.item) ? best.item : null;
}

async function searchLiveAlbumITunes(candidate: LiveAlbumCandidate, timeoutMs = 5_000, signal?: AbortSignal): Promise<ITunesResult | null> {
  const term = `${candidate.artist} ${candidate.name}`.trim();
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=album&limit=8&country=cn`;
  const response = await fetchJson<ITunesResponse>(url, timeoutMs, signal);
  const normalizedArtist = normalize(candidate.artist);
  const scored = (response.results ?? [])
    .filter((item) => item.collectionId && hdArtwork(item))
    .map((item) => {
      const albumScore = similarity(candidate.name, item.collectionName ?? item.trackName ?? '');
      const itemArtist = normalize(item.artistName);
      const artistScore = !normalizedArtist || !itemArtist
        ? 0.08
        : itemArtist.includes(normalizedArtist) || normalizedArtist.includes(itemArtist)
          ? 0.18
          : similarity(candidate.artist, item.artistName ?? '') * 0.14;
      return { item, score: albumScore + artistScore, albumScore };
    })
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  return best && best.albumScore >= 0.62 ? best.item : null;
}

async function searchAlbumFavoriteITunes(albumName: string, artistName: string, timeoutMs = 6_000): Promise<ITunesResult | null> {
  const terms = Array.from(new Set([
    albumName,
    `${artistName} ${albumName}`.trim(),
  ].filter(Boolean)));
  const timeout = AbortSignal.timeout(timeoutMs);
  const responses = await Promise.allSettled(
    terms.map((term) => {
      const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=album&limit=12&country=cn`;
      return fetchJson<ITunesResponse>(url, timeoutMs, timeout);
    }),
  );
  const results = responses.flatMap((result) => (result.status === 'fulfilled' ? result.value.results ?? [] : []));
  const normalizedArtist = normalize(artistName);
  const scored = results
    .filter((item) => item.collectionId && hdArtwork(item))
    .map((item) => {
      const albumScore = similarity(albumName, item.collectionName ?? '');
      const itemArtist = normalize(item.artistName);
      const artistScore = !normalizedArtist || !itemArtist
        ? 0.12
        : itemArtist.includes(normalizedArtist) || normalizedArtist.includes(itemArtist)
          ? 0.24
          : similarity(artistName, item.artistName ?? '') * 0.18;
      return { item, score: albumScore + artistScore, albumScore };
    })
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  return best && best.albumScore >= 0.72 ? best.item : null;
}

function chooseCandidate<T extends { id: number | string }>(kind: RecommendationKind, candidates: T[]): T {
  let history = new Set(readHistory(kind));
  let available = candidates.filter((candidate) => !history.has(`${kind}-${candidate.id}`));

  // 小程序在历史接近 80% 时会没有候选。安卓在本轮确实抽完后开启新一轮，
  // 既保持不重复，也不会让用户刷新到一个永远无法恢复的空页面。
  if (available.length === 0) {
    resetHistory(kind);
    history = new Set();
    available = candidates;
  }

  return available[Math.floor(Math.random() * available.length)]!;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function parseRssEpisodes(rssXml: string, limit = 6): Array<{ title: string; date?: string }> {
  const episodes: Array<{ title: string; date?: string }> = [];
  const items = rssXml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  for (const item of items.slice(0, limit)) {
    const title = item.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const date = item.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    if (title) episodes.push({ title: decodeXml(title), date: date ? decodeXml(date) : undefined });
  }
  return episodes;
}

async function getPodcastEpisodes(result: ITunesResult, signal?: AbortSignal): Promise<Array<{ title: string; date?: string }>> {
  let feedUrl = result.feedUrl;
  if (!feedUrl && result.collectionId) {
    const lookup = await fetchJson<ITunesResponse>(
      `https://itunes.apple.com/lookup?id=${result.collectionId}&country=cn`,
      4_500,
      signal,
    );
    feedUrl = lookup.results?.[0]?.feedUrl;
  }
  if (!feedUrl) return [];
  return parseRssEpisodes(await fetchText(feedUrl, 5_500, signal));
}

function getAlbum(candidate: AlbumCandidate): RecommendationAlbum {
  return {
    id: `album-${candidate.id}`,
    albumTitle: candidate.albumTitle,
    albumArtist: candidate.albumArtist,
    artworkUrl: candidate.artworkUrl,
    albumIntro: candidate.detail.shortIntro,
    collection: candidate.collection,
    styleTags: candidate.styleTags,
    releaseDate: candidate.releaseDate,
    releaseYear: candidate.releaseYear,
    label: candidate.label,
    trackCount: candidate.trackCount,
    notableTracks: candidate.notableTracks,
    detail: candidate.detail,
    timestamp: Date.now(),
  };
}

async function getPodcast(candidate: PodcastCandidate, signal?: AbortSignal): Promise<RecommendationPodcast | null> {
  const verified = await searchITunes(candidate.name, 'podcast', 5_000, signal).catch(() => null);
  if (!verified?.collectionId || !hdArtwork(verified)) return null;
  const episodes = await getPodcastEpisodes(verified, signal).catch(() => []);
  if (!episodes.length) return null;
  return {
    id: `podcast-${candidate.id}`,
    title: verified.collectionName ?? verified.trackName ?? candidate.name,
    author: verified.artistName ?? '未知作者',
    platforms: candidate.platforms,
    artworkUrl: hdArtwork(verified),
    episodes,
    timestamp: Date.now(),
  };
}

export async function findAlbumFavoriteFromApple(name: string, artist = ''): Promise<Pick<RecommendationAlbum, 'albumTitle' | 'albumArtist' | 'artworkUrl'> | null> {
  const cleanName = name.trim();
  const cleanArtist = artist.trim();
  if (!cleanName) return null;

  const verified = await searchAlbumFavoriteITunes(cleanName, cleanArtist, 6_000).catch(() => null);
  if (!verified?.collectionId || !hdArtwork(verified)) return null;
  return {
    albumTitle: verified.collectionName ?? name,
    albumArtist: verified.artistName ?? artist,
    artworkUrl: hdArtwork(verified),
  };
}

export async function findPodcastFavoriteFromApple(name: string): Promise<RecommendationPodcast | null> {
  const term = name.trim();
  if (!term) return null;

  const localCandidates = (await loadCatalog('podcast')) as PodcastCandidate[];
  const localMatch = localCandidates
    .filter((candidate) => hdPodcastArtwork(candidate.artworkUrl))
    .map((candidate) => ({
      candidate,
      score: normalize(candidate.name).includes(normalize(term)) || normalize(term).includes(normalize(candidate.name))
        ? 1
        : similarity(term, candidate.name),
    }))
    .sort((left, right) => right.score - left.score)[0];
  if (localMatch && localMatch.score >= 0.55) {
    const localPodcast = await getPodcast(localMatch.candidate);
    if (localPodcast) {
      return {
        ...localPodcast,
        id: `manual-${localPodcast.id}`,
        timestamp: Date.now(),
      };
    }
  }

  const verified = await searchITunes(term, 'podcast', 6_000).catch(() => null);
  if (!verified?.collectionId || !hdArtwork(verified)) return null;
  const episodes = await getPodcastEpisodes(verified).catch(() => []);
  return {
    id: `manual-podcast-${verified.collectionId}`,
    title: verified.collectionName ?? verified.trackName ?? name,
    author: verified.artistName ?? '用户添加',
    platforms: 'Apple Podcasts / 小宇宙',
    artworkUrl: hdArtwork(verified),
    episodes,
    timestamp: Date.now(),
  };
}

function parseModelJson(content: string): Record<string, unknown> | null {
  const cleaned = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function chineseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && !/[A-Za-z]/.test(tag))))
    .slice(0, 4);
}

function fallbackLiveAlbumIntro(albumTitle: string, artist: string) {
  return {
    introTitle: albumTitle,
    shortIntro: `这是一张来自 Apple Music 元数据的专辑推荐，先保留《${albumTitle}》的基础信息和封面。`,
    fullIntro: `这张专辑由 ${artist} 发行，当前已获取到 Apple Music 提供的封面、发行信息和曲目数量等基础资料。\n\n由于模型整理暂时不可用，这里先用克制的基础介绍占位，方便继续浏览、收藏，之后也可以再补充更完整的听感说明。`,
    whyKeep: '先收藏这张专辑，之后可以继续补充更完整的介绍。',
    styleTags: ['风格待补'],
  };
}

async function buildLiveAlbumFromApple(candidate: LiveAlbumCandidate, apple: ITunesResult, config: LiveAlbumConfig, signal: AbortSignal): Promise<RecommendationAlbum | null> {
  const appleArtworkUrl = hdArtwork(apple);
  if (!apple?.collectionId || !appleArtworkUrl) return null;
  const albumTitle = apple.collectionName ?? candidate.name;
  const artist = apple.artistName ?? candidate.artist;
  const releaseYear = apple.releaseDate ? Number(apple.releaseDate.slice(0, 4)) || null : null;
  const appleFacts = {
    albumTitle,
    artist,
    releaseDate: apple.releaseDate ?? '',
    releaseYear,
    primaryGenre: apple.primaryGenreName ?? '',
    trackCount: apple.trackCount ?? null,
  };
  const response = await fetch(config.baseUrl || SILICONFLOW_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是一名严谨的中文音乐编辑。只根据用户提供的 Apple Music 元数据写专辑卡片资料；不要联网臆测、不要编造奖项、制作人、曲目或评价。所有说明使用自然中文，专名可保留原文。只输出 JSON 对象：{"introTitle":"不超过18字","shortIntro":"40-70字","fullIntro":"120-220字、分2段","whyKeep":"25-45字","styleTags":["中文风格1","中文风格2"]}。styleTags 为2到4个纯中文风格词；信息不足时少写事实、保持克制。',
        },
        { role: 'user', content: JSON.stringify(appleFacts) },
      ],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`album intro api ${response.status}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const generated = parseModelJson(payload.choices?.[0]?.message?.content ?? '');
  if (!generated) return null;

  const shortIntro = typeof generated.shortIntro === 'string' ? generated.shortIntro.trim() : '';
  const fullIntro = typeof generated.fullIntro === 'string' ? generated.fullIntro.trim() : '';
  if (!shortIntro || !fullIntro) return null;
  const styleTags = chineseTags(generated.styleTags);
  return {
    id: `live-album-${candidate.id}`,
    albumTitle,
    albumArtist: artist,
    artworkUrl: appleArtworkUrl,
    originalArtworkUrl: appleArtworkUrl,
    albumIntro: shortIntro,
    collection: 'apple-music',
    styleTags,
    releaseDate: apple.releaseDate ?? '',
    releaseYear,
    label: '',
    trackCount: apple.trackCount ?? null,
    notableTracks: [],
    detail: {
      introTitle: typeof generated.introTitle === 'string' ? generated.introTitle.trim() : albumTitle,
      shortIntro,
      fullIntro,
      listeningMoment: '',
      whyKeep: typeof generated.whyKeep === 'string' ? generated.whyKeep.trim() : '',
      basicFacts: `${artist}《${albumTitle}》，Apple Music 提供发行与封面信息。`,
      soundCharacteristics: styleTags,
      artistContext: '',
      receptionContext: '',
    },
    timestamp: Date.now(),
  };
}

function createFallbackLiveAlbumFromApple(candidate: LiveAlbumCandidate, apple: ITunesResult): RecommendationAlbum | null {
  const appleArtworkUrl = hdArtwork(apple);
  if (!apple?.collectionId || !appleArtworkUrl) return null;
  const albumTitle = apple.collectionName ?? candidate.name;
  const artist = apple.artistName ?? candidate.artist;
  const releaseYear = apple.releaseDate ? Number(apple.releaseDate.slice(0, 4)) || null : null;
  const generated = fallbackLiveAlbumIntro(albumTitle, artist);
  const styleTags = chineseTags(generated.styleTags);
  return {
    id: `live-album-${candidate.id}`,
    albumTitle,
    albumArtist: artist,
    artworkUrl: appleArtworkUrl,
    originalArtworkUrl: appleArtworkUrl,
    albumIntro: generated.shortIntro,
    collection: 'apple-music',
    styleTags,
    releaseDate: apple.releaseDate ?? '',
    releaseYear,
    label: '',
    trackCount: apple.trackCount ?? null,
    notableTracks: [],
    detail: {
      introTitle: generated.introTitle,
      shortIntro: generated.shortIntro,
      fullIntro: generated.fullIntro,
      listeningMoment: '',
      whyKeep: generated.whyKeep,
      basicFacts: `${artist}《${albumTitle}》，Apple Music 提供发行与封面信息。`,
      soundCharacteristics: styleTags,
      artistContext: '',
      receptionContext: '',
    },
    timestamp: Date.now(),
  };
}

async function getLiveAlbum(candidate: LiveAlbumCandidate, config: LiveAlbumConfig, signal: AbortSignal): Promise<RecommendationAlbum | null> {
  const apple = await searchLiveAlbumITunes(candidate, 4_000, signal).catch(() => null);
  if (!apple?.collectionId || !hdArtwork(apple)) return null;
  const generated = await buildLiveAlbumFromApple(candidate, apple, config, signal)
    .catch(() => createFallbackLiveAlbumFromApple(candidate, apple));
  return generated ?? createFallbackLiveAlbumFromApple(candidate, apple);
}

function isApplePoolConfigReady(config: LiveAlbumConfig | null | undefined) {
  return Boolean(config?.apiKey.trim() && config.model.trim());
}

async function collectAppleMetadataBatch(queue: QueuedAppleMetadata[]) {
  const candidates = await loadLiveAlbumCandidates();
  const pool = readApplePool();
  const blocked = new Set([
    ...readApplePoolUsed(),
    ...pool.map((item) => item.applePoolCandidateId),
    ...queue.map((item) => item.candidate.id),
  ]);
  let batch = candidates.filter((candidate) => !blocked.has(candidate.id));
  if (batch.length < APPLE_POOL_APPLE_BATCH_SIZE) {
    batch = candidates.filter((candidate) => !pool.some((item) => item.applePoolCandidateId === candidate.id));
  }
  batch = batch.sort(() => Math.random() - 0.5).slice(0, APPLE_POOL_APPLE_BATCH_SIZE);
  if (!batch.length) return;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7_000);
  try {
    const settled = await Promise.allSettled(
      batch.map(async (candidate) => {
        const apple = await searchLiveAlbumITunes(candidate, 6_000, controller.signal);
        if (!apple?.collectionId || !hdArtwork(apple)) throw new Error('apple metadata incomplete');
        return { candidate, apple };
      }),
    );
    const seen = new Set(queue.map((item) => item.candidate.id));
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      if (seen.has(result.value.candidate.id)) continue;
      queue.push(result.value);
      seen.add(result.value.candidate.id);
      if (queue.length >= APPLE_POOL_METADATA_QUEUE_LIMIT) break;
    }
  } finally {
    window.clearTimeout(timer);
    controller.abort();
  }
}

async function createStoredApplePoolAlbum(metadata: QueuedAppleMetadata, config: LiveAlbumConfig): Promise<StoredApplePoolAlbum | null> {
  const generated = (await buildLiveAlbumFromApple(metadata.candidate, metadata.apple, config, AbortSignal.timeout(45_000))
    .catch(() => createFallbackLiveAlbumFromApple(metadata.candidate, metadata.apple)))
    ?? createFallbackLiveAlbumFromApple(metadata.candidate, metadata.apple);
  if (!generated?.originalArtworkUrl) return null;

  const poolItemId = `apple-pool-${metadata.candidate.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const cached = await cacheApplePoolArtwork(poolItemId, generated.originalArtworkUrl);
  return {
    ...generated,
    id: poolItemId,
    artworkUrl: cached.artworkUrl,
    originalArtworkUrl: generated.originalArtworkUrl,
    applePoolItemId: poolItemId,
    applePoolCandidateId: metadata.candidate.id,
    applePoolCoverPath: cached.coverPath,
    poolCreatedAt: Date.now(),
    timestamp: Date.now(),
  };
}

async function runAppleAlbumPoolWorker() {
  const queue: QueuedAppleMetadata[] = [];
  while (isApplePoolConfigReady(applePoolLatestConfig)) {
    await waitForApplePoolPauseIfNeeded();
    const config = applePoolLatestConfig;
    if (!config) return;

    const pool = readApplePool();
    if (pool.length >= APPLE_POOL_TARGET) return;

    if (queue.length === 0) {
      await collectAppleMetadataBatch(queue);
      if (queue.length === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 5_000));
        continue;
      }
    }

    const metadata = queue.shift();
    if (!metadata) continue;
    await waitForApplePoolPauseIfNeeded();
    const currentPool = readApplePool();
    if (currentPool.length >= APPLE_POOL_TARGET) return;
    if (currentPool.some((item) => item.applePoolCandidateId === metadata.candidate.id)) continue;

    try {
      const item = await createStoredApplePoolAlbum(metadata, config);
      if (!item) {
        markApplePoolUsed(metadata.candidate.id);
        continue;
      }

      const latestPool = readApplePool();
      if (latestPool.length >= APPLE_POOL_TARGET) {
        await deleteApplePoolCover(item.applePoolCoverPath);
        return;
      }
      if (!latestPool.some((existing) => existing.applePoolCandidateId === item.applePoolCandidateId)) {
        writeApplePool([...latestPool, item].slice(0, APPLE_POOL_TARGET));
      } else {
        await deleteApplePoolCover(item.applePoolCoverPath);
      }
    } catch {
      markApplePoolUsed(metadata.candidate.id);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2_000));
    }
  }
}

export function startAppleAlbumPool(config: LiveAlbumConfig) {
  applePoolLatestConfig = config;
  if (!isApplePoolConfigReady(config)) return;
  if (readApplePool().length >= APPLE_POOL_TARGET) return;
  if (applePoolWorkerInFlight) return;

  applePoolWorkerInFlight = runAppleAlbumPoolWorker()
    .catch(() => undefined)
    .finally(() => {
      applePoolWorkerInFlight = null;
      if (applePoolLatestConfig && isApplePoolConfigReady(applePoolLatestConfig) && readApplePool().length < APPLE_POOL_TARGET) {
        window.setTimeout(() => startAppleAlbumPool(applePoolLatestConfig!), 5_000);
      }
    });
}

export async function takeApplePoolAlbum(): Promise<RecommendationAlbum | null> {
  await syncAppleAlbumPoolFromNative().catch(() => undefined);
  const pool = filterPoolByUsed(readApplePool(), readApplePoolUsed());

  while (pool.length > 0) {
    const item = pool.shift()!;
    markApplePoolUsed(item.applePoolCandidateId);
    const resolved = await resolveApplePoolArtwork(item);
    writeApplePool(pool);
    await pushApplePoolStateToNative();
    if (resolved) return resolved;
    await deleteApplePoolCover(item.applePoolCoverPath);
  }

  writeApplePool([]);
  await pushApplePoolStateToNative();
  return null;
}

async function requestSingleLiveAlbum(config: LiveAlbumConfig): Promise<RecommendationAlbum> {
  const candidates = await loadLiveAlbumCandidates();
  let available = candidates.filter((candidate) => !usedLiveAlbumIds.has(candidate.id));
  if (available.length === 0) {
    usedLiveAlbumIds.clear();
    available = [...candidates];
  }
  if (!available.length) throw new Error('暂无可用实时专辑候选');

  const shuffled = available.sort(() => Math.random() - 0.5);
  const maxAttempts = Math.min(5, shuffled.length);
  for (const candidate of shuffled.slice(0, maxAttempts)) {
    usedLiveAlbumIds.add(candidate.id);
    const result = await getLiveAlbum(candidate, config, AbortSignal.timeout(config.timeoutMs || 45_000)).catch(() => null);
    if (result) return result;
  }

  throw new Error('专辑资料不完整');
}

export async function prefetchLiveAlbum(config: LiveAlbumConfig) {
  if (!config.apiKey.trim() || !config.model.trim() || prefetchedLiveAlbum || liveAlbumPrefetchInFlight) return;
  if (Date.now() < liveAlbumPrefetchCooldownUntil) return;
  const task = requestSingleLiveAlbum(config)
    .then((item) => {
      prefetchedLiveAlbum = item;
      return item;
    })
    .catch(() => {
      liveAlbumPrefetchCooldownUntil = Date.now() + 60_000;
      return null;
    });
  liveAlbumPrefetchInFlight = task;
  try {
    await task;
  } finally {
    if (liveAlbumPrefetchInFlight === task) liveAlbumPrefetchInFlight = null;
  }
}

export async function takeReadyLiveAlbum(config: LiveAlbumConfig): Promise<RecommendationAlbum | null> {
  if (!config.apiKey.trim() || !config.model.trim()) return null;
  if (Capacitor.isNativePlatform()) {
    const item = await takeApplePoolAlbum();
    if (item) return item;
  }
  if (prefetchedLiveAlbum) {
    const item = prefetchedLiveAlbum;
    prefetchedLiveAlbum = null;
    return item;
  }
  return null;
}

export function getLiveAlbumReserveStatus() {
  const poolCount = getAppleAlbumPoolCount();
  const nativeRunning = (() => {
    try {
      return window.localStorage.getItem(APPLE_POOL_RUNNING_KEY) === '1';
    } catch {
      return false;
    }
  })();
  return {
    ready: poolCount > 0 || Boolean(prefetchedLiveAlbum),
    loading: Boolean(liveAlbumPrefetchInFlight),
    running: nativeRunning || Boolean(liveAlbumPrefetchInFlight),
    cooldownUntil: liveAlbumPrefetchCooldownUntil,
  };
}

export async function getPrefetchedLiveAlbum(config: LiveAlbumConfig): Promise<RecommendationAlbum | null> {
  if (!config.apiKey.trim() || !config.model.trim()) return null;
  if (!prefetchedLiveAlbum) {
    if (!liveAlbumPrefetchInFlight) void prefetchLiveAlbum(config);
    await liveAlbumPrefetchInFlight;
  }
  const item = prefetchedLiveAlbum;
  prefetchedLiveAlbum = null;
  void prefetchLiveAlbum(config);
  return item;
}

async function requestPodcastLikeMiniProgram(candidates: PodcastCandidate[], history: string[]): Promise<RecommendationPodcast> {
  let available = candidates.filter((candidate) => !history.includes(`podcast-${candidate.id}`));
  if (!available.length) {
    resetHistory('podcast');
    available = [...candidates];
  }
  if (!available.length) throw new Error('暂无可用播客候选');

  const shuffled = available.sort(() => Math.random() - 0.5);
  const maxAttempts = Math.min(5, shuffled.length);
  for (const candidate of shuffled.slice(0, maxAttempts)) {
    const item = await getPodcast(candidate).catch(() => null);
    if (item) return item;
  }

  throw new Error('未能找到完整播客信息');
}

export function startPodcastPool() {
  // 播客池已关闭：现在按小程序云函数思路，用户触发时单路串行请求。
}

export async function prefetchPodcastInventory() {
  // 不再后台预取播客，避免 App 空闲时继续触发 Apple Search。
}

export async function getNextRecommendation(
  kind: 'album',
  fallbackCover: string,
): Promise<RecommendationAlbum>;
export async function getNextRecommendation(
  kind: 'podcast',
  fallbackCover: string,
): Promise<RecommendationPodcast>;
export async function getNextRecommendation(
  kind: RecommendationKind,
  fallbackCover: string,
): Promise<RecommendationAlbum | RecommendationPodcast> {
  if (kind === 'album') {
    void fallbackCover;
    const candidates = (await loadCatalog('album')) as AlbumCandidate[];
    if (candidates.length === 0) throw new Error('推荐库为空，请稍后重试');
    const item = getAlbum(chooseCandidate('album', candidates));
    recordHistory('album', item.id);
    return item;
  }

  const candidates = (await loadCatalog('podcast')) as PodcastCandidate[];
  if (candidates.length === 0) throw new Error('推荐库为空，请稍后重试');
  const item = await requestPodcastLikeMiniProgram(candidates, readHistory('podcast'));
  recordHistory('podcast', item.id);
  return item;
}
