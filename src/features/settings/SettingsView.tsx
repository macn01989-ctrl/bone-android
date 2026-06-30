import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Copy, Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { buildSettingsBackup, downloadBlob, readSettingsFromBackup, restoreFavoritesFromBackup } from '../../services/backup';
import { getAppleAlbumPoolCount, getLiveAlbumReserveStatus } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';
import type { ApiCapability, ApiConfig, AppSettings, BoneNote, MusicPlatform, PodcastPlatform } from '../../shared/types';
import { ApiPanel } from './ApiPanel';

const SILICONFLOW_CHAT_COMPLETIONS_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions';
const VOLCANO_ALBUM_INTRO_URL = 'https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions';
const DEFAULT_ALBUM_INTRO_MODEL = 'bot-20250612194641-hvrdt';

const speechModels = ['FunAudioLLM/SenseVoiceSmall'];
const polishModels = [
  'deepseek-ai/DeepSeek-V4-Pro',
  'deepseek-ai/DeepSeek-V4-Flash',
  'MiniMaxAI/MiniMax-M2.5',
  'nex-agi/Nex-N2-Pro',
  'zai-org/GLM-5.2',
];
const disabledTextModels = ['Qwen/Qwen3.6-35B-A3B', 'moonshotai/Kimi-K2.6'];

const podcastPlatforms: Array<{ value: PodcastPlatform; label: string; hint: string; tone: string }> = [
  { value: 'xiaoyuzhou', label: '小宇宙', hint: '默认播客平台，点击前自动复制节目名。', tone: 'xiaoyuzhou' },
  { value: 'apple-podcasts', label: 'Apple Podcasts', hint: '打开播客搜索页，适合苹果生态。', tone: 'apple-podcasts' },
];

const musicPlatforms: Array<{ value: MusicPlatform; label: string; hint: string; tone: string }> = [
  { value: 'netease', label: '网易云音乐', hint: '默认音乐平台，点击前自动复制音乐人和专辑名。', tone: 'netease' },
  { value: 'spotify', label: 'Spotify', hint: '直接触发 Spotify 搜索并填入名称。', tone: 'spotify' },
  { value: 'apple-music', label: 'Apple Music', hint: '打开 Apple Music 搜索。', tone: 'apple-music' },
  { value: 'qq-music', label: 'QQ 音乐', hint: '打开 QQ 音乐搜索。', tone: 'qq-music' },
];

const albumCollectionLabels: Record<string, string> = {
  'rolling-stone-500': 'Rolling Stone 500',
  'chinese-rock': '中国乐队专辑',
  '1001-albums': '1001 Albums',
  'apple-music': 'Apple 实时专辑',
  unknown: '其他合集',
};

type AlbumCollectionCount = {
  label: string;
  count: number;
};

type ModelCheckResult = {
  label: string;
  ok: boolean;
  message: string;
};

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function selectedPodcastPlatform(value: PodcastPlatform) {
  return podcastPlatforms.find((option) => option.value === value) ?? podcastPlatforms[0];
}

function selectedMusicPlatform(value: MusicPlatform) {
  return musicPlatforms.find((option) => option.value === value) ?? musicPlatforms[0];
}

async function assertOk(response: Response, label: string) {
  if (response.ok) return;
  const text = await response.text().catch(() => '');
  throw new Error(`${label} ${response.status}${text ? `: ${text.slice(0, 90)}` : ''}`);
}

async function checkSpeechModel(apiKey: string, model: string) {
  const source = await fetch('/assets/asr-connectivity-test.wav');
  await assertOk(source, 'test audio');
  const blob = await source.blob();
  const formData = new FormData();
  formData.append('file', new File([blob], 'asr-connectivity-test.wav', { type: blob.type || 'audio/wav' }));
  formData.append('model', model);

  const response = await fetch(SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  await assertOk(response, 'speech api');
}

async function checkChatModel(apiKey: string, model: string) {
  const response = await fetch(SILICONFLOW_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是连通性测试助手。请只回复 OK。' },
        { role: 'user', content: '测试' },
      ],
      temperature: 0,
    }),
    signal: AbortSignal.timeout(30000),
  });
  await assertOk(response, 'chat api');
}

async function checkAlbumModel(apiKey: string, model: string, baseUrl: string, timeoutMs: number) {
  const response = await fetch(baseUrl || VOLCANO_ALBUM_INTRO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: '请只回复 OK。' },
      ],
      temperature: 0,
    }),
    signal: AbortSignal.timeout(timeoutMs || 30000),
  });
  await assertOk(response, 'album api');
}

export function SettingsView({
  settings,
  notes,
  onBack,
  onSave,
  onRestoreNotes,
  onToast,
}: {
  settings: AppSettings;
  notes: BoneNote[];
  onBack: () => void;
  onSave: (settings: AppSettings, message?: string) => Promise<void>;
  onRestoreNotes: (notes: BoneNote[], mode: AppSettings['backupMode']) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupName = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `bone-backup-${stamp}.zip`;
  }, []);
  const albumIntroModel = settings.api.albumIntro.model || settings.albumIntroModel || DEFAULT_ALBUM_INTRO_MODEL;
  const speechModelOptions = useMemo(
    () => uniqueOptions([settings.api.speechToText.model, ...speechModels]),
    [settings.api.speechToText.model],
  );
  const polishModelOptions = useMemo(
    () => uniqueOptions([settings.polishModel, ...polishModels]).filter((model) => !disabledTextModels.includes(model)),
    [settings.polishModel],
  );
  const albumModelOptions = useMemo(
    () => uniqueOptions([albumIntroModel, DEFAULT_ALBUM_INTRO_MODEL]),
    [albumIntroModel],
  );
  const [albumCollections, setAlbumCollections] = useState<AlbumCollectionCount[]>([]);
  const [appleReserveStatus, setAppleReserveStatus] = useState<'idle' | 'running' | 'ready'>('idle');
  const [checkingModels, setCheckingModels] = useState(false);
  const [modelCheckResults, setModelCheckResults] = useState<ModelCheckResult[]>([]);
  const currentPodcastPlatform = selectedPodcastPlatform(settings.podcastPlatform);
  const currentMusicPlatform = selectedMusicPlatform(settings.musicPlatform);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void fetch('/recommendations/album-catalog.json')
        .then((response) => response.json())
        .then((catalog: Array<{ collection?: string }>) => {
          if (cancelled || !Array.isArray(catalog)) return;
          const counts = catalog.reduce<Record<string, number>>((acc, item) => {
            const collection = item.collection || 'unknown';
            acc[collection] = (acc[collection] || 0) + 1;
            return acc;
          }, {});
          setAlbumCollections(
            Object.entries(counts).map(([collection, count]) => ({
              label: albumCollectionLabels[collection] || collection,
              count,
            })),
          );
        })
        .catch(() => undefined);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const refreshStatus = () => {
      const status = getLiveAlbumReserveStatus();
      const poolCount = getAppleAlbumPoolCount();
      setAppleReserveStatus(status.ready || poolCount > 0 ? 'ready' : status.running ? 'running' : 'idle');
    };

    refreshStatus();
    const timer = window.setInterval(refreshStatus, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const updateApi = (capability: ApiCapability, patch: Partial<ApiConfig>) => {
    void onSave(
      {
        ...settings,
        api: {
          ...settings.api,
          [capability]: {
            ...settings.api[capability],
            ...patch,
          },
        },
      },
      '配置已保存',
    );
  };

  const saveSiliconFlowKey = (apiKey: string) => {
    void onSave({
      ...settings,
      api: {
        ...settings.api,
        speechToText: {
          ...settings.api.speechToText,
          apiKey,
          enabled: apiKey.trim().length > 0,
        },
      },
    });
  };

  const saveVolcanoKey = (apiKey: string) => {
    void onSave({
      ...settings,
      api: {
        ...settings.api,
        albumIntro: {
          ...settings.api.albumIntro,
          apiKey,
          enabled: apiKey.trim().length > 0,
          connected: false,
          lastError: '',
          lastCheckedAt: 0,
          baseUrl: VOLCANO_ALBUM_INTRO_URL,
          model: albumIntroModel,
        },
      },
    });
  };

  const copyApiKey = async (apiKey: string) => {
    if (!apiKey.trim()) {
      onToast('没有可复制的 API Key');
      return;
    }

    await writeTextToClipboard(apiKey);
    onToast('已复制');
  };

  const runModelCheck = async () => {
    const siliconFlowKey = settings.api.speechToText.apiKey.trim();
    const volcanoKey = settings.api.albumIntro.apiKey.trim();

    if (!siliconFlowKey) {
      onToast('请先填写 SiliconFlow API Key');
      return;
    }

    if (!volcanoKey) {
      onToast('请先填写火山方舟 API Key');
      return;
    }

    setCheckingModels(true);
    setModelCheckResults([]);

    const results: ModelCheckResult[] = [];
    const run = async (label: string, task: () => Promise<void>) => {
      try {
        await task();
        results.push({ label, ok: true, message: '成功' });
      } catch (error) {
        results.push({
          label,
          ok: false,
          message: error instanceof Error && error.message ? error.message : '请求失败',
        });
      }
      setModelCheckResults([...results]);
    };

    const speechModel = settings.api.speechToText.model || speechModels[0];
    const polishModel = settings.polishModel || polishModels[0];
    const albumModel = albumIntroModel;

    await run(`语音转文字 · ${speechModel}`, () => checkSpeechModel(siliconFlowKey, speechModel));
    await run(`文本润色 · ${polishModel}`, () => checkChatModel(siliconFlowKey, polishModel));
    await run(`专辑整理 · ${albumModel}`, () =>
      checkAlbumModel(
        volcanoKey,
        albumModel,
        settings.api.albumIntro.baseUrl || VOLCANO_ALBUM_INTRO_URL,
        settings.api.albumIntro.timeoutMs ?? 0,
      ),
    );

    const albumResult = results.find((result) => result.label.startsWith('专辑整理'));
    const albumConnected = Boolean(albumResult?.ok);
    await onSave(
      {
        ...settings,
        api: {
          ...settings.api,
          albumIntro: {
            ...settings.api.albumIntro,
            connected: albumConnected,
            lastError: albumConnected ? '' : albumResult?.message || '专辑详情模型检查失败',
            lastCheckedAt: Date.now(),
            model: albumModel,
            baseUrl: settings.api.albumIntro.baseUrl || VOLCANO_ALBUM_INTRO_URL,
          },
        },
      },
      albumConnected ? '专辑详情模型已连上' : '专辑详情模型未连上',
    );

    const failedCount = results.filter((result) => !result.ok).length;
    onToast(failedCount ? `模型检查完成：${failedCount} 项失败` : '三个模型都能运行');
    setCheckingModels(false);
  };

  const handleExport = async () => {
    const backup = await buildSettingsBackup(settings, settings.includeApiKeysInBackup, notes);
    downloadBlob(backup, backupName);
    onToast('备份包已生成');
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;

    try {
      const imported = await readSettingsFromBackup(file);
      const mode = settings.backupMode;
      await onSave(
        {
          ...settings,
          ...imported.settings,
          api: {
            ...settings.api,
            ...imported.settings.api,
          },
          includeApiKeysInBackup: false,
          backupMode: mode,
        },
        '配置已从备份导入',
      );

      if (imported.notes.length > 0) {
        await onRestoreNotes(imported.notes, mode);
      }
      if (imported.favorites) {
        await restoreFavoritesFromBackup(imported.favorites, mode);
      }
      onToast(mode === 'replace' ? '已覆盖恢复备份' : '已合并恢复备份');
    } catch (error) {
      onToast(error instanceof Error ? error.message : '导入失败');
    }
  };

  return (
    <section className="settings-screen">
      <header className="top-bar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="返回主页">
          <ChevronLeft size={26} />
        </button>
        <h1>设置</h1>
        <div className="top-spacer" />
      </header>

      <div className="settings-content settings-redesign-content">
        <section className="settings-hero-card">
          <div className="settings-hero-head">
            <div>
              <h2>硅基流动 API</h2>
              <p>
                API Key 可控制本软件所有需要模型。你可以在硅基流动控制台创建或查看 API Key：
                <a href="https://cloud.siliconflow.cn/account/ak" target="_blank" rel="noreferrer">
                  {' 获取 API Key'}
                </a>
              </p>
            </div>
          </div>

          <label className="settings-modern-field api-key-field">
            <span>硅基流动 API Key</span>
            <div className="api-key-control-row">
              <input
                type="password"
                value={settings.api.speechToText.apiKey}
                onChange={(event) => saveSiliconFlowKey(event.target.value)}
                placeholder="填入 SiliconFlow API Key"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="api-key-action"
                type="button"
                onClick={() => void copyApiKey(settings.api.speechToText.apiKey)}
              >
                <Copy size={16} />
                <span>复制</span>
              </button>
              <button className="api-key-action danger" type="button" onClick={() => saveSiliconFlowKey('')}>
                <Trash2 size={16} />
                <span>清空</span>
              </button>
            </div>
          </label>

          <div className="settings-model-grid">
            <label className="settings-modern-field">
              <span>语音转文字模型</span>
              <select
                value={settings.api.speechToText.model}
                onChange={(event) =>
                  void onSave(
                    {
                      ...settings,
                      api: {
                        ...settings.api,
                        speechToText: {
                          ...settings.api.speechToText,
                          model: event.target.value,
                        },
                      },
                    },
                    '语音模型已保存',
                  )
                }
              >
                {speechModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-modern-field">
              <span>文本润色模型</span>
              <select
                value={settings.polishModel}
                onChange={(event) => void onSave({ ...settings, polishModel: event.target.value }, '润色模型已保存')}
              >
                {polishModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="settings-hero-card volcano-section">
          <div className="settings-volcano-head">
            <h2>火山方舟 API</h2>
            <p>
              专辑介绍与风格标签使用火山联网 Bot。先在火山方舟获取 API Key 并确认 Bot 配置：
              <a href="https://www.volcengine.com/docs/82379/1541594?lang=zh" target="_blank" rel="noreferrer">
                {' 获取火山 API Key'}
              </a>
            </p>
          </div>

          <label className="settings-modern-field api-key-field">
            <span>火山方舟 API Key</span>
            <div className="api-key-control-row">
              <input
                type="password"
                value={settings.api.albumIntro.apiKey}
                onChange={(event) => saveVolcanoKey(event.target.value)}
                placeholder="填入火山方舟 API Key"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="api-key-action"
                type="button"
                onClick={() => void copyApiKey(settings.api.albumIntro.apiKey)}
              >
                <Copy size={16} />
                <span>复制</span>
              </button>
              <button className="api-key-action danger" type="button" onClick={() => saveVolcanoKey('')}>
                <Trash2 size={16} />
                <span>清空</span>
              </button>
            </div>
          </label>

          <label className="settings-modern-field">
            <span>专辑整理 Bot ID</span>
            <select
              value={albumIntroModel}
              onChange={(event) =>
                void onSave(
                  {
                    ...settings,
                    albumIntroModel: event.target.value,
                    api: {
                      ...settings.api,
                      albumIntro: {
                        ...settings.api.albumIntro,
                        model: event.target.value,
                        baseUrl: VOLCANO_ALBUM_INTRO_URL,
                      },
                    },
                  },
                  '专辑模型已保存',
                )
              }
            >
              {albumModelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>

          <div className="settings-hero-actions">
            <button type="button" onClick={() => void runModelCheck()} disabled={checkingModels}>
              <RefreshCw size={18} />
              <span>{checkingModels ? '正在检查模型...' : '检查模型连通性'}</span>
            </button>
          </div>

          {modelCheckResults.length > 0 && (
            <div className="model-connectivity-results">
              {modelCheckResults.map((result) => (
                <div className={`model-connectivity-row ${result.ok ? 'ok' : 'fail'}`} key={result.label}>
                  <strong>{result.label}</strong>
                  <span>{result.ok ? '成功' : result.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settings-section settings-platform-card">
          <div className="settings-section-head">
            <div>
              <h2>默认跳转平台</h2>
              <p>这里改完后，播客/专辑卡片上的按钮文字和平台标识会同步变化。</p>
            </div>
          </div>

          <div className="platform-picker-block">
            <div className="platform-picker-title">
              <span>播客</span>
              <strong>{currentPodcastPlatform.label}</strong>
            </div>
            <div className="platform-choice-grid podcast-platforms">
              {podcastPlatforms.map((platform) => (
                <button
                  className={`platform-choice ${settings.podcastPlatform === platform.value ? 'active' : ''} ${platform.tone}`}
                  key={platform.value}
                  type="button"
                  onClick={() =>
                    void onSave({ ...settings, podcastPlatform: platform.value }, `播客默认平台已切换为${platform.label}`)
                  }
                >
                  <span>{platform.label}</span>
                  <small>{platform.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="platform-picker-block">
            <div className="platform-picker-title">
              <span>音乐专辑</span>
              <strong>{currentMusicPlatform.label}</strong>
            </div>
            <div className="platform-choice-grid music-platforms">
              {musicPlatforms.map((platform) => (
                <button
                  className={`platform-choice ${settings.musicPlatform === platform.value ? 'active' : ''} ${platform.tone}`}
                  key={platform.value}
                  type="button"
                  onClick={() =>
                    void onSave({ ...settings, musicPlatform: platform.value }, `专辑默认平台已切换为${platform.label}`)
                  }
                >
                  <span>{platform.label}</span>
                  <small>{platform.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section settings-status-section">
          <div className="settings-status-title-row">
            <h2>本地内容</h2>
          </div>
          <div className="album-collection-list">
            <div className="album-collection-row">
              <span>
                苹果专辑
                {appleReserveStatus === 'ready'
                  ? ' · 已就绪'
                  : appleReserveStatus === 'running'
                    ? ' · 准备中'
                    : ' · 待启动'}
              </span>
              <i className={`apple-status-dot ${appleReserveStatus}`} />
            </div>
            <div className="album-collection-title">已经拥有的专辑合集</div>
            {albumCollections.length > 0 ? (
              albumCollections.map((collection) => (
                <div className="album-collection-row" key={collection.label}>
                  <span>{collection.label}</span>
                  <strong>{collection.count}</strong>
                </div>
              ))
            ) : (
              <div className="album-collection-row">
                <span>读取中</span>
                <strong>...</strong>
              </div>
            )}
          </div>
        </section>

        <section className="settings-section diary-privacy-card">
          <div>
            <h2>日记隐私</h2>
            <p>开启后，带“日记”标签的笔记只会在笔记页明确筛选“日记”时显示。</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.diaryPrivacyEnabled}
              onChange={(event) =>
                void onSave(
                  { ...settings, diaryPrivacyEnabled: event.target.checked },
                  event.target.checked ? '日记隐私保护已开启' : '日记将显示在普通笔记墙中',
                )
              }
            />
            <span />
          </label>
        </section>

        <section className="settings-section">
          <h2>API 配置</h2>
          <div className="api-grid">
            {(Object.keys(settings.api) as ApiCapability[]).map((capability) => (
              <ApiPanel
                key={capability}
                capability={capability}
                config={settings.api[capability]}
                onChange={(patch) => updateApi(capability, patch)}
                onToast={onToast}
              />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>Apple 搜索</h2>
          <div className="locked-row">
            <Check size={20} />
            <span>iTunes Search API 已内置，用于专辑、播客、封面搜索，不需要填写 Key。</span>
          </div>
        </section>

        <section className="settings-section">
          <h2>备份与恢复</h2>
          <div className="backup-grid">
            <button className="action-tile" type="button" onClick={handleExport}>
              <Download size={22} />
              <small>生成 zip 备份文件</small>
              <span>导出备份</span>
            </button>
            <button className="action-tile" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={22} />
              <small>选择 Bone 备份 zip 文件</small>
              <span>导入恢复</span>
            </button>
          </div>

          <div className="settings-toggle-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.includeApiKeysInBackup}
                onChange={(event) =>
                  void onSave({
                    ...settings,
                    includeApiKeysInBackup: event.target.checked,
                  })
                }
              />
              <span />
            </label>
            <span>备份 API Key</span>
          </div>

          <div className="segmented">
            <button
              className={settings.backupMode === 'merge' ? 'selected' : ''}
              type="button"
              onClick={() => void onSave({ ...settings, backupMode: 'merge' })}
            >
              合并恢复
            </button>
            <button
              className={settings.backupMode === 'replace' ? 'selected' : ''}
              type="button"
              onClick={() => void onSave({ ...settings, backupMode: 'replace' })}
            >
              覆盖恢复
            </button>
          </div>

          <p className="backup-mode-help">合并恢复会保留当前内容并补入备份；覆盖恢复会用备份内容替换当前笔记和收藏。</p>

          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </section>
      </div>
    </section>
  );
}
