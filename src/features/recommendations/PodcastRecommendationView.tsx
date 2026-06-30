import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  demoPodcast,
  podcastFallbackCover,
  podcastLoadingImage,
  savePodcastFavorite,
} from '../../data/demoLibrary';
import type { FavoritePodcast } from '../../data/demoLibrary';
import { getNextRecommendation } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';
import { useRecommendationMotion } from './useRecommendationMotion';

export function PodcastRecommendationView({
  onOpenFavorites,
  onToast,
}: {
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
}) {
  const [podcast, setPodcast] = useState<FavoritePodcast | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPodcast = async () => {
      setPodcast(null);
      try {
        const nextPodcast = await getNextRecommendation('podcast', podcastFallbackCover);
        if (!cancelled) setPodcast(nextPodcast);
      } catch {
        if (!cancelled) setPodcast({ ...demoPodcast, timestamp: Date.now() });
      }
    };

    void loadPodcast();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const motion = useRecommendationMotion(
    () => {
      setRequestId((current) => current + 1);
    },
    () => {
      if (!podcast) return;
      savePodcastFavorite(podcast);
      onToast('收藏成功');
      onOpenFavorites();
    },
    requestId,
  );

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
          <div className="recommend-front">
            {podcast && podcast.episodes.length > 0 ? (
              <div className="recommend-episodes-section-front">
                <div className="recommend-episodes-title">最新节目</div>
                <div className="recommend-episodes-list-front">
                  {podcast.episodes.map((episode, index) => (
                    <div className="recommend-episode-item-front" key={`${episode.title}-${index}`}>
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
              <div className="recommend-card-text recommend-loading-text">请等一下...</div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
