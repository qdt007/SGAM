import { useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';

const ITEM_H = 40;
const VISIBLE = 5; // odd number so middle is selected

interface DrumProps {
  items: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}

export function DrumColumn({ items, value, onChange, label }: DrumProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);

  const scrollToValue = useCallback(
    (v: number, smooth = true) => {
      const idx = items.findIndex((i) => i.value === v);
      if (idx < 0 || !listRef.current) return;
      listRef.current.scrollTo({
        top: idx * ITEM_H,
        behavior: smooth ? 'smooth' : 'instant',
      });
    },
    [items],
  );

  // Initial scroll on mount or value change
  useEffect(() => {
    scrollToValue(value, false);
  }, [value, scrollToValue]);

  const snapToNearest = useCallback(() => {
    if (!listRef.current) return;
    const idx = Math.round(listRef.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    onChange(items[clamped].value);
    listRef.current.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
  }, [items, onChange]);

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startScroll.current = listRef.current?.scrollTop ?? 0;
    e.preventDefault();
  };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !listRef.current) return;
    const delta = startY.current - e.clientY;
    listRef.current.scrollTop = startScroll.current + delta;
  }, []);
  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    snapToNearest();
  }, [snapToNearest]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startScroll.current = listRef.current?.scrollTop ?? 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!listRef.current) return;
    const delta = startY.current - e.touches[0].clientY;
    listRef.current.scrollTop = startScroll.current + delta;
  };

  // Scroll wheel
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!listRef.current) return;
    listRef.current.scrollTop += e.deltaY;
    clearTimeout((listRef.current as HTMLDivElement & { _wt?: ReturnType<typeof setTimeout> })._wt);
    (listRef.current as HTMLDivElement & { _wt?: ReturnType<typeof setTimeout> })._wt = setTimeout(snapToNearest, 150);
  };

  const selectedIdx = items.findIndex((i) => i.value === value);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>

      <div className="relative" style={{ height: ITEM_H * VISIBLE, width: 64 }}>
        {/* Selection highlight band — Apple soft blue */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none rounded-lg bg-primary/[0.08] dark:bg-primary/15"
          style={{ top: ITEM_H * 2, height: ITEM_H }}
        />

        {/* Scrollable list — edges faded via mask (background-independent) */}
        <div
          ref={listRef}
          className="h-full overflow-y-scroll cursor-grab active:cursor-grabbing"
          style={{
            scrollbarWidth: 'none',
            scrollSnapType: 'y mandatory',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={snapToNearest}
          onWheel={onWheel}
        >
          {/* Top padding to center first item */}
          <div style={{ height: ITEM_H * 2 }} />

          {items.map((item, idx) => {
            const dist = Math.abs(idx - selectedIdx);
            const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.2;
            const scale = dist === 0 ? 1 : 0.85;
            return (
              <div
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  scrollToValue(item.value);
                }}
                className={cn(
                  'flex items-center justify-center text-center transition-all duration-150 cursor-pointer tabular-nums',
                  dist === 0 ? 'text-ink text-lg font-semibold' : 'text-ink-muted text-base font-normal',
                )}
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: 'center',
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                {item.label}
              </div>
            );
          })}

          {/* Bottom padding */}
          <div style={{ height: ITEM_H * 2 }} />
        </div>
      </div>
    </div>
  );
}
