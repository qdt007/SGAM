import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useMentions, MentionPerson } from '../../hooks/useMentions';
import { MentionSuggestions } from '../ui/MentionSuggestions';

interface CommentEditorProps {
  /** Who can be mentioned here — the task's project members, and nobody else. */
  people: MentionPerson[];
  onSubmit: (body: string) => void;
  isPending?: boolean;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentEditor({
  people,
  onSubmit,
  isPending,
  initialValue = '',
  placeholder = 'Viết bình luận… gõ @ để nhắc ai đó',
  submitLabel = 'Bình luận',
  onCancel,
  autoFocus,
}: CommentEditorProps) {
  const [text, setText] = useState(initialValue);
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { results, isOpen, handleTextChange, selectMention, closeMentions } = useMentions(people);

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

      {isOpen && (
        <MentionSuggestions
          people={results}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onPick={applyMention}
          className="absolute bottom-[72px] left-3"
        />
      )}

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-ink-muted">⌘/Ctrl + Enter to send</p>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-ghost text-sm px-3 py-1.5">
              Huỷ
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
