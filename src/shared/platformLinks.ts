import type { MusicPlatform, PodcastPlatform } from './types';

type PlatformOption<T extends string> = {
  value: T;
  label: string;
  buttonLabel: string;
  hint: string;
  tone: string;
};

export const podcastPlatformOptions: Array<PlatformOption<PodcastPlatform>> = [
  {
    value: 'xiaoyuzhou',
    label: '小宇宙',
    buttonLabel: '在小宇宙打开',
    hint: '点击前自动复制节目名。',
    tone: 'xiaoyuzhou',
  },
  {
    value: 'apple-podcasts',
    label: 'Apple Podcasts',
    buttonLabel: '在 Apple Podcasts 搜索',
    hint: '打开播客搜索页，适合苹果生态。',
    tone: 'apple-podcasts',
  },
];

export const musicPlatformOptions: Array<PlatformOption<MusicPlatform>> = [
  {
    value: 'netease',
    label: '网易云音乐',
    buttonLabel: '在网易云音乐打开',
    hint: '点击前自动复制音乐人和专辑名。',
    tone: 'netease',
  },
  {
    value: 'spotify',
    label: 'Spotify',
    buttonLabel: '在 Spotify 搜索',
    hint: '直接触发 Spotify 搜索。',
    tone: 'spotify',
  },
  {
    value: 'apple-music',
    label: 'Apple Music',
    buttonLabel: '在 Apple Music 搜索',
    hint: '打开 Apple Music 搜索。',
    tone: 'apple-music',
  },
  {
    value: 'qq-music',
    label: 'QQ 音乐',
    buttonLabel: '在 QQ 音乐搜索',
    hint: '打开 QQ 音乐搜索。',
    tone: 'qq-music',
  },
];

export function getPodcastPlatformOption(value: PodcastPlatform) {
  return podcastPlatformOptions.find((option) => option.value === value) ?? podcastPlatformOptions[0];
}

export function getMusicPlatformOption(value: MusicPlatform) {
  return musicPlatformOptions.find((option) => option.value === value) ?? musicPlatformOptions[0];
}

export function openPlatformSearch(platform: MusicPlatform | PodcastPlatform, query: string) {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) return;

  const urls: Record<MusicPlatform | PodcastPlatform, string> = {
    xiaoyuzhou: 'cosmos://page.cos/discover',
    'apple-podcasts': `https://podcasts.apple.com/search?term=${encoded}`,
    netease: `https://music.163.com/#/search/m/?s=${encoded}`,
    spotify: `https://open.spotify.com/search/${encoded}`,
    'apple-music': `https://music.apple.com/search?term=${encoded}`,
    'qq-music': `https://y.qq.com/n/ryqq/search?w=${encoded}`,
  };

  window.location.href = urls[platform];
}
