import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useMentions } from '../../hooks/useMentions';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';

interface CommentEditorProps {
  onSubmit: (body: string) => void;
  isPending?: boolean;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentEditor({
  onSubmit,
  isPending,
  initialValue = '',
  placeholder = 'Write a comment… use @ to mention someone',
  submitLabel = 'Comment',
  onCancel,
  autoFocus,
}: CommentEditorProps) {
  const [text, setText] = useState(initialValue);
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { results, isOpen, handleTextChange, selectMention, closeMentions } = useMentions();

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    setHighlighted(0);
  }, [results]);

  const applyMention = (index: number) => {
    const user = results[index];
    if (!user) return;
    const { newText, newCursor } = selectMention(user, text);
    setText(newText);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % results.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + results.length) % results.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(highlighted);
        return;
      }
      if (e.key === 'Escape') {
        closeMentions();
        return;
      }
    }
    // Cmd/Ctrl+Enter submits, plain Enter keeps writing — comments are often multi-line.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body || isPending) return;
    onSubmit(body);
    setText('');
    closeMentions();
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={text}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          handleTextChange(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        className="input resize-y min-h-[76px]"
      />

      {isOpen && results.length > 0 && (
        <div className="absolute left-3 bottom-[72px] z-30 w-64 rounded-xl border border-black/[0.06] bg-raised shadow-modal overflow-hidden">
          {results.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => applyMention(i)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                i === highlighted ? 'bg-primary/10' : 'hover:bg-black/[0.03]',
              )}
            >
              <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{u.displayName}</p>
                <p className="text-xs text-ink-muted truncate">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-ink-muted">⌘/Ctrl + Enter to send</p>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-ghost text-sm px-3 py-1.5">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || isPending}
            className="btn-primary text-sm px-4 py-1.5"
          >
            {isPending ? <Icon icon="ph:circle-notch" width={16} className="animate-spin" /> : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
