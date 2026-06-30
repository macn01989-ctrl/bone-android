import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { albumFallbackCover, albumLoadingImage, saveAlbumFavorite } from '../../data/demoLibrary';
import type { LiveAlbumConfig, RecommendationAlbum } from '../../services/recommendations';
import { getNextRecommendation, takeReadyLiveAlbum, triggerLiveAlbumReserve } from '../../services/recommendations';
import { writeTextToClipboard } from '../../shared/clipboard';
import { getMusicPlatformOption, openPlatformSearch } from '../../shared/platformLinks';
import type { MusicPlatform } from '../../shared/types';
import { useRecommendationMotion } from './useRecommendationMotion';

type AlbumRecommendationViewProps = {
  liveConfig: LiveAlbumConfig;
  onOpenFavorites: () => void;
  onToast: (message: string) => void;
  platform: MusicPlatform;
};

function collectionLabel(album: RecommendationAlbum) {
  const labels: Record<RecommendationAlbum['collection'], string> = {
    'rolling-stone-500': 'Rolling Stone 500',
    'chinese-rock': '中国乐队专辑',
    'apple-music': 'Apple Music 实时推荐',
    '1001-albums': '1001 Albums',
  };
  return labels[album.collection];
}

function introParagraphs(album: RecommendationAlbum) {
  const text = album.detail?.fullIntro?.trim() || album.albumIntro.trim();
  return text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function AlbumRecommendationView({
  liveConfig,
  onOpenFavorites,
  onToast,
  platform,
}: AlbumRecommendationViewProps) {
  const [album, setAlbum] = useState<RecommendationAlbum | null>(null);
  const [requestIndex, setRequestIndex] = useState(0);
  const [loadingText, setLoadingText] = useState('请等一下 ：)');
  const [coverLoaderLeaving, setCoverLoaderLeaving] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const platformOption = getMusicPlatformOption(platform);

  const motion = useRecommendationMotion(
    () => {
      triggerLiveAlbumReserve(liveConfig);
      setRequestIndex((current) => current + 1);
    },
    () => {
      if (!album) {
        onToast('专辑还在加载');
        return;
      }

      saveAlbumFavorite(album);
      onToast('收藏成功');
      onOpenFavorites();
    },
    album?.id ?? `album-loading-${requestIndex}`,
  );

  useEffect(() => {
    let cancelled = false;
    const waitingTimer = window.setTimeout(() => {
      if (!cancelled) setLoadingText('还在为你寻找合适的专辑，请等一下 ：)');
    }, 1200);

    setAlbum(null);
    setCoverLoaderLeaving(false);
    setContentVisible(false);
    setLoadingText('请等一下 ：)');

    const loadAlbum = async () => {
      try {
        const readyAlbum = await takeReadyLiveAlbum(liveConfig).catch(() => null);
        const nextAlbum = readyAlbum ?? await getNextRecommendation('album', albumFallbackCover);
        if (cancelled) return;

        setAlbum(nextAlbum);
        setLoadingText('');
      } catch {
        if (cancelled) return;
        setLoadingText('推荐库暂时没响应，请上滑重试');
        onToast('推荐库暂时没响应');
      }
    };

    void loadAlbum();

    return () => {
      cancelled = true;
      window.clearTimeout(waitingTimer);
    };
  }, [requestIndex, liveConfig.apiKey, liveConfig.baseUrl, liveConfig.model, liveConfig.timeoutMs]);

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
  const isCompactMeta = Boolean(album && (album.albumTitle.length > 20 || album.albumArtist.length > 18));

  const revealCover = () => {
    window.setTimeout(() => {
      motion.setArtworkLoaded(true);
      setCoverLoaderLeaving(true);
      setContentVisible(true);
    }, 100);
  };

  const copyAlbum = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!album) return;
    await writeTextToClipboard(`${album.albumTitle} ${album.albumArtist}`);
    onToast('已复制');
  };

  const openAlbumPlatform = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!album) return;

    const query = `${album.albumArtist} ${album.albumTitle}`;
    await writeTextToClipboard(query);
    onToast(`已复制，正在打开${platformOption.label}`);
    openPlatformSearch(platformOption.value, query);
  };

  return (
    <section className="recommend-page" {...motion.touchHandlers}>
      <div className={motionShellClass}>
        <article className={cardClass}>
          <div className="recommend-front">
            {album ? (
              <div className="recommend-album-detail">
                <div className={`recommend-album-source ${album.collection === 'apple-music' ? 'apple-music-source' : ''}`}>
                  {collectionLabel(album)}
                </div>
                {album.styleTags.length > 0 && (
                  <div className="recommend-album-styles">
                    {album.styleTags.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <p className="recommend-album-lead">{album.detail?.shortIntro || album.albumIntro}</p>
                {introParagraphs(album).map((paragraph, index) => (
                  <p
                    className={`recommend-album-paragraph ${
                      album.collection === '1001-albums' ? 'one-thousand-one-paragraph' : ''
                    }`}
                    key={`${album.id}-paragraph-${index}`}
                  >
                    {paragraph}
                  </p>
                ))}
                {album.detail?.whyKeep && <p className="recommend-album-note">{album.detail.whyKeep}</p>}
              </div>
            ) : (
              <div className="recommend-generating-intro">
                <div className="recommend-card-text recommend-generating-text">{loadingText}</div>
              </div>
            )}
          </div>

          <div className="recommend-back">
            {album ? (
              <>
                <div className="recommend-cover-stage">
                  <img
                    className={`recommend-artwork ${motion.artworkLoaded ? 'artwork-visible' : ''}`}
                    src={album.artworkUrl}
                    alt=""
                    draggable="false"
                    onError={revealCover}
                    onLoad={revealCover}
                  />
                  <img
                    className={`recommend-cover-loader ${coverLoaderLeaving ? 'cover-loader-leaving' : ''}`}
                    src={albumLoadingImage}
                    alt=""
                    draggable="false"
                  />
                </div>
                <div className={`recommend-card-meta ${contentVisible ? 'content-visible' : ''} ${isCompactMeta ? 'compact-meta' : ''}`}>
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
                  <button
                    className={`recommend-platform-button ${platformOption.tone}`}
                    type="button"
                    onClick={openAlbumPlatform}
                  >
                    {platformOption.buttonLabel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <img
                  className={`recommend-loading-image ${motion.imageLoaded ? 'image-visible' : ''}`}
                  src={albumLoadingImage}
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
