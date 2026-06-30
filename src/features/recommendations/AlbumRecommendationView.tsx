import { useState } from 'react';
import type { MouseEvent } from 'react';
import { albumLoadingImage, demoAlbum, demoAlbumFavorites, saveAlbumFavorite } from '../../data/demoLibrary';
import { writeTextToClipboard } from '../../shared/clipboard';
import { useRecommendationMotion } from './useRecommendationMotion';

export function AlbumRecommendationView({
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
