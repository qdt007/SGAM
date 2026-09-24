import { forwardRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quietDanger';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  quietDanger: 'btn-quiet-danger',
};

const SIZE: Record<Size, string> = { xs: 'btn-xs', sm: 'btn-sm', md: '', lg: 'btn-lg' };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Swaps the label for a spinner and blocks the click, keeping the button's width. */
  loading?: boolean;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, iconOnly, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        VARIANT[variant],
        SIZE[size],
        iconOnly && (size === 'sm' || size === 'xs' ? 'btn-icon-sm' : 'btn-icon'),
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Icon icon="ph:circle-notch" className="animate-spin" width={15} aria-hidden />
          {!iconOnly && children}
        </>
      ) : (
        children
      )}
    </button>
  );
});
