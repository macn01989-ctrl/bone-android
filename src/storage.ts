import { Preferences } from '@capacitor/preferences';
import type { ApiCapability, ApiConfig, AppSettings, BoneNote, MusicPlatform, PodcastPlatform } from './types';

const SETTINGS_KEY = 'bone.settings.v1';
const NOTES_KEY = 'bone.notes.v1';
const DEFAULT_API_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_ASR_MODEL = 'FunAudioLLM/SenseVoiceSmall';
const DEFAULT_POLISH_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';
const DISABLED_TEXT_MODELS = ['Qwen/Qwen3.6-35B-A3B', 'moonshotai/Kimi-K2.6'];

const apiDefaults: Record<ApiCapability, ApiConfig> = {
  speechToText: {
    enabled: false,
    interfaceType: 'openai-audio',
    baseUrl: DEFAULT_API_BASE_URL,
    apiKey: '',
    model: DEFAULT_ASR_MODEL,
    timeoutMs: 600000,
    provider: 'siliconflow',
    resourceId: '',
  },
  albumIntro: {
    enabled: false,
    interfaceType: 'openai-chat',
    baseUrl: DEFAULT_API_BASE_URL,
    apiKey: '',
    model: DEFAULT_POLISH_MODEL,
    timeoutMs: 120000,
  },
};

export const defaultSettings: AppSettings = {
  api: apiDefaults,
  polishModel: DEFAULT_POLISH_MODEL,
  albumIntroModel: DEFAULT_POLISH_MODEL,
  podcastPlatform: 'xiaoyuzhou',
  musicPlatform: 'netease',
  diaryPrivacyEnabled: true,
  includeApiKeysInBackup: false,
  backupMode: 'merge',
};

const podcastPlatforms: PodcastPlatform[] = ['xiaoyuzhou', 'apple-podcasts'];
const musicPlatforms: MusicPlatform[] = ['netease', 'spotify', 'apple-music', 'qq-music'];

const localFallback = {
  getItem(key: string) {
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    return normalizeSettings(value);
  } catch {
    return normalizeSettings(localFallback.getItem(SETTINGS_KEY));
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const value = JSON.stringify(settings);

  try {
    await Preferences.set({ key: SETTINGS_KEY, value });
  } catch {
    localFallback.setItem(SETTINGS_KEY, value);
  }
}

export async function loadNotes(): Promise<BoneNote[]> {
  try {
    const { value } = await Preferences.get({ key: NOTES_KEY });
    return normalizeNotes(value);
  } catch {
    return normalizeNotes(localFallback.getItem(NOTES_KEY));
  }
}

export async function saveNotes(notes: BoneNote[]): Promise<void> {
  const value = JSON.stringify(notes);

  try {
    await Preferences.set({ key: NOTES_KEY, value });
  } catch {
    localFallback.setItem(NOTES_KEY, value);
  }
}

export function createNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortNotes(notes: BoneNote[]): BoneNote[] {
  const colorOrder: NonNullable<BoneNote['pinnedColor']>[] = ['blue', 'red', 'yellow'];
  const usedPinnedColors = new Set<NonNullable<BoneNote['pinnedColor']>>();
  const normalized = notes.map((note) => {
    if (!note.pinned) {
      return note.pinnedColor ? { ...note, pinnedColor: undefined } : note;
    }

    const nextColor =
      note.pinnedColor && !usedPinnedColors.has(note.pinnedColor)
        ? note.pinnedColor
        : colorOrder.find((color) => !usedPinnedColors.has(color));

    if (!nextColor) {
      return { ...note, pinned: false, pinnedColor: undefined };
    }

    usedPinnedColors.add(nextColor);
    return note.pinnedColor === nextColor ? note : { ...note, pinnedColor: nextColor };
  });

  return normalized.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) {
      return colorOrder.indexOf(a.pinnedColor || 'blue') - colorOrder.indexOf(b.pinnedColor || 'blue');
    }
    return b.updatedAt - a.updatedAt;
  });
}

export function getAllTags(notes: BoneNote[]): string[] {
  return Array.from(new Set(notes.flatMap((note) => note.tags)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

export function scrubApiKeys(settings: AppSettings): AppSettings {
  return {
    ...settings,
    api: {
      speechToText: { ...settings.api.speechToText, apiKey: '' },
      albumIntro: { ...settings.api.albumIntro, apiKey: '' },
    },
    includeApiKeysInBackup: false,
  };
}

function normalizeSettings(raw: string | null): AppSettings {
  if (!raw) return defaultSettings;

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    // Migrate legacy zhipu ASR settings to unified siliconflow ASR settings.
    const legacySpeech = parsed.api?.speechToText;
    const migratedSpeech: Partial<ApiConfig> = legacySpeech
      ? {
          ...legacySpeech,
          baseUrl:
            legacySpeech.baseUrl?.includes('open.bigmodel.cn')
              ? DEFAULT_API_BASE_URL
              : legacySpeech.baseUrl || DEFAULT_API_BASE_URL,
          model:
            legacySpeech.model === 'glm-asr-2512' || !legacySpeech.model?.trim()
              ? DEFAULT_ASR_MODEL
              : legacySpeech.model,
          provider: 'siliconflow',
          timeoutMs: legacySpeech.timeoutMs || defaultSettings.api.speechToText.timeoutMs,
        }
      : {};

    return {
      ...defaultSettings,
      ...parsed,
      polishModel:
        typeof parsed.polishModel === 'string' && parsed.polishModel.trim() && !DISABLED_TEXT_MODELS.includes(parsed.polishModel.trim())
          ? parsed.polishModel.trim()
          : defaultSettings.polishModel,
      albumIntroModel:
        typeof parsed.albumIntroModel === 'string' && parsed.albumIntroModel.trim() && !DISABLED_TEXT_MODELS.includes(parsed.albumIntroModel.trim())
          ? parsed.albumIntroModel.trim()
          : defaultSettings.albumIntroModel,
      podcastPlatform: podcastPlatforms.includes(parsed.podcastPlatform as PodcastPlatform)
        ? (parsed.podcastPlatform as PodcastPlatform)
        : defaultSettings.podcastPlatform,
      musicPlatform: musicPlatforms.includes(parsed.musicPlatform as MusicPlatform)
        ? (parsed.musicPlatform as MusicPlatform)
        : defaultSettings.musicPlatform,
      diaryPrivacyEnabled:
        typeof parsed.diaryPrivacyEnabled === 'boolean'
          ? parsed.diaryPrivacyEnabled
          : defaultSettings.diaryPrivacyEnabled,
      api: {
        speechToText: {
          ...defaultSettings.api.speechToText,
          ...parsed.api?.speechToText,
          ...migratedSpeech,
          enabled: Boolean(parsed.api?.speechToText?.apiKey?.trim()) || Boolean(parsed.api?.speechToText?.enabled),
        },
        albumIntro: {
          ...defaultSettings.api.albumIntro,
          ...parsed.api?.albumIntro,
          enabled: Boolean(parsed.api?.albumIntro?.apiKey?.trim()) || Boolean(parsed.api?.albumIntro?.enabled),
        },
      },
    };
  } catch {
    return defaultSettings;
  }
}

export function normalizeNotes(raw: string | null): BoneNote[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<BoneNote>[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((note) => note && typeof note.id === 'string')
      .map((note) => ({
        id: note.id || createNoteId(),
        title: note.title || '',
        content: note.content || '',
        tags: Array.isArray(note.tags) ? note.tags.filter(Boolean) : [],
        images: Array.isArray(note.images)
          ? note.images.filter((image) => image && image.dataUrl)
          : [],
        audio: note.audio && note.audio.dataUrl ? note.audio : undefined,
        createdAt: Number(note.createdAt) || Date.now(),
        updatedAt: Number(note.updatedAt) || Number(note.createdAt) || Date.now(),
        pinned: Boolean(note.pinned),
        pinnedColor: note.pinnedColor,
      }));
  } catch {
    return [];
  }
}
