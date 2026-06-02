import { useEffect, useRef, useCallback } from 'react';

interface Options {
  onLoadMore: () => void;
  hasNextPage: boolean;
  isLoading: boolean;
  rootMargin?: string;
}

export function useInfiniteScroll({ onLoadMore, hasNextPage, isLoading, rootMargin = '100px' }: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isLoading) onLoadMore();
    },
    [onLoadMore, hasNextPage, isLoading]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect, rootMargin]);

  return { sentinelRef };
}
