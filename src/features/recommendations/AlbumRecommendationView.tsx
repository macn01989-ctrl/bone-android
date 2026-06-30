import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  albumFallbackCover,
  albumLoadingImage,
  demoAlbum,
  saveAlbumFavorite,
} from '../../data/demoLibrary';
import type { FavoriteAlbum } from '../../data/demoLibrary';
import {
  discardApplePoolAlbum,
  getNextRecommendation,
  keepApplePoolAlbum,
  takeReadyLiveAlbum,
  triggerLiveAlbumReserve,
} from '../../services/recommendations';
import type { LiveAlbumConfig } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';
import type { AppSettings } from '../../shared/types';
import { useRecommendationMotion } from './useRecommendationMotion';

export function AlbumRecommendationView({
  settings,
  onOpenFavorites,
  onToast,
}: {
  settings: AppSettings;
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
}) {
  const [album, setAlbum] = useState<FavoriteAlbum | null>(null);
  const [requestId, setRequestId] = useState(0);
  const liveAlbumConfig = useMemo<LiveAlbumConfig>(
    () => ({
      apiKey: settings.api.albumIntro.apiKey.trim(),
      model: settings.api.albumIntro.model.trim() || settings.albumIntroModel.trim(),
    }),
    [settings.albumIntroModel, settings.api.albumIntro.apiKey, settings.api.albumIntro.model],
  );

  useEffect(() => {
    let cancelled = false;

    const loadAlbum = async () => {
      setAlbum(null);
      try {
        const readyAlbum = await takeReadyLiveAlbum(liveAlbumConfig);
        const nextAlbum = readyAlbum ?? await getNextRecommendation('album', albumFallbackCover);
        if (!cancelled) setAlbum(nextAlbum);
      } catch {
        if (!cancelled) setAlbum({ ...demoAlbum, timestamp: Date.now() });
      } finally {
        triggerLiveAlbumReserve(liveAlbumConfig);
      }
    };

    void loadAlbum();

    return () => {
      cancelled = true;
    };
  }, [liveAlbumConfig, requestId]);

  const motion = useRecommendationMotion(
    () => {
      const currentAlbum = album;
      if (currentAlbum && 'applePoolCandidateId' in currentAlbum) {
        void discardApplePoolAlbum(currentAlbum);
      }
      setRequestId((current) => current + 1);
    },
    () => {
      if (!album) return;
      saveAlbumFavorite(album);
      if ('applePoolCandidateId' in album) {
        keepApplePoolAlbum(album);
      }
      triggerLiveAlbumReserve(liveAlbumConfig);
      onToast('收藏成功');
      onOpenFavorites();
    },
    requestId,
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

  const introText = getAlbumIntroText(album);

  return (
    <section className="recommend-page" {...motion.touchHandlers}>
      <div className={motionShellClass}>
        <article className={cardClass}>
          <div className="recommend-front">
            {introText ? (
              <div className="recommend-album-intro">{introText}</div>
            ) : (
              <div className="recommend-generating-intro">
                <div className="recommend-card-text recommend-generating-text">马上介绍...</div>
              </div>
            )}
          </div>

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
              <div className="recommend-card-text recommend-loading-text">请等一下...</div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function getAlbumIntroText(album: FavoriteAlbum | null) {
  if (!album) return '';
  if ('detail' in album && album.detail) {
    return [
      album.detail.introTitle,
      album.detail.shortIntro,
      album.detail.fullIntro,
      album.detail.listeningMoment,
      album.detail.whyKeep,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  return album.albumIntro;
}
