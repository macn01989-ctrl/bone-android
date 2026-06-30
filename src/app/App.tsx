import { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { HomeView } from '../features/home/HomeView';
import { NoteEditorView } from '../features/notes/NoteEditorView';
import { NotesView } from '../features/notes/NotesView';
import { RecorderView } from '../features/recorder/RecorderView';
import { PodcastRecommendationView } from '../features/recommendations/PodcastRecommendationView';
import { AlbumRecommendationView } from '../features/recommendations/AlbumRecommendationView';
import { FavoritesWallView } from '../features/favorites/FavoritesWallView';
import { SettingsView } from '../features/settings/SettingsView';
import { PlaceholderView } from '../features/placeholder/PlaceholderView';
import { defaultSettings, getAllTags, loadNotes, loadSettings, saveNotes, saveSettings, sortNotes } from '../services/storage';
import type { AppSettings, AppView, BoneNote } from '../shared/types';

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
      {view === 'album' && (
        <AlbumRecommendationView
          settings={settings}
          onOpenFavorites={() => openFavorites('album', true)}
          onToast={showToast}
        />
      )}
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

export default App;
