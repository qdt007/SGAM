import { useState, useCallback, useMemo, useRef } from 'react';

export interface MentionPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * Folds Vietnamese so typing without diacritics still finds people: "ho" matches "Hồ", "duyen"
 * matches "Duyên", "dat" matches "Đạt". Nobody types tone marks to look somebody up.
 *
 * `đ` needs its own line — it is a distinct letter, not a `d` with a combining mark, so NFD
 * leaves it alone and "dang" would never find "Đặng".
 */
export function foldVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * The @mention picker, filtered over the people who can actually be mentioned.
 *
 * It takes the candidate list rather than searching the server, and that is the point: the API
 * only turns an @handle into a real mention for **members of that project**. Searching every user
 * let you pick somebody outside it, after which the mention was silently dropped — a name on
 * screen, no notification, and nothing to say why.
 *
 * Opening on a bare `@` is also deliberate. Mentions address people by `@username`, which nobody
 * knows by heart; requiring a first letter before showing anything meant guessing.
 */
export function useMentions(people: MentionPerson[]) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  /** Index of the `@` that opened the picker, so the replacement knows what to overwrite. */
  const triggerIndex = useRef(-1);

  /**
   * 0 the handle or the name starts with what was typed, 1 some word in the name does, 2 it
   * merely appears somewhere, -1 no match.
   *
   * Ranking matters because the match is a substring: "ho" is inside "khoa" and "tran" is inside
   * "trang", so an unranked list puts people who happen to contain the letters above the person
   * being typed. Still a substring rather than a prefix, so a surname finds someone too.
   */
  const rank = useCallback((person: MentionPerson, q: string): number => {
    const name = foldVietnamese(person.displayName);
    const handle = foldVietnamese(person.username);
    if (handle.startsWith(q) || name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (handle.includes(q) || name.includes(q)) return 2;
    return -1;
  }, []);

  const results = useMemo(() => {
    if (!isOpen) return [];
    const q = foldVietnamese(query);
    if (!q) return people.slice(0, 8);
    return people
      .map((person) => ({ person, score: rank(person, q) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((r) => r.person);
  }, [isOpen, query, people, rank]);

  const closeMentions = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    triggerIndex.current = -1;
  }, []);

  const handleTextChange = useCallback(
    (text: string, cursorPos: number) => {
      const before = text.slice(0, cursorPos);
      // `@` has to start a word, and the handle runs to the first space. `[^\s@]*` rather than
      // `\w*`: `\w` is ASCII-only, so "@Hồ" failed to match at all and the picker never opened.
      const m = before.match(/(?:^|[\s(])@([^\s@]*)$/);
      if (!m) {
        closeMentions();
        return;
      }
      setQuery(m[1]);
      setIsOpen(true);
      triggerIndex.current = cursorPos - m[1].length - 1;
    },
    [closeMentions],
  );

  const selectMention = useCallback(
    (user: MentionPerson, currentText: string) => {
      const at = triggerIndex.current;
      const before = currentText.slice(0, at);
      const after = currentText.slice(at + 1 + query.length);
      // The username, never the display name: that is the form the server resolves.
      const mention = `@${user.username} `;
      closeMentions();
      return { newText: before + mention + after, newCursor: before.length + mention.length };
    },
    [query.length, closeMentions],
  );

  return { query, results, isOpen, handleTextChange, selectMention, closeMentions };
}
