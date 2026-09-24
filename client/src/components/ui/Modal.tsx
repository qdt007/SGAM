import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

const WIDTH = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

/**
 * Shared dialog chrome: overlay, escape-to-close, click-outside, focus moved
 * into the dialog and body scroll locked while it is open.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof WIDTH;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className={cn('modal-card max-h-[90vh] overflow-y-auto', WIDTH[size])}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="modal-title">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon-sm -mr-1.5 -mt-1" aria-label="Close dialog">
            <Icon icon="ph:x" width={16} aria-hidden />
          </button>
        </div>

        {children}

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** Destructive confirmation — used instead of deleting on a single click. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger btn-sm">
            {loading ? <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-base text-ink-muted">{message}</p>
    </Modal>
  );
}
