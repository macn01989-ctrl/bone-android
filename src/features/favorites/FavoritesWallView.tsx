import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, TouchEvent } from 'react';
import { Haptics } from '@capacitor/haptics';
import type { AddTarget, CoverSource, DemoAlbum, DemoPodcast } from '../../data/demoLibrary';
import { albumFallbackCover, albumFavoritesStorageKey, demoAlbumFavorites, demoPodcastFavorites, loadLocalFavorites, podcastFallbackCover, podcastFavoritesStorageKey, saveLocalFavorites } from '../../data/demoLibrary';
import { findAlbumFavoriteFromApple, findPodcastFavoriteFromApple } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';

export function FavoritesWallView({
  initialFace,
  animateEntry,
  onRegisterBackHandler,
  onToast,
}: {
  initialFace: 'album' | 'podcast';
  animateEntry: boolean;
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
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
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [resolvedPodcast, setResolvedPodcast] = useState<DemoPodcast | null>(null);
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
    setIsSearchingCover(false);
    setResolvedPodcast(null);
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

  useEffect(() => {
    if (!onRegisterBackHandler) return undefined;

    onRegisterBackHandler(() => {
      if (pendingDelete) {
        setPendingDelete(null);
        return true;
      }
      if (showAddPopup) {
        closeAddPopup();
        return true;
      }
      if (selectedAlbum || selectedPodcast) {
        setSelectedAlbum(null);
        setSelectedPodcast(null);
        setPopupTranslateY(0);
        return true;
      }
      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [onRegisterBackHandler, pendingDelete, selectedAlbum, selectedPodcast, showAddPopup]);

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
      setResolvedPodcast(null);
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

  const handleConfirmAdd = async () => {
    const cleanName = addName.trim();
    if (!cleanName) {
      setAddErrorText(addTarget === 'album' ? '请先输入专辑名' : '请先输入播客名');
      return;
    }

    if (coverSource === 'system' && !addConfirmStep) {
      setAddErrorText('');
      setIsSearchingCover(true);

      try {
        if (addTarget === 'album') {
          const foundAlbum = await findAlbumFavoriteFromApple(cleanName, addArtistName.trim());
          if (foundAlbum) {
            setAddName(foundAlbum.albumTitle);
            setAddArtistName(foundAlbum.albumArtist);
            setManualCoverUrl(foundAlbum.artworkUrl);
            setAddConfirmStep(true);
            return;
          }
        } else {
          const foundPodcast = await findPodcastFavoriteFromApple(cleanName);
          if (foundPodcast) {
            setResolvedPodcast(foundPodcast);
            setAddName(foundPodcast.title);
            setManualCoverUrl(foundPodcast.artworkUrl);
            setAddConfirmStep(true);
            return;
          }
        }

        setManualCoverUrl(addTarget === 'album' ? albumFallbackCover : podcastFallbackCover);
        setAddConfirmStep(true);
        setAddErrorText('没有找到匹配封面，已先使用默认封面。');
      } finally {
        setIsSearchingCover(false);
      }
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
            albumIntro: `《${cleanName}》已加入收藏墙。后续可继续接入 API 生成更完整的专辑介绍。`,
            styleTags: coverSource === 'system' ? ['系统匹配'] : ['本地封面'],
            timestamp: now,
          },
          ...items,
        ];
        saveLocalFavorites(albumFavoritesStorageKey, next);
        return next;
      });
    } else {
      setPodcastFavorites((items) => {
        const podcastToSave: DemoPodcast = resolvedPodcast
          ? {
              ...resolvedPodcast,
              title: cleanName || resolvedPodcast.title,
              artworkUrl: manualCoverUrl || resolvedPodcast.artworkUrl,
              timestamp: now,
            }
          : {
              title: cleanName,
              author: '用户添加',
              platforms: coverSource === 'system' ? 'Apple Podcasts / 小宇宙' : '本地添加',
              artworkUrl: manualCoverUrl || podcastFallbackCover,
              timestamp: now,
              episodes: [
                { title: '最新节目会在后续功能阶段接入', date: 'UI preview' },
                { title: '当前先保留弹窗和列表形态', date: 'UI preview' },
              ],
            };
        const next = [
          podcastToSave,
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

  const selectedAlbumDescription = selectedAlbum
    ? [
        selectedAlbum.detail?.shortIntro,
        selectedAlbum.detail?.fullIntro,
        selectedAlbum.detail?.whyKeep,
      ].filter(Boolean).join('\n\n') || selectedAlbum.albumIntro || '暂无介绍'
    : '';

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
                {selectedAlbum.styleTags && selectedAlbum.styleTags.length > 0 && (
                  <div className="favorites-album-popup-tags">
                    {selectedAlbum.styleTags.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </header>
              <div className="favorites-popup-scroll-content">
                <div className="favorites-popup-text-wrapper">
                  <p className="favorites-popup-text">{selectedAlbumDescription}</p>
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
                    setResolvedPodcast(null);
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
                  setResolvedPodcast(null);
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
                    setResolvedPodcast(null);
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
              <button
                className="favorites-add-action-btn favorites-confirm-btn"
                type="button"
                disabled={isSearchingCover}
                onClick={() => void handleConfirmAdd()}
              >
                {isSearchingCover ? '搜索中…' : addConfirmStep ? '确认' : addTarget === 'album' ? '添加专辑' : '添加播客'}
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
