import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode, TouchEvent } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  DatabaseBackup,
  Download,
  Mic,
  Music2,
  Save,
  Settings,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildSettingsBackup, downloadBlob, readSettingsFromBackup } from './backup';
import {
  createNoteId,
  defaultSettings,
  getAllTags,
  loadNotes,
  loadSettings,
  saveNotes,
  saveSettings,
  sortNotes,
} from './storage';
import type {
  ApiCapability,
  ApiConfig,
  ApiInterfaceType,
  AppSettings,
  AppView,
  BoneNote,
  NoteAudio,
  NoteImage,
} from './types';

const page1Assets = {
  fit: '/kd/fit.jpg',
  black: '/kd/%E9%BB%91.jpg',
  white: '/kd/%E7%99%BD.png',
  yellow: '/kd/%E9%BB%84.png',
  blue: '/kd/%E8%93%9D.png',
  red: '/kd/%E7%BA%A2.jpg',
  b: '/kd/B.jpg',
};

const fitImage = page1Assets.fit;
const SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions';
const DEFAULT_POLISH_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

const capabilityLabels: Record<ApiCapability, { title: string; hint: string; icon: LucideIcon }> = {
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

const interfaceOptions: Array<{ value: ApiInterfaceType; label: string }> = [
  { value: 'openai-chat', label: 'OpenAI 兼容文本' },
  { value: 'openai-audio', label: 'OpenAI 兼容转写' },
  { value: 'ark-bot', label: '火山方舟 Bot' },
  { value: 'custom-http', label: '自定义 HTTP' },
];

const placeholderViews: Record<
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

type TouchState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  rotation: number;
  active: boolean;
  longPress: boolean;
  tap: boolean;
};

type GestureSnapshot = {
  isDown: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

const initialTouch: TouchState = {
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  rotation: 0,
  active: false,
  longPress: false,
  tap: false,
};

type RecommendationDirection = '' | 'left' | 'right' | 'up' | 'down';

type RecommendationTouchState = {
  startX: number;
  startY: number;
  startTime: number;
  swipeDetected: boolean;
};

type PodcastEpisode = {
  title: string;
  date?: string;
};

type DemoPodcast = {
  title: string;
  author: string;
  artworkUrl: string;
  episodes: PodcastEpisode[];
  timestamp: number;
};

type DemoAlbum = {
  albumTitle: string;
  albumArtist: string;
  artworkUrl: string;
  albumIntro: string;
  timestamp: number;
};

type AddTarget = 'album' | 'podcast';
type CoverSource = 'system' | 'local';

const podcastLoadingImage = '/kd/%E7%8E%9B%E4%B8%BD%E8%8E%B2.png';
const albumLoadingImage = '/kd/%E5%9C%B0%E4%B8%8B%20(1)%20(1)%20(1).png';
const podcastFallbackCover = page1Assets.b;
const albumFallbackCover = page1Assets.fit;

const demoPodcast: DemoPodcast = {
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

const demoAlbum: DemoAlbum = {
  albumTitle: 'Kind of Blue',
  albumArtist: 'Miles Davis',
  artworkUrl: albumFallbackCover,
  timestamp: Date.now() - 600000,
  albumIntro:
    '《Kind of Blue》像一间被蓝光慢慢照亮的房间。它不急着展示复杂，而是把旋律、留白和即兴放在最自然的位置，让每一次进入都像重新听见空气的流动。这里先保留小程序中“完整介绍可滚动阅读”的卡片结构，真正的 API 生成内容会在后续功能阶段接入。',
};

const demoAlbumFavorites: DemoAlbum[] = [
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

const demoPodcastFavorites: DemoPodcast[] = [
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

const albumFavoritesStorageKey = 'bone.album-favorites';
const podcastFavoritesStorageKey = 'bone.podcast-favorites';

function loadLocalFavorites<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalFavorites<T>(key: string, items: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Keep the current session usable even when browser storage is unavailable.
  }
}

function saveAlbumFavorite(album: DemoAlbum) {
  const current = loadLocalFavorites(albumFavoritesStorageKey, demoAlbumFavorites);
  const next = [
    { ...album, timestamp: Date.now() },
    ...current.filter((item) => item.albumTitle !== album.albumTitle),
  ];
  saveLocalFavorites(albumFavoritesStorageKey, next);
}

function savePodcastFavorite(podcast: DemoPodcast) {
  const current = loadLocalFavorites(podcastFavoritesStorageKey, demoPodcastFavorites);
  const next = [
    { ...podcast, timestamp: Date.now() },
    ...current.filter((item) => item.title !== podcast.title),
  ];
  saveLocalFavorites(podcastFavoritesStorageKey, next);
}

function App() {
  const [view, setView] = useState<AppView>('home');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [notes, setNotes] = useState<BoneNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<BoneNote | undefined>(undefined);
  const [editorReturnView, setEditorReturnView] = useState<AppView>('home');
  const [favoritesFace, setFavoritesFace] = useState<'album' | 'podcast'>('album');
  const [favoritesAnimateEntry, setFavoritesAnimateEntry] = useState(true);
  const [viewTransition, setViewTransition] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const [coldStartSettled, setColdStartSettled] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState('');
  const permissionNoticeTimerRef = useRef<number | null>(null);
  const viewTransitionTimerRef = useRef<number | null>(null);
  const viewRef = useRef<AppView>('home');
  const editorReturnViewRef = useRef<AppView>('home');
  const viewHistoryRef = useRef<AppView[]>([]);
  const backHandlerRef = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadNotes().then((loaded) => setNotes(sortNotes(loaded)));
  }, []);

  useEffect(() => {
    let settledTimer = 0;
    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        settledTimer = window.setTimeout(() => {
          setColdStartSettled(true);
        }, 220);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settledTimer);
    };
  }, []);

  const replaceView = (next: AppView) => {
    if (next === viewRef.current) return;

    if (viewTransitionTimerRef.current) {
      window.clearTimeout(viewTransitionTimerRef.current);
    }

    setViewTransition('leaving');
    viewTransitionTimerRef.current = window.setTimeout(() => {
      viewRef.current = next;
      setView(next);
      setViewTransition('entering');
      viewTransitionTimerRef.current = window.setTimeout(() => {
        setViewTransition('idle');
        viewTransitionTimerRef.current = null;
      }, 280);
    }, 170);
  };

  const navigateTo = (next: AppView) => {
    const current = viewRef.current;
    if (current !== next) {
      viewHistoryRef.current.push(current);
    }
    replaceView(next);
  };

  const goBack = () => {
    const previous = viewHistoryRef.current.pop();
    replaceView(previous || 'home');
  };

  const returnFromEditor = (target: AppView = editorReturnViewRef.current) => {
    if (viewHistoryRef.current[viewHistoryRef.current.length - 1] === target) {
      viewHistoryRef.current.pop();
    }
    replaceView(target);
  };

  const registerBackHandler = (handler: (() => boolean) | null) => {
    backHandlerRef.current = handler;
  };

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    editorReturnViewRef.current = editorReturnView;
  }, [editorReturnView]);

  useEffect(
    () => () => {
      if (viewTransitionTimerRef.current) {
        window.clearTimeout(viewTransitionTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', () => {
      if (backHandlerRef.current?.()) return;

      if (viewRef.current === 'home') return;
      if (viewRef.current === 'note') {
        returnFromEditor();
        return;
      }

      goBack();
    }).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, []);

  const showToast = (message: string) => {
    if (permissionNoticeTimerRef.current) {
      window.clearTimeout(permissionNoticeTimerRef.current);
    }

    setPermissionNotice(message);
    permissionNoticeTimerRef.current = window.setTimeout(() => {
      setPermissionNotice('');
      permissionNoticeTimerRef.current = null;
    }, 2200);
  };

  const persistSettings = async (next: AppSettings, message = '已保存') => {
    setSettings(next);
    await saveSettings(next);
    showToast(message);
  };

  const persistNotes = async (next: BoneNote[], message?: string) => {
    const ordered = sortNotes(next);
    setNotes(ordered);
    await saveNotes(ordered);
    if (message) showToast(message);
  };

  const openEditor = (noteId: string | null, returnView: AppView) => {
    setDraftNote(undefined);
    setEditingNoteId(noteId);
    setEditorReturnView(returnView);
    navigateTo('note');
  };

  const openEditorWithDraft = (note: BoneNote, returnView: AppView) => {
    setDraftNote(note);
    setEditingNoteId(null);
    setEditorReturnView(returnView);
    navigateTo('note');
  };

  const saveNote = async (note: BoneNote) => {
    const exists = notes.some((item) => item.id === note.id);
    const next = exists ? notes.map((item) => (item.id === note.id ? note : item)) : [note, ...notes];
    await persistNotes(next, '笔记已保存');
    setDraftNote(undefined);
    returnFromEditor(editorReturnView === 'home' ? 'home' : 'notes');
  };

  const deleteNote = async (noteId: string) => {
    await persistNotes(notes.filter((note) => note.id !== noteId), '笔记已删除');
  };

  const togglePin = async (noteId: string) => {
    const colors: NonNullable<BoneNote['pinnedColor']>[] = ['blue', 'red', 'yellow'];
    const target = notes.find((note) => note.id === noteId);
    if (!target) return;

    if (!target.pinned) {
      const usedColors = new Set(
        notes
          .filter((note) => note.pinned && note.id !== noteId)
          .map((note) => note.pinnedColor)
          .filter((color): color is NonNullable<BoneNote['pinnedColor']> => Boolean(color)),
      );
      const nextColor = colors.find((color) => !usedColors.has(color));

      if (!nextColor) {
        showToast('最多只能顶置 3 条笔记');
        return;
      }

      await persistNotes(
        notes.map((note) =>
          note.id === noteId
            ? { ...note, pinned: true, pinnedColor: nextColor, updatedAt: Date.now() }
            : note,
        ),
      );
      return;
    }

    await persistNotes(
      notes.map((note) => {
        if (note.id !== noteId) return note;
        return {
          ...note,
          pinned: false,
          pinnedColor: undefined,
          updatedAt: Date.now(),
        };
      }),
    );
  };

  const restoreNotes = async (incoming: BoneNote[], mode: AppSettings['backupMode']) => {
    const normalized = incoming.map((note) => ({
      ...note,
      tags: Array.isArray(note.tags) ? note.tags : [],
      images: Array.isArray(note.images) ? note.images : [],
      pinned: Boolean(note.pinned),
    }));

    if (mode === 'replace') {
      await persistNotes(normalized, '笔记已恢复');
      return;
    }

    const merged = new Map(notes.map((note) => [note.id, note]));
    normalized.forEach((note) => merged.set(note.id, note));
    await persistNotes(Array.from(merged.values()), '笔记已合并恢复');
  };

  const navigateFromHome = (next: AppView) => {
    if (next === 'note') {
      openEditor(null, 'home');
      return;
    }

    if (next === 'favorites') {
      setFavoritesFace('album');
      setFavoritesAnimateEntry(true);
    }

    navigateTo(next);
  };

  const openFavorites = (face: 'album' | 'podcast', returnToHome = false) => {
    setFavoritesFace(face);
    setFavoritesAnimateEntry(false);

    if (returnToHome) {
      viewHistoryRef.current = ['home'];
      replaceView('favorites');
      return;
    }

    navigateTo('favorites');
  };

  const currentNote = editingNoteId ? notes.find((note) => note.id === editingNoteId) : draftNote;
  const allTags = useMemo(() => getAllTags(notes), [notes]);

  return (
    <main className={`app-shell app-shell-${viewTransition} ${coldStartSettled ? 'app-cold-start-settled' : 'app-cold-start'}`}>
      {view === 'home' && <HomeView onNavigate={navigateFromHome} />}
      {view === 'note' && (
        <NoteEditorView
          note={currentNote}
          allTags={allTags}
          onSave={saveNote}
          onRegisterBackHandler={registerBackHandler}
          onToast={showToast}
        />
      )}
      {view === 'notes' && (
        <NotesView
          notes={notes}
          allTags={allTags}
          onBack={goBack}
          onNew={() => openEditor(null, 'notes')}
          onEdit={(noteId) => openEditor(noteId, 'notes')}
          onDelete={deleteNote}
          onTogglePin={togglePin}
          onRegisterBackHandler={registerBackHandler}
          onToast={showToast}
        />
      )}
      {view === 'recorder' && (
        <RecorderView
          settings={settings}
          onBack={goBack}
          onEdit={(note) => openEditorWithDraft(note, 'home')}
          onRegisterBackHandler={registerBackHandler}
          onToast={showToast}
        />
      )}
      {view === 'podcast' && <PodcastRecommendationView onOpenFavorites={() => openFavorites('podcast', true)} onToast={showToast} />}
      {view === 'album' && <AlbumRecommendationView onOpenFavorites={() => openFavorites('album', true)} onToast={showToast} />}
      {view === 'favorites' && (
        <FavoritesWallView initialFace={favoritesFace} animateEntry={favoritesAnimateEntry} onToast={showToast} />
      )}
      {view === 'settings' && (
        <SettingsView
          settings={settings}
          notes={notes}
          onBack={goBack}
          onSave={persistSettings}
          onRestoreNotes={restoreNotes}
          onToast={showToast}
        />
      )}
      {view !== 'home' &&
        view !== 'settings' &&
        view !== 'note' &&
        view !== 'notes' &&
        view !== 'recorder' &&
        view !== 'podcast' &&
        view !== 'album' &&
        view !== 'favorites' && <PlaceholderView view={view} onBack={goBack} />}
      {permissionNotice && <div className="permission-notice">{permissionNotice}</div>}
    </main>
  );
}

function HomeView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  const [touch, setTouch] = useState<TouchState>(initialTouch);
  const lastTapRef = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const gestureRef = useRef<GestureSnapshot>({
    isDown: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    moved: false,
  });

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const vibrateShort = async () => {
    try {
      await Haptics.vibrate({ duration: 28 });
    } catch {
      navigator.vibrate?.(28);
    }
  };

  const vibrateDouble = async () => {
    await vibrateShort();
    window.setTimeout(() => {
      void vibrateShort();
    }, 55);
  };

  const navigateWithReset = (next: AppView) => {
    window.setTimeout(() => {
      gestureRef.current.isDown = false;
      setTouch(initialTouch);
      onNavigate(next);
    }, 120);
  };

  const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    const point = event.touches[0];
    if (!point) return;

    event.preventDefault();
    clearLongPress();
    gestureRef.current = {
      isDown: true,
      startX: point.clientX,
      startY: point.clientY,
      x: 0,
      y: 0,
      moved: false,
    };
    setTouch({
      ...initialTouch,
      startX: point.clientX,
      startY: point.clientY,
      active: true,
    });

    longPressTimer.current = window.setTimeout(() => {
      void vibrateDouble();
      setTouch((current) => ({
        ...current,
        active: false,
        longPress: true,
      }));
      window.setTimeout(() => navigateWithReset('recorder'), 600);
    }, 600);
  };

  const handleTouchMove = (event: TouchEvent<HTMLButtonElement>) => {
    if (!gestureRef.current.isDown) return;

    const point = event.touches[0];
    if (!point) return;

    event.preventDefault();
    const deltaX = point.clientX - gestureRef.current.startX;
    const deltaY = point.clientY - gestureRef.current.startY;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearLongPress();
      gestureRef.current.moved = true;
    }

    const maxDistance = 150;
    const distance = Math.hypot(deltaX, deltaY);
    const ratio = distance > maxDistance ? maxDistance / distance : 1;
    const x = deltaX * ratio;
    const y = deltaY * ratio;
    gestureRef.current.x = x;
    gestureRef.current.y = y;
    setTouch((current) => ({
      ...current,
      x,
      y,
      rotation: clamp((deltaX + deltaY) * 0.08, -14, 14),
      active: true,
    }));
  };

  const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearLongPress();
    const { x, y, moved } = gestureRef.current;
    const distance = Math.hypot(x, y);

    gestureRef.current.isDown = false;

    if (!moved || distance < 8) {
      handleTap();
      return;
    }

    if (Math.abs(x) > Math.abs(y) && x < 0 && distance > 24) {
      navigateWithReset('favorites');
      return;
    }

    if (distance > 48) {
      if (Math.abs(x) > Math.abs(y) && x > 0) {
        navigateWithReset('notes');
        return;
      }

      if (Math.abs(y) > Math.abs(x)) {
        navigateWithReset(y > 0 ? 'album' : 'podcast');
        return;
      }
    }

    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      longPress: false,
    }));
  };

  const handleTouchCancel = () => {
    clearLongPress();
    gestureRef.current.isDown = false;
    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      longPress: false,
    }));
  };

  const handleTap = () => {
    const now = Date.now();

    if (now - lastTapRef.current < 300) {
      navigateWithReset('note');
      return;
    }

    lastTapRef.current = now;
    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      tap: true,
    }));
    window.setTimeout(() => {
      setTouch((current) => ({ ...current, tap: false }));
    }, 450);
  };

  const className = [
    'inner-block',
    touch.active ? 'active' : '',
    touch.longPress ? 'long-press' : '',
    touch.tap ? 'tap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="home-screen" aria-label="Bone home">
      <div className="grid-line horizontal-line line-one" />
      <div className="grid-line horizontal-line line-two" />
      <div className="grid-line vertical-line line-three" />
      <div className="grid-line vertical-line line-four" />

      <div className="outer-diamond" aria-hidden="true">
        <button
          className={className}
          style={{
            transform: `translate3d(${touch.x}px, ${touch.y}px, 0) rotate(${touch.rotation}deg) scale(${touch.tap ? 0.9 : 1})`,
          }}
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <img className="center-image" src={fitImage} alt="" draggable="false" />
        </button>
      </div>

      <button
        className="settings-fab"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNavigate('settings');
        }}
        aria-label="打开设置"
        title="设置"
      >
        <Settings size={24} strokeWidth={2.4} />
      </button>
    </section>
  );
}

function NoteEditorView({
  note,
  allTags,
  onSave,
  onRegisterBackHandler,
  onToast,
}: {
  note?: BoneNote;
  allTags: string[];
  onSave: (note: BoneNote) => Promise<void>;
  onRegisterBackHandler: (handler: (() => boolean) | null) => void;
  onToast: (message: string) => void;
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [images, setImages] = useState<NoteImage[]>(note?.images || []);
  const [tagInput, setTagInput] = useState('');
  const [fabOpen, setFabOpen] = useState(Boolean(note));
  const [showTags, setShowTags] = useState(false);
  const [showB, setShowB] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImageDelete, setPendingImageDelete] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setTags(note?.tags || []);
    setImages(note?.images || []);
    setFabOpen(Boolean(note));
    setShowTags(false);
    setShowB(false);
    setPendingImageDelete(null);
    setPreviewImage('');
    if (contentInputRef.current) {
      contentInputRef.current.innerHTML = toEditableHtml(note?.content || '');
    }
  }, [note]);

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (pendingImageDelete !== null) {
        setPendingImageDelete(null);
        return true;
      }

      if (previewImage) {
        setPreviewImage('');
        return true;
      }

      if (showB) {
        setShowB(false);
        return true;
      }

      if (showTags) {
        setShowTags(false);
        return true;
      }

      if (fabOpen) {
        setFabOpen(false);
        return true;
      }

      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [fabOpen, onRegisterBackHandler, pendingImageDelete, previewImage, showB, showTags]);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const savePage1Note = async () => {
    if (!title.trim()) {
      onToast('请填写标题');
      return;
    }

    if (!plainTextFromRich(content).trim()) {
      onToast('请填写内容');
      return;
    }

    const now = Date.now();
    await onSave({
      id: note?.id || createNoteId(),
      title: title.trim(),
      content,
      tags,
      images,
      audio: note?.audio,
      createdAt: note?.createdAt || now,
      updatedAt: now,
      pinned: note?.pinned || false,
      pinnedColor: note?.pinnedColor,
    });
  };

  const startPage1FabPress = () => {
    longPressed.current = false;
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      void Haptics.vibrate({ duration: 28 }).catch(() => undefined);
      void savePage1Note();
    }, 650);
  };

  const endPage1FabPress = () => {
    clearPressTimer();
    if (!longPressed.current) setFabOpen((current) => !current);
  };

  const addPage1Tag = (value = tagInput) => {
    const next = value.trim();
    if (!next) {
      onToast('请输入标签');
      return;
    }

    if (tags.includes(next)) {
      onToast('标签已存在');
      return;
    }

    setTags([...tags, next]);
    setTagInput('');
  };

  const handlePage1Files = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const remain = Math.max(0, 9 - images.length);
    if (remain === 0) {
      onToast('最多选择 9 张图片');
      return;
    }

    try {
      const converted = await Promise.all(files.slice(0, remain).map(readImageFile));
      setImages([...images, ...converted]);
      onToast(`已添加 ${converted.length} 张图片`);
    } catch {
      onToast('图片读取失败');
    }
  };

  const handleEditorTap = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, [contenteditable], img')) return;

    const now = performance.now();
    if (now - lastTapTimeRef.current < 300) {
      void savePage1Note();
    }
    lastTapTimeRef.current = now;
  };

  const confirmDeleteImage = () => {
    if (pendingImageDelete === null) return;
    setImages(images.filter((_, imageIndex) => imageIndex !== pendingImageDelete));
    setPendingImageDelete(null);
  };

  const toggleContentBold = () => {
    const editor = contentInputRef.current;
    if (!editor) return;

    editor.focus();
    const isBold = document.queryCommandState('bold');
    document.execCommand('bold');
    setContent(editor.innerHTML);
    onToast(isBold ? '关闭粗体' : '开启粗体');
  };

  return (
    <section className="page1-note-editor-screen">
      <div className="page1-top-white-fill" />
      <header className="page1-custom-nav-bar" aria-label="B·one">
        <h1 className="page1-nav-title">
          <span className="page1-nav-b">B</span>
          <span className="page1-nav-dot">·</span>
          <span className="page1-nav-o">o</span>
          <span className="page1-nav-n">n</span>
          <span className="page1-nav-e">e</span>
        </h1>
      </header>

      <div className="page1-note-container" onClick={handleEditorTap}>
        <div className="page1-title-section page1-clean-title">
          <label className="page1-card">
            <span className="page1-card-overlay" />
            <span className="page1-card-inner">
              <input
                className="page1-title-input page1-clean-title-input"
                value={title}
                maxLength={50}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="标题"
              />
            </span>
          </label>
        </div>

        {images.length > 0 && (
          <div className="page1-image-section">
            <div className="page1-image-scroll" aria-label="已选择图片">
              <div className="page1-image-list">
                {images.map((image, index) => (
                  <figure className="page1-image-item" key={image.id}>
                    <img
                      className="page1-selected-image"
                      src={image.dataUrl}
                      alt=""
                      onClick={() => setPreviewImage(image.dataUrl)}
                    />
                    <button
                      className="page1-image-delete"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingImageDelete(index);
                      }}
                      aria-label="删除图片"
                    >
                      <span className="page1-delete-icon">×</span>
                    </button>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="page1-content-section">
          <div
            ref={contentInputRef}
            className="page1-content-input"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="内容"
            data-placeholder="内容..."
            onBlur={() => setIsTyping(false)}
            onInput={(event) => {
              const editor = event.currentTarget;
              if (plainTextFromRich(editor.innerHTML).length > 10000) return;
              setContent(editor.innerHTML);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                toggleContentBold();
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                document.execCommand('insertLineBreak');
                setContent(event.currentTarget.innerHTML);
              }
            }}
            onFocus={() => setIsTyping(true)}
          />
        </div>
      </div>

      <div className={`page1-fab page1-fab-flower ${fabOpen ? 'page1-fab-open' : ''}`}>
        {isTyping && (
          <button
            className="page1-fab-overlay"
            type="button"
            onClick={() => contentInputRef.current?.focus()}
            aria-label="继续输入"
          />
        )}
        <button
          className={`page1-btn page1-btn-circle page1-btn-lg page1-fab-trigger ${
            fabOpen ? 'page1-fab-trigger-mondrian-black' : ''
          }`}
          type="button"
          onPointerCancel={clearPressTimer}
          onPointerDown={startPage1FabPress}
          onPointerLeave={clearPressTimer}
          onPointerUp={endPage1FabPress}
          aria-label="展开菜单"
        >
          <img
            className={`page1-fab-image ${fabOpen ? 'page1-fab-image-hidden' : ''}`}
            src={page1Assets.fit}
            alt=""
            draggable="false"
          />
          <img
            className={`page1-custom-art-image ${fabOpen ? '' : 'page1-custom-art-image-hidden'}`}
            src={page1Assets.black}
            alt=""
            draggable="false"
          />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-left-1"
          type="button"
          onClick={toggleContentBold}
          aria-label="粗体"
        >
          <img className="page1-fab-btn-image" src={page1Assets.white} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-left-2"
          type="button"
          onClick={() => setShowTags(true)}
          aria-label="标签"
        >
          <img className="page1-fab-btn-image" src={page1Assets.yellow} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-right-1"
          type="button"
          onClick={() => imageInputRef.current?.click()}
          aria-label="选择图片"
        >
          <img className="page1-fab-btn-image" src={page1Assets.blue} alt="" draggable="false" />
        </button>

        <button
          className="page1-btn page1-btn-circle page1-btn-lg page1-fab-btn page1-fab-btn-right-2"
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          aria-label="拍照"
        >
          <img className="page1-fab-btn-image" src={page1Assets.red} alt="" draggable="false" />
        </button>
      </div>

      <input
        ref={imageInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handlePage1Files}
      />
      <input
        ref={cameraInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePage1Files}
      />

      {showTags && (
        <div className="page1-tag-popup page1-tag-popup-visible">
          <button className="page1-tag-popup-overlay" type="button" onClick={() => setShowTags(false)} />
          <section className="page1-tag-card" onClick={(event) => event.stopPropagation()}>
            <h2 className="page1-card-title">标签管理</h2>

            {tags.length > 0 && (
              <div className="page1-card-section">
                <h3 className="page1-section-title">当前标签</h3>
                <div className="page1-tag-list">
                  {tags.map((tag) => (
                    <button
                      className="page1-tag-name page1-tag-current"
                      key={tag}
                      type="button"
                      onClick={() => setTags(tags.filter((item) => item !== tag))}
                    >
                      <span className="page1-tag-text">{tag}</span>
                      <span className="page1-tag-remove">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="page1-card-section">
              <h3 className="page1-section-title">添加标签</h3>
              <div className="page1-input-section">
                <input
                  className="page1-tag-input"
                  value={tagInput}
                  maxLength={20}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addPage1Tag();
                  }}
                  placeholder="输入新标签"
                />
                <button className="page1-tag-add-btn" type="button" onClick={() => addPage1Tag()}>
                  +
                </button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="page1-card-section">
                <h3 className="page1-section-title">历史标签</h3>
                <div className="page1-tag-list">
                  {allTags.map((tag) => (
                    <button
                      className={`page1-tag-name ${tags.includes(tag) ? 'page1-tag-disabled' : ''}`}
                      key={tag}
                      type="button"
                      onClick={() => addPage1Tag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="page1-card-actions">
              <button className="page1-action-btn page1-confirm-btn" type="button" onClick={() => setShowTags(false)}>
                确定
              </button>
              <button className="page1-close-btn" type="button" onClick={() => setShowTags(false)}>
                ×
              </button>
            </div>
          </section>
        </div>
      )}

      {showB && (
        <div className="page1-b-image-modal page1-b-image-modal-visible" onClick={() => setShowB(false)}>
          <div className="page1-b-image-modal-overlay" />
          <div className="page1-b-image-modal-content" onClick={(event) => event.stopPropagation()}>
            <img className="page1-b-image-display" src={page1Assets.b} alt="" onClick={() => setShowB(false)} />
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-backdrop image-modal" onClick={() => setPreviewImage('')}>
          <img src={previewImage} alt="" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      {pendingImageDelete !== null && (
        <div className="page1-soft-modal-backdrop" onClick={() => setPendingImageDelete(null)}>
          <section className="page1-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>确定删除这张图片吗？</h2>
            <p>删除后只会从当前笔记里移除。</p>
            <div className="page1-dialog-actions">
              <button type="button" onClick={() => setPendingImageDelete(null)}>
                取消
              </button>
              <button className="danger" type="button" onClick={confirmDeleteImage}>
                删除
              </button>
            </div>
          </section>
        </div>
      )}

    </section>
  );
}

function RecorderView({
  settings,
  onBack,
  onEdit,
  onRegisterBackHandler,
  onToast,
}: {
  settings: AppSettings;
  onBack: () => void;
  onEdit: (note: BoneNote) => void;
  onRegisterBackHandler: (handler: (() => boolean) | null) => void;
  onToast: (message: string) => void;
}) {
  const [currentTime, setCurrentTime] = useState('0:00');
  const [isRecording, setIsRecording] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [isLongPress, setIsLongPress] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingType, setProcessingType] = useState<'transcribe' | 'polish' | 'organize' | ''>('');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const stopTypeRef = useRef<'normal' | 'cancel' | ''>('');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  const isRecordingRef = useRef(false);
  const currentBlobRef = useRef<Blob | null>(null);

  const setRecording = (value: boolean) => {
    isRecordingRef.current = value;
    setIsRecording(value);
  };

  const clearRecorderTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
  };

  const resetRecordingSurface = () => {
    clearRecorderTimer();
    secondsRef.current = 0;
    setCurrentTime('0:00');
    setRecording(false);
    setIsLongPress(false);
  };

  const startTimer = () => {
    clearRecorderTimer();
    secondsRef.current = 0;
    setCurrentTime('0:00');
    timerRef.current = window.setInterval(() => {
      secondsRef.current += 1;
      setCurrentTime(formatRecorderTime(secondsRef.current));

      if (secondsRef.current >= 300) {
        stopRecording('normal');
      }
    }, 1000);
  };

  const stopRecording = (type: 'normal' | 'cancel') => {
    stopTypeRef.current = type;
    clearRecorderTimer();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopTracks();
      resetRecordingSurface();
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    const api = settings.api.speechToText;
    setIsTranscribing(true);
    setProcessingType('transcribe');

    if (!api.apiKey.trim()) {
      setTranscriptionText('未配置语音转换 API，请到设置页填写后重试。');
      setIsTranscribing(false);
      setProcessingType('');
      return;
    }

    try {
      const formData = new FormData();
      const fileName = audioName || `bone-recording-${Date.now()}.${audioExtension(blob.type)}`;
      formData.append('file', new File([blob], fileName, { type: blob.type || 'audio/webm' }));
      formData.append('model', api.model);
      const response = await fetch(SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api.apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(api.timeoutMs || 30000),
      });

      const responseText = await response.text();
      if (!response.ok) throw new Error(`speech api ${response.status}: ${responseText}`);

      const result = JSON.parse(responseText || '{}');
      const text = extractTranscriptionText(result);
      if (!text.trim()) {
        setTranscriptionText('未能识别出语音内容，请说话清晰一些');
        setIsTranscribing(false);
        setProcessingType('');
        return;
      }

      await polishText(text);
    } catch {
      setTranscriptionText('抱歉，语音转文字失败，请重试');
      setIsTranscribing(false);
      setProcessingType('');
    }
  };

  const polishText = async (originalText: string) => {
    const api = settings.api.speechToText;
    setIsTranscribing(true);
    setProcessingType('polish');

    if (!api.enabled || !api.baseUrl.trim() || !api.apiKey.trim() || !api.model.trim()) {
      setTranscriptionText(originalText);
      setIsTranscribing(false);
      setProcessingType('');
      return;
    }

    try {
      const response = await fetch(api.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.polishModel || DEFAULT_POLISH_MODEL,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的文本润色助手。仅纠正错别字、语法错误、冗余和重复表达，不改变原意，不新增总结，不改变段落结构。',
            },
            { role: 'user', content: originalText },
          ],
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(api.timeoutMs || 30000),
      });

      if (!response.ok) throw new Error(`polish api ${response.status}`);
      const result = await response.json();
      setTranscriptionText(extractChatText(result) || originalText);
    } catch {
      setTranscriptionText(originalText);
    } finally {
      setIsTranscribing(false);
      setProcessingType('');
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onToast('当前环境不支持录音');
      return;
    }

    try {
      stopPlayback();
      setShowPopup(false);
      setTranscriptionText('');
      setIsTranscribing(false);
      setProcessingType('');
      setAudioDataUrl('');
      currentBlobRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        onToast('录音出错');
        resetRecordingSurface();
        stopTracks();
      };

      recorder.onstop = () => {
        const stopType = stopTypeRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        stopTracks();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        stopTypeRef.current = '';
        resetRecordingSurface();
        setIsFirstTime(false);

        if (stopType === 'cancel') {
          setShowPopup(false);
          setAudioDataUrl('');
          setTranscriptionText('');
          currentBlobRef.current = null;
          return;
        }

        const name = `bone-recording-${Date.now()}.${audioExtension(blob.type)}`;
        setAudioName(name);
        currentBlobRef.current = blob;
        void blobToDataUrl(blob).then((dataUrl) => {
          setAudioDataUrl(dataUrl);
          setShowPopup(true);
          void transcribeAudio(blob);
        });
      };

      recorder.start();
      stopTypeRef.current = '';
      setRecording(true);
      startTimer();
    } catch {
      onToast('需要录音权限');
      resetRecordingSurface();
      stopTracks();
    }
  };

  const handleRecording = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    if (!isRecordingRef.current) {
      void startRecording();
      return;
    }

    stopRecording('normal');
  };

  const handlePointerDown = () => {
    if (!isRecordingRef.current) return;

    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      ignoreClickRef.current = true;
      clearRecorderTimer();
      secondsRef.current = 0;
      setCurrentTime('0:00');
      setIsLongPress(true);
      void Haptics.vibrate({ duration: 30 }).catch(() => navigator.vibrate?.(30));
    }, 650);
  };

  const handlePointerEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPress) {
      setIsLongPress(false);
      stopRecording('cancel');
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 80);
    }
  };

  const playRecording = () => {
    if (!audioDataUrl) {
      onToast('录音文件不存在');
      return;
    }

    if (isPlaying) {
      stopPlayback();
      return;
    }

    stopPlayback();
    const audio = new Audio(audioDataUrl);
    audioPlayerRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      onToast('播放失败');
      setIsPlaying(false);
    };
    void audio.play().then(() => setIsPlaying(true)).catch(() => onToast('播放失败'));
  };

  const closePopup = () => {
    stopPlayback();
    setShowPopup(false);
    setTranscriptionText('');
    setIsTranscribing(false);
    setProcessingType('');
  };

  const handleEdit = () => {
    if (!transcriptionText.trim()) {
      onToast('没有可编辑的文本');
      return;
    }

    const now = Date.now();
    const audio: NoteAudio | undefined = audioDataUrl
      ? {
          id: `audio-${now}-${Math.random().toString(16).slice(2)}`,
          name: audioName || `bone-recording-${now}.${audioExtension(currentBlobRef.current?.type || '')}`,
          dataUrl: audioDataUrl,
          createdAt: now,
        }
      : undefined;

    stopPlayback();
    onEdit({
      id: createNoteId(),
      title: '',
      content: transcriptionText,
      tags: [],
      images: [],
      audio,
      createdAt: now,
      updatedAt: now,
      pinned: false,
    });
  };

  useEffect(() => {
    void startRecording();

    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      clearRecorderTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        stopTypeRef.current = 'cancel';
        mediaRecorderRef.current.stop();
      }
      stopTracks();
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (showPopup) {
        closePopup();
        return true;
      }

      if (isRecordingRef.current) {
        stopRecording('cancel');
        onBack();
        return true;
      }

      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [onBack, onRegisterBackHandler, showPopup]);

  const buttonText = isLongPress ? 'CANCEL' : isFirstTime ? 'STOP' : isRecording ? 'STOP' : 'START';
  const loadingText =
    processingType === 'polish' ? '正在润色...' : processingType === 'organize' ? '整理文本中...' : '文本转录中...';

  return (
    <section className="recorder-page">
      <div className="recorder-container">
        <div className="recorder-card">
          <div className="recorder-card-title" aria-label="B·one">
            <span className="recorder-title-b">B</span>
            <span className="recorder-title-dot">·</span>
            <span className="recorder-title-o">o</span>
            <span className="recorder-title-n">n</span>
            <span className="recorder-title-e">e</span>
          </div>

          {isPlaying && (
            <div className="recorder-playing-loading">
              <span className="recorder-spin-circle recorder-mondrian-red" />
              <span className="recorder-spin-circle recorder-mondrian-yellow" />
              <span className="recorder-spin-circle recorder-mondrian-blue" />
            </div>
          )}

          <div className={`recorder-timer ${isRecording ? 'recording' : ''}`}>{currentTime}/5:00</div>

          <button
            className={`recorder-button ${!isRecording ? 'start' : ''} ${isLongPress ? 'cancel' : ''}`}
            type="button"
            onClick={handleRecording}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerEnd}
            onPointerUp={handlePointerEnd}
          >
            <span className="recorder-button-top">{buttonText}</span>
            <span className="recorder-button-bottom" />
            <span className="recorder-button-base" />
          </button>

          {isRecording && (
            <div className="recorder-recording-loading">
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <div className="recorder-popup-mask show" onClick={closePopup}>
          <section className="recorder-popup-content show" onClick={(event) => event.stopPropagation()}>
            <div className="recorder-transcription-container">
              {isTranscribing && <div className="recorder-loading-text">{loadingText}</div>}
              {isTranscribing && (
                <div className="recorder-loading recorder-processing-loading">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {!isTranscribing && <div className="recorder-transcription-text">{transcriptionText}</div>}
            </div>

            <div className="recorder-preview-actions">
              <button className="recorder-preview-action-item recorder-play-btn" type="button" onClick={playRecording}>
                播放
              </button>
              <button className="recorder-preview-action-item recorder-edit-btn" type="button" onClick={handleEdit}>
                编辑
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function NotesView({
  notes,
  allTags,
  onBack,
  onNew,
  onEdit,
  onDelete,
  onTogglePin,
  onRegisterBackHandler,
  onToast,
}: {
  notes: BoneNote[];
  allTags: string[];
  onBack: () => void;
  onNew: () => void;
  onEdit: (noteId: string) => void;
  onDelete: (noteId: string) => Promise<void>;
  onTogglePin: (noteId: string) => Promise<void>;
  onRegisterBackHandler: (handler: (() => boolean) | null) => void;
  onToast: (message: string) => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [confirmedSearchText, setConfirmedSearchText] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({
    tag: false,
    image: false,
    voice: false,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<BoneNote | null>(null);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<BoneNote | null>(null);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [draftSelectedTags, setDraftSelectedTags] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState('');
  const [sharePreview, setSharePreview] = useState('');
  const [detailTranslateY, setDetailTranslateY] = useState(0);
  const [detailDragging, setDetailDragging] = useState(false);
  const [detailClosing, setDetailClosing] = useState(false);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const detailTouchStartY = useRef(0);
  const detailCloseTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const noteAudioPlayer = useRef<HTMLAudioElement | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    const text = confirmedSearchText.trim().toLowerCase();
    return sortNotes(notes).filter((note) => {
      if (text) {
        const haystack = `${note.title} ${plainTextFromRich(note.content)} ${note.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(text)) return false;
      }

      if (selectedOptions.image && note.images.length === 0) return false;
      if (selectedOptions.voice && !note.audio) return false;
      if (selectedOptions.tag && selectedTags.length > 0) {
        return selectedTags.every((tag) => note.tags.includes(tag));
      }

      return true;
    });
  }, [notes, confirmedSearchText, selectedOptions, selectedTags]);

  const hasFilters = selectedOptions.tag || selectedOptions.image || selectedOptions.voice || selectedTags.length > 0;

  const stopNoteAudio = () => {
    if (noteAudioPlayer.current) {
      noteAudioPlayer.current.pause();
      noteAudioPlayer.current.currentTime = 0;
      noteAudioPlayer.current = null;
    }
    setPlayingNoteId(null);
  };

  const toggleNoteAudio = (note: BoneNote, event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    if (!note.audio?.dataUrl) return;

    if (playingNoteId === note.id) {
      stopNoteAudio();
      return;
    }

    stopNoteAudio();
    const player = new Audio(note.audio.dataUrl);
    noteAudioPlayer.current = player;
    player.onended = () => {
      noteAudioPlayer.current = null;
      setPlayingNoteId(null);
    };
    player.onerror = () => {
      noteAudioPlayer.current = null;
      setPlayingNoteId(null);
    };
    void player.play().then(() => setPlayingNoteId(note.id)).catch(() => setPlayingNoteId(null));
  };

  const toggleOption = (key: keyof typeof selectedOptions) => {
    setSelectedOptions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const openTagFilter = () => {
    setDraftSelectedTags(selectedTags);
    setShowTagFilter(true);
  };

  const toggleDraftTag = (tag: string) => {
    setDraftSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const applyTagFilter = () => {
    setSelectedTags(draftSelectedTags);
    setSelectedOptions((current) => ({
      ...current,
      tag: draftSelectedTags.length > 0,
    }));
    setShowTagFilter(false);
  };

  const clearTagFilter = () => {
    setDraftSelectedTags([]);
    setSelectedTags([]);
    setSelectedOptions((current) => ({
      ...current,
      tag: false,
    }));
    setShowTagFilter(false);
  };

  const closeTagFilter = () => {
    setDraftSelectedTags(selectedTags);
    setShowTagFilter(false);
  };

  const resetSearch = () => {
    setSearchText('');
    setConfirmedSearchText('');
    setIsSearchActive(false);
  };

  const resetFilters = () => {
    setSelectedOptions({ tag: false, image: false, voice: false });
    setSelectedTags([]);
    setDraftSelectedTags([]);
    setShowTagFilter(false);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = searchText.trim();
    setConfirmedSearchText(next);
    setIsSearchActive(Boolean(next));
    event.currentTarget.querySelector('input')?.blur();
  };

  const handleSearchBoxClick = (event: MouseEvent<HTMLFormElement>) => {
    if (!isSearchActive && !confirmedSearchText) return;
    event.preventDefault();
    resetSearch();
  };

  const closeDetail = () => {
    if (!selectedNote || detailClosing) return;
    setDetailDragging(false);
    setDetailClosing(true);
    detailCloseTimer.current = window.setTimeout(() => {
      setSelectedNote(null);
      setDetailTranslateY(0);
      setDetailClosing(false);
      detailCloseTimer.current = null;
    }, 260);
  };

  const handleDetailTouchStart = (event: TouchEvent<HTMLElement>) => {
    const scrollEl = detailScrollRef.current;
    const canScroll = scrollEl ? scrollEl.scrollHeight > scrollEl.clientHeight + 4 : false;
    const isAtTop = scrollEl ? scrollEl.scrollTop <= 5 : true;
    const canDrag = !canScroll || isAtTop;
    if (!canDrag) {
      setDetailDragging(false);
      return;
    }

    detailTouchStartY.current = event.touches[0]?.clientY || 0;
    setDetailDragging(true);
  };

  const handleDetailTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!detailDragging) return;
    const currentY = event.touches[0]?.clientY || 0;
    const deltaY = currentY - detailTouchStartY.current;
    if (deltaY <= 0) {
      setDetailTranslateY(0);
      return;
    }

    const resistance = Math.min(deltaY / 1400, 0.08);
    setDetailTranslateY(deltaY * (1 - resistance));
  };

  const handleDetailTouchEnd = () => {
    if (!detailDragging) return;
    setDetailDragging(false);
    if (detailTranslateY > 76) {
      closeDetail();
      return;
    }

    setDetailTranslateY(0);
  };

  const requestDeleteNote = (note: BoneNote) => {
    setPendingDeleteNote(note);
  };

  const confirmDeleteNote = async () => {
    if (!pendingDeleteNote) return;
    const noteId = pendingDeleteNote.id;
    setPendingDeleteNote(null);
    await onDelete(noteId);
  };

  const clearNoteLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startNoteLongPress = (noteId: string) => {
    longPressTriggered.current = false;
    clearNoteLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      try {
        void Haptics.vibrate({ duration: 28 });
      } catch {
        navigator.vibrate?.(28);
      }
      void onTogglePin(noteId);
    }, 500);
  };

  const finishNotePress = () => {
    clearNoteLongPress();
    window.setTimeout(() => {
      longPressTriggered.current = false;
    }, 250);
  };

  const handleShareImage = async (note: BoneNote) => {
    try {
      const image = await drawNoteShareImage(note);
      setSharePreview(image);
      onToast('分享图已生成');
    } catch {
      onToast('生成失败');
    }
  };

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (previewImage) {
        setPreviewImage('');
        return true;
      }

      if (sharePreview) {
        setSharePreview('');
        return true;
      }

      if (selectedNote) {
        closeDetail();
        return true;
      }

      if (pendingDeleteNote) {
        setPendingDeleteNote(null);
        return true;
      }

      if (showTagFilter) {
        closeTagFilter();
        return true;
      }

      if (isSearchActive || confirmedSearchText || searchText) {
        resetSearch();
        return true;
      }

      if (hasFilters) {
        resetFilters();
        return true;
      }

      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [
    confirmedSearchText,
    hasFilters,
    isSearchActive,
    pendingDeleteNote,
    previewImage,
    searchText,
    selectedNote,
    sharePreview,
    showTagFilter,
  ]);

  useEffect(
    () => () => {
      clearNoteLongPress();
      stopNoteAudio();
      if (detailCloseTimer.current !== null) {
        window.clearTimeout(detailCloseTimer.current);
      }
    },
    [],
  );

  return (
    <section className="notes-screen page4-screen">
      <div className="page4-top-white-fill" />
      <nav className="page4-custom-nav-bar" aria-label="B·one">
        <button className="page4-nav-hit page4-nav-back" type="button" onClick={onBack} aria-label="返回主页" />
        <div className="page4-nav-title">
          <span className="page4-nav-b">B</span>
          <span className="page4-nav-dot">·</span>
          <span className="page4-nav-o">o</span>
          <span className="page4-nav-n">n</span>
          <span className="page4-nav-e">e</span>
        </div>
        <button className="page4-nav-hit page4-nav-new" type="button" onClick={onNew} aria-label="新建笔记" />
      </nav>

      <div className="page4-container">
        <div className="page4-fixed-area">
          <form
            className={`page4-search-box ${isSearchActive ? 'active' : ''}`}
            onClick={handleSearchBoxClick}
            onSubmit={handleSearchSubmit}
          >
            <input
              className="page4-search-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              enterKeyHint="search"
              inputMode="search"
            />
          </form>

          <div className="page4-check-holder">
            <button
              className={`page4-check page4-check-tag ${selectedOptions.tag ? 'checked' : ''}`}
              type="button"
              onClick={openTagFilter}
            >
              <span>#</span>
            </button>
            <button
              className={`page4-check page4-check-img ${selectedOptions.image ? 'checked' : ''}`}
              type="button"
              onClick={() => toggleOption('image')}
            >
              <span>IMG</span>
            </button>
            <button
              className={`page4-check page4-check-mp3 ${selectedOptions.voice ? 'checked' : ''}`}
              type="button"
              onClick={() => toggleOption('voice')}
            >
              <span>MP3</span>
            </button>
          </div>

        </div>

        <div className="page4-content-wrapper">
          <div className="page4-cards-container">
            {notes.length === 0 && (
              <button className="page4-card page4-empty-card" type="button" onClick={onNew}>
                <div className="page4-note-info">
                  <div className="page4-header-row">
                    <span className="page4-note-title">新建第一条笔记</span>
                  </div>
                  <div className="page4-note-content-wrapper no-images">
                    <span className="page4-note-content">双击主页方块也可以进入新建笔记。</span>
                  </div>
                </div>
              </button>
            )}

            {filteredNotes.map((note) => (
              <article
                className={`page4-card ${note.pinned ? `page4-pinned-card page4-pinned-${note.pinnedColor || 'blue'}` : ''}`}
                key={note.id}
                onClick={() => {
                  if (longPressTriggered.current) return;
                  setSelectedNote(note);
                }}
                onContextMenu={(event) => event.preventDefault()}
                onMouseDown={() => startNoteLongPress(note.id)}
                onMouseLeave={finishNotePress}
                onMouseUp={finishNotePress}
                onTouchCancel={finishNotePress}
                onTouchEnd={finishNotePress}
                onTouchStart={() => startNoteLongPress(note.id)}
              >
                <div className="page4-card-overlay-layer" />
                <div className="page4-note-info">
                  <div className="page4-header-row">
                    <h2 className="page4-note-title">{renderHighlightedText(note.title, confirmedSearchText)}</h2>
                  </div>

                  <div className={`page4-note-content-wrapper ${!note.audio && note.images.length === 0 ? 'no-images' : ''}`}>
                    <p className="page4-note-content">{renderFormattedText(note.content, confirmedSearchText)}</p>
                  </div>

                  {(note.images.length > 0 || note.audio) && (
                    <div className="page4-note-images">
                      {note.audio && (
                        <button
                          className={`page4-audio-button ${playingNoteId === note.id ? 'playing' : ''}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            clearNoteLongPress();
                          }}
                          onTouchStart={(event) => {
                            event.stopPropagation();
                            clearNoteLongPress();
                          }}
                          onClick={(event) => toggleNoteAudio(note, event)}
                          aria-label={playingNoteId === note.id ? '停止录音' : '播放录音'}
                        >
                          <Mic size={20} />
                        </button>
                      )}
                      {note.images.slice(0, note.audio ? 2 : 3).map((image) => (
                        <img
                          key={image.id}
                          src={image.dataUrl}
                          alt=""
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewImage(image.dataUrl);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <time className="page4-note-time">{formatDate(note.createdAt)}</time>
                </div>

                <div className="page4-card-buttons">
                  <button
                    className="page4-card-btn page4-card-btn-delete"
                    type="button"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                      requestDeleteNote(note);
                    }}
                    aria-label="删除"
                  />
                  <button
                    className="page4-card-btn page4-card-btn-img"
                    type="button"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                      void handleShareImage(note);
                    }}
                    aria-label="生成分享图"
                  />
                  <button
                    className="page4-card-btn page4-card-btn-url"
                    type="button"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      clearNoteLongPress();
                      onEdit(note.id);
                    }}
                    aria-label="编辑"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {showTagFilter && (
        <div className="page4-soft-modal-backdrop" onClick={closeTagFilter}>
          <section className="page4-tag-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="page4-dialog-header">
              <div>
                <h2>标签筛选</h2>
                <p>选择一个或多个标签后，只显示同时包含这些标签的笔记。</p>
              </div>
            </header>

            <div className="page4-tag-dialog-body">
              {allTags.length === 0 ? (
                <p className="page4-empty-tags">当前还没有可筛选的标签。</p>
              ) : (
                <div className="page4-tag-choice-grid">
                  {allTags.map((tag) => (
                    <button
                      className={draftSelectedTags.includes(tag) ? 'selected' : ''}
                      key={tag}
                      type="button"
                      onClick={() => toggleDraftTag(tag)}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="page4-dialog-actions">
              <button className="ghost" type="button" onClick={clearTagFilter}>
                清空
              </button>
              <button className="primary" type="button" onClick={applyTagFilter}>
                确定
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingDeleteNote && (
        <div className="page4-soft-modal-backdrop" onClick={() => setPendingDeleteNote(null)}>
          <section className="page4-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>确定要删除吗？</h2>
            <p>{pendingDeleteNote.title || '这条笔记'} 删除后会从本地笔记列表移除。</p>
            <div className="page4-dialog-actions">
              <button className="plain" type="button" onClick={() => setPendingDeleteNote(null)}>
                取消
              </button>
              <button className="danger" type="button" onClick={() => void confirmDeleteNote()}>
                删除
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedNote && (
        <div
          className={`modal-backdrop note-detail-backdrop ${detailClosing ? 'closing' : ''}`}
          onClick={closeDetail}
        >
          <section
            className={`note-detail ${detailDragging ? 'dragging' : ''} ${detailClosing ? 'closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
            onTouchEnd={handleDetailTouchEnd}
            onTouchMove={handleDetailTouchMove}
            onTouchStart={handleDetailTouchStart}
            style={{ transform: `translateY(${detailTranslateY}px)` }}
          >
            <header>
              <h2>{renderHighlightedText(selectedNote.title, confirmedSearchText)}</h2>
            </header>
            {selectedNote.tags.length > 0 && (
              <div className="page4-popup-tag-row">
                {selectedNote.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            <div className="note-detail-scroll-shell">
              <div className="note-detail-scroll" ref={detailScrollRef}>
              <p>{renderFormattedText(selectedNote.content, confirmedSearchText)}</p>
              {selectedNote.audio && (
                <button
                  className={`page4-audio-button page4-detail-audio-button ${
                    playingNoteId === selectedNote.id ? 'playing' : ''
                  }`}
                  type="button"
                  onClick={(event) => toggleNoteAudio(selectedNote, event)}
                  aria-label={playingNoteId === selectedNote.id ? '停止录音' : '播放录音'}
                >
                  <Mic size={20} />
                </button>
              )}
              {selectedNote.images.length > 0 && (
                <div className="detail-images">
                  {selectedNote.images.map((image) => (
                    <img
                      key={image.id}
                      src={image.dataUrl}
                      alt=""
                      onClick={() => setPreviewImage(image.dataUrl)}
                    />
                  ))}
                </div>
              )}
              </div>
            </div>
          </section>
        </div>
      )}

      {sharePreview && (
        <div className="page4-image-preview-popup" onClick={() => setSharePreview('')}>
          <section className="page4-preview-content" onClick={(event) => event.stopPropagation()}>
            <div className="page4-preview-image-container">
              <img className="page4-preview-image" src={sharePreview} alt="" />
            </div>
            <div className="page4-preview-actions">
              <button type="button" onClick={() => onToast('转发稍后接系统分享')}>
                转发
              </button>
              <button type="button" onClick={() => onToast('收藏稍后接系统收藏')}>
                收藏
              </button>
              <button type="button" onClick={() => downloadDataUrl(sharePreview, 'bone-note.png')}>
                保存
              </button>
            </div>
            <button className="page4-preview-cancel" type="button" onClick={() => setSharePreview('')}>
              取消
            </button>
          </section>
        </div>
      )}

      {previewImage && (
        <div className="modal-backdrop image-modal" onClick={() => setPreviewImage('')}>
          <img src={previewImage} alt="" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

function SettingsView({
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

      <div className="settings-content">
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
              <span>导出备份</span>
            </button>
            <button className="action-tile" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={22} />
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

function ApiPanel({
  capability,
  config,
  onChange,
  onToast,
}: {
  capability: ApiCapability;
  config: ApiConfig;
  onChange: (patch: Partial<ApiConfig>) => void;
  onToast: (message: string) => void;
}) {
  const meta = capabilityLabels[capability];
  const Icon = meta.icon;

  const testConfig = () => {
    if (!config.baseUrl.trim() || !config.model.trim()) {
      onToast('请先填写 Base URL 和模型');
      return;
    }

    if (!config.apiKey.trim()) {
      onToast('请先填写 API Key');
      return;
    }

    onToast('配置格式可用');
  };

  return (
    <article className="api-panel">
      <div className="api-panel-head">
        <Icon size={20} />
        <div>
          <h3>{meta.title}</h3>
          <p>{meta.hint}</p>
        </div>
      </div>

      <label className="field-row">
        <span>接口类型</span>
        <select
          value={config.interfaceType}
          onChange={(event) => onChange({ interfaceType: event.target.value as ApiInterfaceType })}
        >
          {interfaceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-row">
        <span>Base URL</span>
        <input
          value={config.baseUrl}
          onChange={(event) => onChange({ baseUrl: event.target.value })}
          placeholder="https://api.example.com/v1/chat/completions"
          spellCheck={false}
        />
      </label>

      <label className="field-row">
        <span>API Key</span>
        <input
          value={config.apiKey}
          onChange={(event) => onChange({ apiKey: event.target.value })}
          placeholder="sk-..."
          type="password"
          spellCheck={false}
        />
      </label>

      <label className="field-row">
        <span>模型 / Bot ID</span>
        <input
          value={config.model}
          onChange={(event) => onChange({ model: event.target.value })}
          placeholder={config.interfaceType === 'ark-bot' ? 'bot-xxxxxxxx' : 'model-name'}
          spellCheck={false}
        />
      </label>

      <div className="api-panel-actions">
        <button type="button" onClick={() => onChange({ enabled: !config.enabled })}>
          {config.enabled ? <Check size={18} /> : <Save size={18} />}
          <span>{config.enabled ? '已启用' : '启用'}</span>
        </button>
        <button type="button" onClick={testConfig}>
          <DatabaseBackup size={18} />
          <span>测试</span>
        </button>
      </div>
    </article>
  );
}

function useRecommendationMotion(onSwipeUp: () => void, onSwipeDown?: () => void, resetKey?: unknown) {
  // 进入页面直接呈现封面页（isFlipped 初始 true），不做翻转动画
  const [isFlipped, setIsFlipped] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<RecommendationDirection>('');
  const [artworkLoaded, setArtworkLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  // 换卡后新卡片从下方飞进来的进入动画状态
  const [isEntering, setIsEntering] = useState(false);
  const isFirstMountRef = useRef(true);
  const touchRef = useRef<RecommendationTouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    swipeDetected: false,
  });

  useLayoutEffect(() => {
    // 用 useLayoutEffect 而非 useEffect：在浏览器 paint 前同步执行，
    // 确保换卡瞬间 isFlipped=true 在新卡片画到屏幕前就生效，杜绝首帧闪详情页。
    setArtworkLoaded(false);
    setImageLoaded(false);
    setIsFlipped(true);

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
    }

    // 兜底：demo 数据里多张卡片可能用同一张本地图，<img src> 不变时 React 不会
    // 重新触发 onLoad，导致 artworkLoaded 一直是 false、图片 opacity:0 看似消失。
    // 这里用定时器兜底设回 true，保证换卡后封面能淡入显示。
    const artworkTimer = window.setTimeout(() => setArtworkLoaded(true), 200);
    const imageTimer = window.setTimeout(() => setImageLoaded(true), 200);
    return () => {
      window.clearTimeout(artworkTimer);
      window.clearTimeout(imageTimer);
    };
  }, [resetKey]);

  // 对齐小程序 swipeLeft：翻转切换正反面
  const swipeLeft = () => {
    setIsFlipped((current) => !current);
    setIsAnimating(true);
    window.setTimeout(() => setIsAnimating(false), 1000);
  };

  // 飞出动画 320ms 结束后立即换卡，新卡片带 entering-up 从下方飞入封面页
  const startRotateAnimation = (direction: Exclude<RecommendationDirection, ''>) => {
    setIsAnimating(true);
    setAnimationDirection(direction);
    window.setTimeout(() => {
      // 换卡前同步设好 flipped=true 和 isEntering=true，确保换卡那次 render
      // 新卡片首帧就同时拿到封面页 + entering-up 进入动画，无缝接管飞出动画，
      // 不会出现既无飞出也无进入的中间帧（那会闪现非翻转详情页）。
      setIsFlipped(true);
      setAnimationDirection('');
      if (direction === 'up' || direction === 'down') {
        setIsEntering(true);
      }
      if (direction === 'up') {
        onSwipeUp();
      } else if (direction === 'down') {
        onSwipeDown?.();
      }
      // 进入动画 320ms 结束后清除状态
      window.setTimeout(() => {
        setIsAnimating(false);
        setIsEntering(false);
      }, 340);
    }, 320);
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      swipeDetected: false,
    };
  };

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (isAnimating) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaX = Math.abs(touch.clientX - touchRef.current.startX);
    const deltaY = Math.abs(touch.clientY - touchRef.current.startY);
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 10) {
      touchRef.current.swipeDetected = true;
    }
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (isAnimating) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const touchDuration = Date.now() - touchRef.current.startTime;

    // 整体降低阈值，让翻页/滑动更灵敏
    if (!touchRef.current.swipeDetected || moveDistance <= 30 || touchDuration <= 60) {
      touchRef.current.swipeDetected = false;
      return;
    }

    // 下滑：收藏（正反面都可以，无动画，直接跳收藏页）
    if (deltaY > 60 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onSwipeDown?.();
      return;
    }
    // 上滑：重新出卡（正反面都可以，带动画）
    if (deltaY < -60 && Math.abs(deltaY) > Math.abs(deltaX)) {
      startRotateAnimation('up');
      return;
    }
    // 左滑 / 右滑：翻转（正反面都可以），阈值降低更灵敏
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swipeLeft();
    }
  };

  return {
    isFlipped,
    isAnimating,
    animationDirection,
    artworkLoaded,
    imageLoaded,
    isEntering,
    setArtworkLoaded,
    setImageLoaded,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}

function PodcastRecommendationView({
  onOpenFavorites,
  onToast,
}: {
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
}) {
  const [podcastIndex, setPodcastIndex] = useState(0);
  const podcastOptions = demoPodcastFavorites;
  const podcast = podcastOptions[podcastIndex] ?? demoPodcast;
  const motion = useRecommendationMotion(
    () => {
      setPodcastIndex((current) => (current + 1) % podcastOptions.length);
    },
    () => {
      savePodcastFavorite(podcast);
      onToast('收藏成功');
      onOpenFavorites();
    },
    podcastIndex,
  );

  // 对齐小程序 wxml 的 className 拼接
  const cardClass = [
    'recommend-card',
    'podcast',
    motion.isFlipped ? 'flipped' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const motionShellClass = [
    'recommend-motion-shell',
    motion.isAnimating && motion.animationDirection === 'up' ? 'moving-up' : '',
    motion.isEntering ? 'entering-up' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const copyPodcast = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!podcast) return;
    await writeTextToClipboard(`${podcast.title} ${podcast.author}`);
    onToast('已复制');
  };

  return (
    <section className="recommend-page" {...motion.touchHandlers}>
      <div className={motionShellClass}>
        <article className={cardClass}>
        {/* front：详情面（节目列表），对齐 page5.wxml 的 .front */}
        <div className="recommend-front">
          {podcast && podcast.episodes.length > 0 ? (
            <div className="recommend-episodes-section-front">
              <div className="recommend-episodes-title">最新节目</div>
              <div className="recommend-episodes-list-front">
                {podcast.episodes.map((episode, index) => (
                  <div className="recommend-episode-item-front" key={episode.title}>
                    <span className="recommend-episode-title-front">
                      {index + 1}. {episode.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="recommend-generating-intro" />
          )}
        </div>

        {/* back：封面面（artwork + title），对齐 page5.wxml 的 .back */}
        <div className="recommend-back">
          {podcast ? (
            <img
              className={`recommend-artwork ${motion.artworkLoaded ? 'artwork-visible' : ''}`}
              src={podcast.artworkUrl}
              alt=""
              draggable="false"
              onLoad={() => window.setTimeout(() => motion.setArtworkLoaded(true), 100)}
            />
          ) : (
            <img
              className={`recommend-loading-image ${motion.imageLoaded ? 'image-visible' : ''}`}
              src={podcastLoadingImage}
              alt=""
              draggable="false"
              onLoad={() => motion.setImageLoaded(true)}
            />
          )}
          {podcast ? (
            <div className="recommend-title">
              {podcast.title}
              <button
                className="recommend-copy-button"
                type="button"
                aria-label="复制播客名"
                onClick={copyPodcast}
              />
            </div>
          ) : (
            <div className="recommend-card-text recommend-loading-text">请等一下 ：)</div>
          )}
        </div>
        </article>
      </div>
    </section>
  );
}

function AlbumRecommendationView({
  onOpenFavorites,
  onToast,
}: {
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
}) {
  const [albumIndex, setAlbumIndex] = useState(0);
  const albumOptions = demoAlbumFavorites;
  const album = albumOptions[albumIndex] ?? demoAlbum;
  const motion = useRecommendationMotion(
    () => {
      setAlbumIndex((current) => (current + 1) % albumOptions.length);
    },
    () => {
      saveAlbumFavorite(album);
      onToast('收藏成功');
      onOpenFavorites();
    },
    albumIndex,
  );

  const cardClass = [
    'recommend-card',
    'album',
    motion.isFlipped ? 'flipped' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const motionShellClass = [
    'recommend-motion-shell',
    motion.isAnimating && motion.animationDirection === 'up' ? 'moving-up' : '',
    motion.isEntering ? 'entering-up' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const copyAlbum = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!album) return;
    await writeTextToClipboard(`${album.albumTitle} ${album.albumArtist}`);
    onToast('已复制');
  };

  return (
    <section className="recommend-page" {...motion.touchHandlers}>
      <div className={motionShellClass}>
        <article className={cardClass}>
        {/* front：详情面（专辑介绍），对齐 page6.wxml 的 .front */}
        <div className="recommend-front">
          {album?.albumIntro ? (
            <div className="recommend-album-intro">{album.albumIntro}</div>
          ) : (
            <div className="recommend-generating-intro">
              <div className="recommend-card-text recommend-generating-text">马上介绍...</div>
            </div>
          )}
        </div>

        {/* back：封面面（artwork + title + artist），对齐 page6.wxml 的 .back */}
        <div className="recommend-back">
          {album ? (
            <img
              className={`recommend-artwork ${motion.artworkLoaded ? 'artwork-visible' : ''}`}
              src={album.artworkUrl}
              alt=""
              draggable="false"
              onLoad={() => window.setTimeout(() => motion.setArtworkLoaded(true), 100)}
            />
          ) : (
            <img
              className={`recommend-loading-image ${motion.imageLoaded ? 'image-visible' : ''}`}
              src={albumLoadingImage}
              alt=""
              draggable="false"
              onLoad={() => motion.setImageLoaded(true)}
            />
          )}
          {album ? (
            <>
              <div className="recommend-title">{album.albumTitle}</div>
              <div className="recommend-artist">
                by {album.albumArtist}
                <button
                  className="recommend-copy-button"
                  type="button"
                  aria-label="复制专辑名"
                  onClick={copyAlbum}
                />
              </div>
            </>
          ) : (
            <div className="recommend-card-text recommend-loading-text">请等一下 ：)</div>
          )}
        </div>
        </article>
      </div>
    </section>
  );
}

function FavoritesWallView({
  initialFace,
  animateEntry,
  onToast,
}: {
  initialFace: 'album' | 'podcast';
  animateEntry: boolean;
  onToast: (message: string) => void;
}) {
  const [isFlipped, setIsFlipped] = useState(animateEntry ? false : initialFace === 'album');
  const [isAnimating, setIsAnimating] = useState(false);
  const [coverFadeIn, setCoverFadeIn] = useState(false);
  const [albumFavorites, setAlbumFavorites] = useState<DemoAlbum[]>(() =>
    loadLocalFavorites(albumFavoritesStorageKey, demoAlbumFavorites),
  );
  const [podcastFavorites, setPodcastFavorites] = useState<DemoPodcast[]>(() =>
    loadLocalFavorites(podcastFavoritesStorageKey, demoPodcastFavorites),
  );
  const [selectedAlbum, setSelectedAlbum] = useState<DemoAlbum | null>(null);
  const [selectedPodcast, setSelectedPodcast] = useState<DemoPodcast | null>(null);
  const [popupTranslateY, setPopupTranslateY] = useState(0);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [addTarget, setAddTarget] = useState<AddTarget>('album');
  const [addName, setAddName] = useState('');
  const [addArtistName, setAddArtistName] = useState('');
  const [coverSource, setCoverSource] = useState<CoverSource>('system');
  const [manualCoverUrl, setManualCoverUrl] = useState('');
  const [addConfirmStep, setAddConfirmStep] = useState(false);
  const [addErrorText, setAddErrorText] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ target: AddTarget; index: number; name: string } | null>(null);
  const wallTouchRef = useRef({ startX: 0, startY: 0 });
  const popupTouchRef = useRef({ startY: 0, dragging: false });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCoverFadeIn(false);

    const faceTimer = window.setTimeout(
      () => {
        setIsFlipped(initialFace === 'album');
        setCoverFadeIn(true);
      },
      animateEntry ? 300 : 80,
    );

    return () => {
      window.clearTimeout(faceTimer);
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    };
  }, [animateEntry, initialFace]);

  const resetAddState = () => {
    setAddName('');
    setAddArtistName('');
    setCoverSource('system');
    setManualCoverUrl('');
    setAddConfirmStep(false);
    setAddErrorText('');
  };

  const openAddPopupByType = (target: AddTarget) => {
    setAddTarget(target);
    resetAddState();
    setShowAddPopup(true);
  };

  const closeAddPopup = () => {
    setShowAddPopup(false);
    resetAddState();
  };

  const swipeDisplay = () => {
    setIsFlipped((current) => !current);
    setIsAnimating(true);
    window.setTimeout(() => setIsAnimating(false), 850);
  };

  const onWallTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    wallTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
    };
  };

  const onWallTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (isAnimating || selectedAlbum || selectedPodcast || showAddPopup) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - wallTouchRef.current.startX;
    const deltaY = Math.abs(touch.clientY - wallTouchRef.current.startY);

    if (Math.abs(deltaX) > 38 && deltaY < Math.abs(deltaX) * 0.65) {
      swipeDisplay();
    }
  };

  const startPopupDrag = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    popupTouchRef.current = {
      startY: touch.clientY,
      dragging: true,
    };
  };

  const movePopupDrag = (event: TouchEvent<HTMLElement>) => {
    if (!popupTouchRef.current.dragging) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaY = touch.clientY - popupTouchRef.current.startY;
    if (deltaY > 0) {
      const resistance = Math.min(deltaY / 1200, 0.05);
      setPopupTranslateY(deltaY * (1 - resistance));
    }
  };

  const endPopupDrag = () => {
    if (!popupTouchRef.current.dragging) return;
    popupTouchRef.current.dragging = false;

    if (popupTranslateY > 80) {
      setSelectedAlbum(null);
      setSelectedPodcast(null);
      setPopupTranslateY(0);
      return;
    }

    setPopupTranslateY(0);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const beginFavoriteLongPress = (target: AddTarget, index: number, name: string) => {
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      void Haptics.vibrate({ duration: 35 }).catch(() => navigator.vibrate?.(35));
      setPendingDelete({ target, index, name });
    }, 650);
  };

  const confirmDeleteFavorite = () => {
    if (!pendingDelete) return;

    if (pendingDelete.target === 'album') {
      setAlbumFavorites((items) => {
        const next = items.filter((_, index) => index !== pendingDelete.index);
        saveLocalFavorites(albumFavoritesStorageKey, next);
        return next;
      });
    } else {
      setPodcastFavorites((items) => {
        const next = items.filter((_, index) => index !== pendingDelete.index);
        saveLocalFavorites(podcastFavoritesStorageKey, next);
        return next;
      });
    }

    setPendingDelete(null);
    onToast('已删除');
  };

  const openAlbum = async (album: DemoAlbum) => {
    await writeTextToClipboard(album.albumTitle);
    setPopupTranslateY(0);
    setSelectedAlbum(album);
    onToast('专辑名已复制');
  };

  const openPodcast = async (podcast: DemoPodcast) => {
    await writeTextToClipboard(podcast.title);
    setPopupTranslateY(0);
    setSelectedPodcast(podcast);
    onToast('已复制播客名');
  };

  const onCoverFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setManualCoverUrl(String(reader.result || ''));
      setCoverSource('local');
      setAddConfirmStep(false);
      setAddErrorText('');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const onCoverPanelTap = () => {
    if (coverSource === 'system') {
      onToast('关闭系统添加可自己上传');
      return;
    }

    coverFileInputRef.current?.click();
  };

  const handleConfirmAdd = () => {
    const cleanName = addName.trim();
    if (!cleanName) {
      setAddErrorText(addTarget === 'album' ? '请先输入专辑名' : '请先输入播客名');
      return;
    }

    if (coverSource === 'system' && !addConfirmStep) {
      setManualCoverUrl(addTarget === 'album' ? albumFallbackCover : podcastFallbackCover);
      setAddConfirmStep(true);
      setAddErrorText('');
      return;
    }

    const now = Date.now();
    if (addTarget === 'album') {
      setAlbumFavorites((items) => {
        const next = [
          {
          albumTitle: cleanName,
          albumArtist: addArtistName.trim() || '未知艺术家',
          artworkUrl: manualCoverUrl || albumFallbackCover,
          albumIntro: `《${cleanName}》的介绍内容会在后续功能阶段由 API 生成。当前先保留微信小程序收藏墙的展示和弹窗形态。`,
          timestamp: now,
          },
          ...items,
        ];
        saveLocalFavorites(albumFavoritesStorageKey, next);
        return next;
      });
    } else {
      setPodcastFavorites((items) => {
        const next = [
          {
          title: cleanName,
          author: '用户添加',
          artworkUrl: manualCoverUrl || podcastFallbackCover,
          timestamp: now,
          episodes: [
            { title: '最新节目会在后续功能阶段接入', date: 'UI preview' },
            { title: '当前先保留弹窗和列表形态', date: 'UI preview' },
          ],
          },
          ...items,
        ];
        saveLocalFavorites(podcastFavoritesStorageKey, next);
        return next;
      });
    }

    closeAddPopup();
    onToast(addTarget === 'album' ? '专辑已添加' : '播客已添加');
  };

  const renderFavoriteCover = (target: AddTarget, item: DemoAlbum | DemoPodcast, index: number) => {
    const name = target === 'album' ? (item as DemoAlbum).albumTitle : (item as DemoPodcast).title;
    const open = target === 'album' ? () => openAlbum(item as DemoAlbum) : () => openPodcast(item as DemoPodcast);

    return (
      <button
        className="favorites-card-container"
        key={`${target}-${name}-${item.timestamp}`}
        type="button"
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }
          void open();
        }}
        onPointerCancel={clearLongPress}
        onPointerDown={() => beginFavoriteLongPress(target, index, name)}
        onPointerLeave={clearLongPress}
        onPointerUp={clearLongPress}
      >
        <img
          className={`favorites-cover-image ${coverFadeIn ? 'fade-in' : ''}`}
          src={item.artworkUrl}
          alt=""
          draggable="false"
        />
      </button>
    );
  };

  return (
    <section className="favorites-page" onTouchEnd={onWallTouchEnd} onTouchStart={onWallTouchStart}>
      <div className={`favorites-card-label favorites-albums-label ${isFlipped ? '' : 'flipped'}`}>ALBUMS</div>
      <div className={`favorites-card-label favorites-podcasts-label ${isFlipped ? 'flipped' : ''}`}>PODCASTS</div>

      <div className={`favorites-display-container ${isFlipped ? '' : 'flipped'}`}>
        <div className="favorites-front-display">
          <div className="favorites-covers-container">
            <div className="favorites-covers-grid-dynamic">
              <button
                className="favorites-card-container favorites-add-card-container favorites-album-add-card"
                type="button"
                onClick={() => openAddPopupByType('album')}
              >
                <span className="favorites-add-card-plus">+</span>
              </button>
              {albumFavorites.map((album, index) => renderFavoriteCover('album', album, index))}
            </div>
          </div>
        </div>

        <div className="favorites-back-display">
          <div className="favorites-covers-container">
            <div className="favorites-covers-grid-dynamic">
              <button
                className="favorites-card-container favorites-add-card-container favorites-podcast-add-card"
                type="button"
                onClick={() => openAddPopupByType('podcast')}
              >
                <span className="favorites-add-card-plus">+</span>
              </button>
              {podcastFavorites.map((podcast, index) => renderFavoriteCover('podcast', podcast, index))}
            </div>
          </div>
        </div>
      </div>

      {selectedAlbum && (
        <div
          className="favorites-popup-mask album-popup-mask-ui"
          onClick={() => {
            setSelectedAlbum(null);
            setPopupTranslateY(0);
          }}
        >
          <section
            className="favorites-popup-content"
            onClick={(event) => event.stopPropagation()}
            onTouchEnd={endPopupDrag}
            onTouchMove={movePopupDrag}
            onTouchStart={startPopupDrag}
            style={{ transform: `translateY(${popupTranslateY}px)` }}
          >
            <div className="favorites-popup-note">
              <header className="favorites-popup-header">
                <div className="favorites-album-popup-title">{selectedAlbum.albumTitle}</div>
                <div className="favorites-album-popup-artist">by {selectedAlbum.albumArtist}</div>
              </header>
              <div className="favorites-popup-scroll-content">
                <div className="favorites-popup-text-wrapper">
                  <p className="favorites-popup-text">{selectedAlbum.albumIntro || '暂无介绍'}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedPodcast && (
        <div
          className="favorites-popup-mask podcast-popup-mask-ui"
          onClick={() => {
            setSelectedPodcast(null);
            setPopupTranslateY(0);
          }}
        >
          <section
            className="favorites-popup-content"
            onClick={(event) => event.stopPropagation()}
            onTouchEnd={endPopupDrag}
            onTouchMove={movePopupDrag}
            onTouchStart={startPopupDrag}
            style={{ transform: `translateY(${popupTranslateY}px)` }}
          >
            <div className="favorites-popup-note">
              <header className="favorites-popup-header">
                <div className="favorites-podcast-popup-title">{selectedPodcast.title}</div>
              </header>
              <div className="favorites-popup-scroll-content">
                <div className="favorites-podcast-episodes-list">
                  {selectedPodcast.episodes.length > 0 ? (
                    selectedPodcast.episodes.map((episode, index) => (
                      <div className="favorites-podcast-episode-item" key={`${episode.title}-${index}`}>
                        <div className="favorites-episode-number">{index + 1}</div>
                        <div className="favorites-episode-info">
                          <div className="favorites-episode-title">{episode.title}</div>
                          {episode.date && <div className="favorites-episode-date">{episode.date}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="favorites-no-episodes">暂无节目信息</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {showAddPopup && (
        <div className="favorites-add-popup-mask" onClick={closeAddPopup}>
          <section
            className={`favorites-add-popup-content ${
              addTarget === 'album' ? 'favorites-add-popup-album' : 'favorites-add-popup-podcast'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="favorites-add-form-layout">
              <button className="favorites-add-cover-panel" type="button" onClick={onCoverPanelTap}>
                {manualCoverUrl ? (
                  <img className="favorites-add-cover-preview" src={manualCoverUrl} alt="" draggable="false" />
                ) : (
                  <span className="favorites-add-cover-placeholder">
                    <span className="favorites-add-card-plus favorites-add-cover-plus">+</span>
                  </span>
                )}
              </button>

              <div className="favorites-cover-switch-title">封面来源</div>
              <div className="favorites-cover-source-switch">
                <span className="favorites-cover-source-mode">
                  {coverSource === 'system' ? '系统添加' : '本地上传'}
                </span>
                <button
                  className={`favorites-switch ${coverSource === 'system' ? 'checked' : ''}`}
                  type="button"
                  onClick={() => {
                    setCoverSource((current) => (current === 'system' ? 'local' : 'system'));
                    setManualCoverUrl('');
                    setAddConfirmStep(false);
                    setAddErrorText('');
                  }}
                  aria-label="切换封面来源"
                >
                  <span className="favorites-slider" />
                </button>
              </div>

              <input
                className="favorites-add-input"
                value={addName}
                onChange={(event) => {
                  setAddName(event.target.value);
                  setAddConfirmStep(false);
                  setAddErrorText('');
                  if (coverSource === 'system') setManualCoverUrl('');
                }}
                placeholder={addTarget === 'album' ? '请输入专辑名（必填）' : '请输入播客名（必填）'}
              />

              {addTarget === 'album' && (
                <input
                  className="favorites-add-input favorites-add-artist-input"
                  value={addArtistName}
                  onChange={(event) => {
                    setAddArtistName(event.target.value);
                    setAddConfirmStep(false);
                    setAddErrorText('');
                    if (coverSource === 'system') setManualCoverUrl('');
                  }}
                  placeholder="请输入作者名（选填）"
                />
              )}
            </div>

            {addErrorText && <div className="favorites-add-error">{addErrorText}</div>}

            <div className="favorites-add-popup-actions">
              <button className="favorites-add-action-btn favorites-cancel-btn" type="button" onClick={closeAddPopup}>
                取消
              </button>
              <button className="favorites-add-action-btn favorites-confirm-btn" type="button" onClick={handleConfirmAdd}>
                {addConfirmStep ? '确认' : addTarget === 'album' ? '添加专辑' : '添加播客'}
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingDelete && (
        <div className="favorites-delete-mask" onClick={() => setPendingDelete(null)}>
          <section className="favorites-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>确认删除</h2>
            <p>
              确定要删除{pendingDelete.target === 'album' ? '专辑' : '播客'}“{pendingDelete.name}”吗？
            </p>
            <div className="favorites-delete-actions">
              <button type="button" onClick={() => setPendingDelete(null)}>
                取消
              </button>
              <button className="danger" type="button" onClick={confirmDeleteFavorite}>
                删除
              </button>
            </div>
          </section>
        </div>
      )}

      <input
        ref={coverFileInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        onChange={onCoverFileChange}
      />
    </section>
  );
}

function PlaceholderView({
  view,
  onBack,
}: {
  view: Exclude<AppView, 'home' | 'settings' | 'note' | 'notes'>;
  onBack: () => void;
}) {
  const meta = placeholderViews[view];
  const Icon = meta.icon;

  return (
    <section className="placeholder-screen">
      <button className="back-chip" type="button" onClick={onBack}>
        <ArrowLeft size={20} />
        <span>首页</span>
      </button>
      <div className="placeholder-content">
        <Icon size={42} />
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
    </section>
  );
}

async function writeTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy textarea path for Android WebView edge cases.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderHighlightedText(text: string, query: string): ReactNode {
  const keyword = query.trim();
  if (!keyword) return text;

  const source = text || '';
  const lowerSource = source.toLocaleLowerCase();
  const lowerKeyword = keyword.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerKeyword, cursor);

  while (index !== -1) {
    if (index > cursor) {
      parts.push(source.slice(cursor, index));
    }

    const end = index + keyword.length;
    parts.push(
      <mark className="page4-highlight" key={`${index}-${end}`}>
        {source.slice(index, end)}
      </mark>,
    );

    cursor = end;
    index = lowerSource.indexOf(lowerKeyword, cursor);
  }

  if (cursor < source.length) {
    parts.push(source.slice(cursor));
  }

  return parts;
}

function plainTextFromRich(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:div|p)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

function toEditableHtml(value: string) {
  if (/<\/?(?:strong|b|br|div|p)(?:\s[^>]*)?>/i.test(value)) return value;

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function renderFormattedText(value: string, query: string): ReactNode {
  if (!/<[a-z][^>]*>/i.test(value)) return renderHighlightedText(value, query);

  const root = document.createElement('div');
  root.innerHTML = value;
  let key = 0;

  const renderNodes = (nodes: ChildNode[], bold = false): ReactNode[] =>
    nodes.flatMap((node) => {
      const nodeKey = key++;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const rendered = renderHighlightedText(text, query);
        return bold ? [<strong key={`bold-${nodeKey}`}>{rendered}</strong>] : [<span key={`text-${nodeKey}`}>{rendered}</span>];
      }

      if (!(node instanceof HTMLElement)) return [];
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return [<br key={`br-${nodeKey}`} />];

      const children = renderNodes(Array.from(node.childNodes), bold || tag === 'b' || tag === 'strong');
      if (tag === 'div' || tag === 'p') children.push(<br key={`line-${nodeKey}`} />);
      return children;
    });

  return renderNodes(Array.from(root.childNodes));
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatRecorderTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function chooseAudioMimeType() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function audioExtension(type: string) {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  return 'webm';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('audio read failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function extractTranscriptionText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.transcription === 'string') return record.transcription;
  if (typeof record.result === 'string') return record.result;

  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.text === 'string') return dataRecord.text;
  }

  return extractChatText(value);
}

function extractChatText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';

  const first = choices[0] as Record<string, unknown>;
  if (typeof first.text === 'string') return first.text;

  const message = first.message;
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
  }

  return '';
}

async function drawNoteShareImage(note: BoneNote): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  const contentMargin = 50;
  const cardX = contentMargin;
  const cardY = contentMargin;
  const cardWidth = canvas.width - contentMargin * 2;
  const titleLineHeight = 60;
  const lineHeight = 52;
  const bottomAreaHeight = 160;
  const footerHeight = 180;
  const titleTopPadding = 100;
  const titleBottomPadding = 30;
  const maxTitleWidth = cardWidth - 80;
  const maxContentWidth = cardWidth - 100;

  const titleLines = wrapCanvasText(ctx, note.title || '未命名笔记', maxTitleWidth, 'bold 48px sans-serif');
  const contentLines = wrapCanvasText(ctx, plainTextFromRich(note.content || ''), maxContentWidth, 'bold 32px sans-serif');
  const loadedImages = await Promise.all(note.images.map((image) => loadCanvasImage(image.dataUrl).catch(() => null)));
  const imageWidth = cardWidth - 60;
  const imageGap = 30;
  const imageHeights = loadedImages.map((image) => {
    if (!image || image.width === 0) return 0;
    return image.height * (imageWidth / image.width);
  });
  const imagesHeight =
    imageHeights.reduce((total, height) => total + height, 0) +
    Math.max(0, imageHeights.filter((height) => height > 0).length - 1) * imageGap;

  const headerHeight = Math.max(titleLines.length * titleLineHeight + titleTopPadding + titleBottomPadding, 240);
  const contentAreaHeight = contentLines.length * lineHeight + 80;
  const imagesAreaHeight = imagesHeight > 0 ? imagesHeight + 120 : 0;
  const cardHeight = headerHeight + contentAreaHeight + imagesAreaHeight + bottomAreaHeight;
  canvas.height = Math.ceil(cardHeight + contentMargin * 2 + footerHeight);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = '#e0e0e0';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = -15;
  ctx.shadowOffsetY = -15;
  fillRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.shadowColor = '#bebebe';
  ctx.shadowOffsetX = 15;
  ctx.shadowOffsetY = 15;
  fillRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardWidth, headerHeight, 30);
  ctx.clip();
  const headerGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + headerHeight);
  headerGradient.addColorStop(0, 'rgba(224, 224, 224, 0.9)');
  headerGradient.addColorStop(1, 'rgba(224, 224, 224, 0)');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(cardX, cardY, cardWidth, headerHeight);
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#333333';
  titleLines.forEach((line, index) => {
    ctx.fillText(line, cardX + 40, cardY + titleTopPadding + index * titleLineHeight);
  });
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = 'rgba(51, 51, 51, 0.95)';
  let currentY = cardY + headerHeight + 10;
  contentLines.forEach((line) => {
    currentY += lineHeight;
    if (line) ctx.fillText(line, cardX + 40, currentY);
  });
  ctx.restore();

  if (imagesHeight > 0) {
    let imageY = currentY + 60;
    loadedImages.forEach((image, index) => {
      const height = imageHeights[index];
      if (!image || height <= 0) return;
      const centerX = (canvas.width - imageWidth) / 2;
      ctx.save();
      roundRectPath(ctx, centerX, imageY, imageWidth, height, 10);
      ctx.clip();
      ctx.drawImage(image, centerX, imageY, imageWidth, height);
      ctx.restore();
      imageY += height + imageGap;
    });
  }

  const bottomAreaY = cardY + cardHeight - bottomAreaHeight;
  const buttonY = bottomAreaY + 60;
  const buttonSize = 48;
  const buttonGap = 30;
  const buttonStartX = canvas.width - contentMargin - buttonSize * 3 - buttonGap * 2 - 30;
  ['rgba(209, 35, 42, 0.95)', 'rgba(30, 136, 229, 0.95)', 'rgba(255, 215, 0, 0.95)'].forEach(
    (color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(buttonStartX + index * (buttonSize + buttonGap), buttonY, buttonSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
  );

  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#999999';
  const tags = ['#B·one', '#笔记分享', ...note.tags.map((tag) => `#${tag}`)];
  let tagX = cardX + 40;
  const tagY = bottomAreaY + 110;
  tags.forEach((tag) => {
    if (tagX + ctx.measureText(tag).width > cardX + cardWidth - 40) return;
    ctx.fillText(tag, tagX, tagY);
    tagX += ctx.measureText(tag).width + 30;
  });

  drawBoneBrand(ctx, canvas.width, cardY + cardHeight + contentMargin, footerHeight);
  return canvas.toDataURL('image/png');
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  ctx.font = font;
  const lines: string[] = [];
  text.split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }

    let line = '';
    paragraph.split('').forEach((char) => {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    });
    lines.push(line);
  });
  return lines.length > 0 ? lines : [''];
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = src;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawBoneBrand(ctx: CanvasRenderingContext2D, canvasWidth: number, y: number, height: number) {
  ctx.save();
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, y, canvasWidth, height);
  ctx.font = 'bold 56px sans-serif';

  const parts = [
    { text: 'B', color: '#000000' },
    { text: '·', color: '#e0e0e0' },
    { text: 'o', color: 'rgba(255, 215, 0, 0.75)' },
    { text: 'n', color: 'rgba(209, 35, 42, 0.75)' },
    { text: 'e', color: 'rgba(30, 136, 229, 0.75)' },
  ];
  const totalWidth = parts.reduce((width, part) => width + ctx.measureText(part.text).width, 0);
  let x = (canvasWidth - totalWidth) / 2;
  const textY = y + height / 2 + 10;

  parts.forEach((part, index) => {
    ctx.fillStyle = part.color;
    if (index === 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else if (index === 1) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = -2;
      ctx.shadowOffsetY = -2;
    }
    ctx.fillText(part.text, x, textY);
    x += ctx.measureText(part.text).width;
  });
  ctx.restore();
}

function readImageFile(file: File): Promise<NoteImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      compressImage(raw)
        .then((dataUrl) => {
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type || 'image/jpeg',
            dataUrl,
            createdAt: Date.now(),
          });
        })
        .catch(() => {
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type || 'image/jpeg',
            dataUrl: raw,
            createdAt: Date.now(),
          });
        });
    };
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1280;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas failed'));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    image.onerror = () => reject(new Error('image failed'));
    image.src = dataUrl;
  });
}

export default App;
