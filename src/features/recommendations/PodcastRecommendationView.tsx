import { useState } from 'react';
import type { MouseEvent } from 'react';
import { demoPodcast, demoPodcastFavorites, podcastLoadingImage, savePodcastFavorite } from '../../data/demoLibrary';
import { writeTextToClipboard } from '../../shared/clipboard';
import { useRecommendationMotion } from './useRecommendationMotion';

export function PodcastRecommendationView({
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
