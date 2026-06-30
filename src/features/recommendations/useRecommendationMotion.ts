import { useLayoutEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';

type RecommendationDirection = '' | 'left' | 'right' | 'up' | 'down';

type RecommendationTouchState = {
  startX: number;
  startY: number;
  startTime: number;
  swipeDetected: boolean;
};

export function useRecommendationMotion(onSwipeUp: () => void, onSwipeDown?: () => void, resetKey?: unknown) {
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
