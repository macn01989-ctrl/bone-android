import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { podcastFallbackCover, podcastLoadingImage, savePodcastFavorite } from '../../data/demoLibrary';
import type { RecommendationPodcast } from '../../services/recommendations';
import { getNextRecommendation } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';
import { getPodcastPlatformOption, openPlatformSearch } from '../../shared/platformLinks';
import type { PodcastPlatform } from '../../shared/types';
import { useRecommendationMotion } from './useRecommendationMotion';

type PodcastRecommendationViewProps = {
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
  platform: PodcastPlatform;
};

export function PodcastRecommendationView({
  onOpenFavorites,
  onToast,
  platform,
}: PodcastRecommendationViewProps) {
  const [podcast, setPodcast] = useState<RecommendationPodcast | null>(null);
  const [requestIndex, setRequestIndex] = useState(0);
  const [loadingText, setLoadingText] = useState('请等一下 ：)');
  const [coverLoaderLeaving, setCoverLoaderLeaving] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const platformOption = getPodcastPlatformOption(platform);

  const motion = useRecommendationMotion(
    () => {
      setRequestIndex((current) => current + 1);
    },
    () => {
      if (!podcast) {
        onToast('播客还在加载');
        return;
      }

      savePodcastFavorite(podcast);
      onToast('收藏成功');
      onOpenFavorites();
    },
    podcast?.id ?? `podcast-loading-${requestIndex}`,
  );

  useEffect(() => {
    let cancelled = false;
    const waitingTimer = window.setTimeout(() => {
      if (!cancelled) setLoadingText('还在为你寻找合适的播客，请等一下 ：)');
    }, 1200);

    setPodcast(null);
    setCoverLoaderLeaving(false);
    setContentVisible(false);
    setLoadingText('请等一下 ：)');

    const loadPodcast = async () => {
      try {
        const nextPodcast = await getNextRecommendation('podcast', podcastFallbackCover);
        if (cancelled) return;

        setPodcast(nextPodcast);
        setLoadingText('');
      } catch {
        if (cancelled) return;
        setLoadingText('推荐库暂时没响应，请上滑重试');
        onToast('推荐库暂时没响应');
      }
    };

    void loadPodcast();

    return () => {
      cancelled = true;
      window.clearTimeout(waitingTimer);
    };
  }, [requestIndex]);

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
  const isCompactMeta = Boolean(podcast && (podcast.title.length > 22 || podcast.author.length > 18));

  const revealCover = () => {
    window.setTimeout(() => {
      motion.setArtworkLoaded(true);
      setCoverLoaderLeaving(true);
      setContentVisible(true);
    }, 100);
  };

  const copyPodcast = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!podcast) return;
    await writeTextToClipboard(podcast.title);
    onToast('已复制');
  };

  const openPodcastPlatform = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!podcast) return;

    await writeTextToClipboard(podcast.title);
    onToast(`已复制，正在打开${platformOption.label}`);
    openPlatformSearch(platformOption.value, podcast.title);
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
                      {episode.date && <span className="recommend-episode-date-front">{episode.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : podcast ? (
              <div className="recommend-platforms-section">
                <div className="recommend-platforms-text">{podcast.platforms || platformOption.label}</div>
                <div className="recommend-platforms-hint">{platformOption.hint}</div>
              </div>
            ) : (
              <div className="recommend-generating-intro">
                <div className="recommend-card-text recommend-generating-text">{loadingText}</div>
              </div>
            )}
          </div>

          <div className="recommend-back">
            {podcast ? (
              <>
                <div className="recommend-cover-stage">
                  <img
                    className={`recommend-artwork ${motion.artworkLoaded ? 'artwork-visible' : ''}`}
                    src={podcast.artworkUrl}
                    alt=""
                    draggable="false"
                    onError={revealCover}
                    onLoad={revealCover}
                  />
                  <img
                    className={`recommend-cover-loader ${coverLoaderLeaving ? 'cover-loader-leaving' : ''}`}
                    src={podcastLoadingImage}
                    alt=""
                    draggable="false"
                  />
                </div>
                <div className={`recommend-card-meta ${contentVisible ? 'content-visible' : ''} ${isCompactMeta ? 'compact-meta' : ''}`}>
                  <div className="recommend-title">
                    {podcast.title}
                    <button
                      className="recommend-copy-button"
                      type="button"
                      aria-label="复制播客名"
                      onClick={copyPodcast}
                    />
                  </div>
                  <div className="recommend-artist">{podcast.author}</div>
                  <button
                    className={`recommend-platform-button ${platformOption.tone}`}
                    type="button"
                    onClick={openPodcastPlatform}
                  >
                    {platformOption.buttonLabel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <img
                  className={`recommend-loading-image ${motion.imageLoaded ? 'image-visible' : ''}`}
                  src={podcastLoadingImage}
                  alt=""
                  draggable="false"
                  onLoad={() => motion.setImageLoaded(true)}
                />
                <div className="recommend-card-text recommend-loading-text">{loadingText}</div>
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
