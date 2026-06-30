export type AppView =
  | 'home'
  | 'note'
  | 'recorder'
  | 'notes'
  | 'podcast'
  | 'album'
  | 'favorites'
  | 'settings';

export type ApiCapability = 'speechToText' | 'albumIntro';

export type ApiInterfaceType =
  | 'openai-chat'
  | 'openai-audio'
  | 'ark-bot-chat'
  | 'ark-bot'
  | 'custom-http';

export type SpeechProvider = 'siliconflow' | 'doubao' | 'zhipu' | 'volcengine';

export type ApiConfig = {
  enabled: boolean;
  interfaceType: ApiInterfaceType;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  provider?: SpeechProvider;
  resourceId?: string;
};

export type ApiSettings = Record<ApiCapability, ApiConfig>;

export type PodcastPlatform = 'xiaoyuzhou' | 'apple-podcasts';

export type MusicPlatform = 'netease' | 'spotify' | 'apple-music' | 'qq-music';

export type AppSettings = {
  api: ApiSettings;
  polishModel: string;
  albumIntroModel: string;
  podcastPlatform: PodcastPlatform;
  musicPlatform: MusicPlatform;
  diaryPrivacyEnabled: boolean;
  includeApiKeysInBackup: boolean;
  backupMode: 'merge' | 'replace';
};

export type NoteImage = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  createdAt: number;
};

export type NoteAudio = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
};

export type BoneNote = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  images: NoteImage[];
  audio?: NoteAudio;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  pinnedColor?: 'blue' | 'red' | 'yellow';
};

export type BackupManifest = {
  app: 'bone-android';
  version: 1;
  exportedAt: string;
  includesApiKeys: boolean;
  counts: {
    notes: number;
    favorites: number;
    files: number;
  };
};
