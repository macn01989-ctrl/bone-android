import { Mic, Music2, Sparkles, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApiCapability, ApiInterfaceType, AppView } from './types';

export const SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions';
export const DEFAULT_POLISH_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

export const capabilityLabels: Record<ApiCapability, { title: string; hint: string; icon: LucideIcon }> = {
  speechToText: {
    title: '语音转文字',
    hint: '录音完成后把音频转换成文字。',
    icon: Mic,
  },
  albumIntro: {
    title: '专辑介绍',
    hint: '为随机专辑或手动收藏生成中文介绍。',
    icon: Sparkles,
  },
};

export const interfaceOptions: Array<{ value: ApiInterfaceType; label: string }> = [
  { value: 'openai-chat', label: 'OpenAI 兼容文本' },
  { value: 'openai-audio', label: 'OpenAI 兼容转写' },
  { value: 'ark-bot', label: '火山方舟 Bot' },
  { value: 'custom-http', label: '自定义 HTTP' },
];

export const placeholderViews: Record<
  Exclude<AppView, 'home' | 'settings' | 'note' | 'notes'>,
  { title: string; description: string; icon: LucideIcon }
> = {
  recorder: {
    title: '录音转写',
    description: '下一步移植：本地录音、语音转文字、润色、保存为笔记。',
    icon: Mic,
  },
  podcast: {
    title: '播客推荐',
    description: '后续移植：Apple 搜索、卡片翻转、播客收藏。',
    icon: Music2,
  },
  album: {
    title: '专辑推荐',
    description: '后续移植：随机专辑、Apple 搜索、专辑介绍 API、收藏。',
    icon: Music2,
  },
  favorites: {
    title: '收藏',
    description: '后续移植：专辑收藏、播客收藏、手动添加和封面选择。',
    icon: Star,
  },
};
