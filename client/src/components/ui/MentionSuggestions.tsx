import { Avatar } from './Avatar';
import { MentionPerson } from '../../hooks/useMentions';
import { cn } from '../../utils/cn';

/**
 * The @mention picker's list. Shared by the chat composer and the task comment editor so the two
 * cannot drift into behaving differently — they already had, with only one of them showing a
 * picker at all.
 *
 * Positioning is the caller's job, since one sits above its textarea and the other below.
 */
export function MentionSuggestions({
  people,
  highlighted,
  onHighlight,
  onPick,
  className,
}: {
  people: MentionPerson[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (index: number) => void;
  className?: string;
}) {
  if (people.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Thành viên có thể nhắc"
      className={cn(
        'z-30 w-64 overflow-hidden rounded-xl border border-line bg-raised shadow-modal',
        className,
      )}
    >
      {people.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={i === highlighted}
          // Pointer down, not click: the textarea loses focus on mousedown, and a click handler
          // fires after that — by which time the caret position needed for the replacement is gone.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(i);
          }}
          onMouseEnter={() => onHighlight(i)}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
            i === highlighted ? 'bg-primary/10' : 'hover:bg-ink/[0.04]',
          )}
        >
          <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-small text-ink">{p.displayName}</p>
            <p className="truncate text-caption text-ink-muted">@{p.username}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
