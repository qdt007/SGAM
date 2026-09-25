import { useState } from 'react';
import { cn } from '../../utils/cn';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-16 w-16 text-2xl',
} as const;

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * User avatar with an initial as the fallback. The image is also dropped on a load error, so a
 * deleted Cloudinary blob or a dead external URL degrades to the initial instead of a broken icon.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  const base = cn(
    'shrink-0 rounded-full object-cover',
    SIZES[size],
    className,
  );

  if (src && !failed) {
    return <img src={src} alt="" aria-hidden className={base} onError={() => setFailed(true)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(base, 'flex items-center justify-center bg-primary font-semibold text-white')}
    >
      {initial}
    </span>
  );
}
