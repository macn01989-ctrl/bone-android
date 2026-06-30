import { page1Assets } from '../shared/assets';

export type PodcastEpisode = {
  title: string;
  date?: string;
};

export type DemoPodcast = {
  id?: string;
  title: string;
  author: string;
  platforms?: string;
  artworkUrl: string;
  episodes: PodcastEpisode[];
  timestamp: number;
};

export type DemoAlbum = {
  id?: string;
  albumTitle: string;
  albumArtist: string;
  artworkUrl: string;
  originalArtworkUrl?: string;
  albumIntro: string;
  collection?: 'rolling-stone-500' | 'chinese-rock' | 'apple-music' | '1001-albums';
  styleTags?: string[];
  releaseDate?: string;
  releaseYear?: number | null;
  label?: string;
  trackCount?: number | null;
  notableTracks?: string[];
  detail?: {
    introTitle?: string;
    shortIntro?: string;
    fullIntro?: string;
    whyKeep?: string;
    context?: string;
    soundCharacteristics?: string[];
  };
  timestamp: number;
};

export type AddTarget = 'album' | 'podcast';
export type CoverSource = 'system' | 'local';

export const podcastLoadingImage = '/kd/%E7%8E%9B%E4%B8%BD%E8%8E%B2.png';
export const albumLoadingImage = '/kd/%E5%9C%B0%E4%B8%8B%20(1)%20(1)%20(1).png';
export const podcastFallbackCover = page1Assets.b;
export const albumFallbackCover = page1Assets.fit;

export const demoPodcast: DemoPodcast = {
  title: 'The Daily',
  author: 'The New York Times',
  artworkUrl: podcastFallbackCover,
  timestamp: Date.now() - 300000,
  episodes: [
    { title: 'A quiet morning brief from the world outside', date: '2026-06-17' },
    { title: 'The people building a new language for work', date: '2026-06-16' },
    { title: 'A story about memory, cities, and sound', date: '2026-06-15' },
    { title: 'What changes when attention becomes scarce', date: '2026-06-14' },
    { title: 'A conversation on art, conflict, and repair', date: '2026-06-13' },
  ],
};

export const demoAlbum: DemoAlbum = {
  albumTitle: 'Kind of Blue',
  albumArtist: 'Miles Davis',
  artworkUrl: albumFallbackCover,
  timestamp: Date.now() - 600000,
  albumIntro:
    '《Kind of Blue》像一间被蓝光慢慢照亮的房间。它不急着展示复杂，而是把旋律、留白和即兴放在最自然的位置，让每一次进入都像重新听见空气的流动。这里先保留小程序中“完整介绍可滚动阅读”的卡片结构，真正的 API 生成内容会在后续功能阶段接入。',
};

export const demoAlbumFavorites: DemoAlbum[] = [
  demoAlbum,
  {
    albumTitle: 'Blue Train',
    albumArtist: 'John Coltrane',
    artworkUrl: albumFallbackCover,
    timestamp: Date.now() - 900000,
    albumIntro:
      '一张带着锐利线条和明亮推进感的爵士专辑。这里用作收藏墙 UI 占位，后续会替换为用户真实收藏和专辑介绍。',
  },
  {
    albumTitle: 'A Love Supreme',
    albumArtist: 'John Coltrane',
    artworkUrl: albumFallbackCover,
    timestamp: Date.now() - 1200000,
    albumIntro:
      '精神性、旋律和强烈的节奏感在这里聚合。当前只复刻展示形态，收藏数据稍后统一接入本地存储。',
  },
];

export const demoPodcastFavorites: DemoPodcast[] = [
  demoPodcast,
  {
    title: 'Radiolab',
    author: 'WNYC Studios',
    artworkUrl: podcastFallbackCover,
    timestamp: Date.now() - 1100000,
    episodes: [
      { title: 'A question opens a small hidden door', date: '2026-06-12' },
      { title: 'Listening closely to the edge of an idea', date: '2026-06-10' },
      { title: 'How one sound can change the whole room', date: '2026-06-08' },
    ],
  },
  {
    title: '99% Invisible',
    author: 'SiriusXM',
    artworkUrl: podcastFallbackCover,
    timestamp: Date.now() - 1500000,
    episodes: [
      { title: 'The shape of ordinary objects', date: '2026-06-11' },
      { title: 'A city hidden inside a sign', date: '2026-06-09' },
      { title: 'Designing the spaces between things', date: '2026-06-07' },
    ],
  },
];

export const albumFavoritesStorageKey = 'bone.album-favorites';
export const podcastFavoritesStorageKey = 'bone.podcast-favorites';

export function loadLocalFavorites<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocalFavorites<T>(key: string, items: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Keep the current session usable even when browser storage is unavailable.
  }
}

export function saveAlbumFavorite(album: DemoAlbum) {
  const current = loadLocalFavorites(albumFavoritesStorageKey, demoAlbumFavorites);
  const next = [
    { ...album, timestamp: Date.now() },
    ...current.filter((item) => item.albumTitle !== album.albumTitle),
  ];
  saveLocalFavorites(albumFavoritesStorageKey, next);
}

export function savePodcastFavorite(podcast: DemoPodcast) {
  const current = loadLocalFavorites(podcastFavoritesStorageKey, demoPodcastFavorites);
  const next = [
    { ...podcast, timestamp: Date.now() },
    ...current.filter((item) => item.title !== podcast.title),
  ];
  saveLocalFavorites(podcastFavoritesStorageKey, next);
}
