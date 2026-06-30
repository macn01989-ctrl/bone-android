import { useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { Haptics } from '@capacitor/haptics';
import { Settings } from 'lucide-react';
import type { AppView } from '../../shared/types';
import { fitImage } from '../../shared/assets';
import { clamp } from '../../shared/number';

type TouchState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  rotation: number;
  active: boolean;
  longPress: boolean;
  tap: boolean;
};

type GestureSnapshot = {
  isDown: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

const initialTouch: TouchState = {
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  rotation: 0,
  active: false,
  longPress: false,
  tap: false,
};

export function HomeView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  const [touch, setTouch] = useState<TouchState>(initialTouch);
  const lastTapRef = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const gestureRef = useRef<GestureSnapshot>({
    isDown: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    moved: false,
  });

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const vibrateShort = async () => {
    try {
      await Haptics.vibrate({ duration: 28 });
    } catch {
      navigator.vibrate?.(28);
    }
  };

  const vibrateDouble = async () => {
    await vibrateShort();
    window.setTimeout(() => {
      void vibrateShort();
    }, 55);
  };

  const navigateWithReset = (next: AppView) => {
    window.setTimeout(() => {
      gestureRef.current.isDown = false;
      setTouch(initialTouch);
      onNavigate(next);
    }, 120);
  };

  const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    const point = event.touches[0];
    if (!point) return;

    event.preventDefault();
    clearLongPress();
    gestureRef.current = {
      isDown: true,
      startX: point.clientX,
      startY: point.clientY,
      x: 0,
      y: 0,
      moved: false,
    };
    setTouch({
      ...initialTouch,
      startX: point.clientX,
      startY: point.clientY,
      active: true,
    });

    longPressTimer.current = window.setTimeout(() => {
      void vibrateDouble();
      setTouch((current) => ({
        ...current,
        active: false,
        longPress: true,
      }));
      window.setTimeout(() => navigateWithReset('recorder'), 600);
    }, 600);
  };

  const handleTouchMove = (event: TouchEvent<HTMLButtonElement>) => {
    if (!gestureRef.current.isDown) return;

    const point = event.touches[0];
    if (!point) return;

    event.preventDefault();
    const deltaX = point.clientX - gestureRef.current.startX;
    const deltaY = point.clientY - gestureRef.current.startY;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearLongPress();
      gestureRef.current.moved = true;
    }

    const maxDistance = 150;
    const distance = Math.hypot(deltaX, deltaY);
    const ratio = distance > maxDistance ? maxDistance / distance : 1;
    const x = deltaX * ratio;
    const y = deltaY * ratio;
    gestureRef.current.x = x;
    gestureRef.current.y = y;
    setTouch((current) => ({
      ...current,
      x,
      y,
      rotation: clamp((deltaX + deltaY) * 0.08, -14, 14),
      active: true,
    }));
  };

  const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearLongPress();
    const { x, y, moved } = gestureRef.current;
    const distance = Math.hypot(x, y);

    gestureRef.current.isDown = false;

    if (!moved || distance < 8) {
      handleTap();
      return;
    }

    if (Math.abs(x) > Math.abs(y) && x < 0 && distance > 24) {
      navigateWithReset('favorites');
      return;
    }

    if (distance > 48) {
      if (Math.abs(x) > Math.abs(y) && x > 0) {
        navigateWithReset('notes');
        return;
      }

      if (Math.abs(y) > Math.abs(x)) {
        navigateWithReset(y > 0 ? 'album' : 'podcast');
        return;
      }
    }

    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      longPress: false,
    }));
  };

  const handleTouchCancel = () => {
    clearLongPress();
    gestureRef.current.isDown = false;
    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      longPress: false,
    }));
  };

  const handleTap = () => {
    const now = Date.now();

    if (now - lastTapRef.current < 300) {
      navigateWithReset('note');
      return;
    }

    lastTapRef.current = now;
    setTouch((current) => ({
      ...current,
      x: 0,
      y: 0,
      rotation: 0,
      active: false,
      tap: true,
    }));
    window.setTimeout(() => {
      setTouch((current) => ({ ...current, tap: false }));
    }, 450);
  };

  const className = [
    'inner-block',
    touch.active ? 'active' : '',
    touch.longPress ? 'long-press' : '',
    touch.tap ? 'tap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="home-screen" aria-label="Bone home">
      <div className="grid-line horizontal-line line-one" />
      <div className="grid-line horizontal-line line-two" />
      <div className="grid-line vertical-line line-three" />
      <div className="grid-line vertical-line line-four" />

      <div className="outer-diamond" aria-hidden="true">
        <button
          className={className}
          style={{
            transform: `translate3d(${touch.x}px, ${touch.y}px, 0) rotate(${touch.rotation}deg) scale(${touch.tap ? 0.9 : 1})`,
          }}
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <img className="center-image" src={fitImage} alt="" draggable="false" />
        </button>
      </div>

      <button
        className="settings-fab"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNavigate('settings');
        }}
        aria-label="打开设置"
        title="设置"
      >
        <Settings size={24} strokeWidth={2.4} />
      </button>
    </section>
  );
}
