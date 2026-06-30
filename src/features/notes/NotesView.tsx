import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, MouseEvent, TouchEvent } from 'react';
import { Haptics } from '@capacitor/haptics';
import { Mic } from 'lucide-react';
import { sortNotes } from '../../services/storage';
import type { BoneNote } from '../../shared/types';
import { formatDate } from '../../shared/date';
import { downloadDataUrl } from '../../shared/media/download';
import { drawNoteShareImage } from '../../shared/notes/shareImage';
import { plainTextFromRich, renderFormattedText, renderHighlightedText } from '../../shared/notes/richText';

export function NotesView({
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
