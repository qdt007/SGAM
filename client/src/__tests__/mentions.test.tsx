import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMentions, foldVietnamese, type MentionPerson } from '../hooks/useMentions';

/**
 * The @mention picker.
 *
 * It shipped unable to do the one thing it exists for: `/@(\w*)$/` is ASCII-only, so typing
 * "@Hồ" never matched and no picker ever appeared. It also searched every user in the system
 * while the API only resolves a handle for members of that project, so a name could be chosen
 * and then silently dropped. Both are pinned below.
 */

const PEOPLE: MentionPerson[] = [
  { id: 'u1', username: 'hothikieutrang', displayName: 'Hồ Thị Kiều Trang' },
  { id: 'u2', username: 'tranminhkhoa', displayName: 'Trần Minh Khoa' },
  { id: 'u3', username: 'dangngocmai', displayName: 'Đặng Ngọc Mai' },
  { id: 'u4', username: 'tranthimyduyen', displayName: 'Trần Thị Mỹ Duyên' },
];

const names = (list: MentionPerson[]) => list.map((p) => p.username);

describe('foldVietnamese', () => {
  it('strips tone marks so an undecorated search still matches', () => {
    expect(foldVietnamese('Hồ Thị Kiều Trang')).toBe('ho thi kieu trang');
    expect(foldVietnamese('Duyên')).toBe('duyen');
  });

  it('folds đ, which no amount of NFD will touch', () => {
    // đ is its own letter, not d plus a combining mark — the reason "dang" missed "Đặng".
    expect(foldVietnamese('Đặng')).toBe('dang');
    expect(foldVietnamese('Đạt')).toBe('dat');
  });
});

describe('when the picker opens', () => {
  it('opens on a bare @, listing everyone who can be mentioned', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@', 1));
    expect(result.current.isOpen).toBe(true);
    // Nobody knows another person's @username by heart; requiring a letter first meant guessing.
    expect(names(result.current.results)).toEqual(names(PEOPLE));
  });

  it('opens on a Vietnamese handle — the bug this whole thing had', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@Hồ', 3));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe('Hồ');
    // "ho" also sits inside "khoa", so Khoa matches — but the person whose name *starts* with it
    // has to come first, or the list fights whoever is typing.
    expect(names(result.current.results)[0]).toBe('hothikieutrang');
  });

  it('stays shut inside an e-mail address', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('gửi cho bob@', 12));
    expect(result.current.isOpen).toBe(false);
  });

  it('closes once the handle is abandoned', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@tran', 5));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.handleTextChange('xin chào cả nhóm', 16));
    expect(result.current.isOpen).toBe(false);
  });

  it('closes when a space ends the handle', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@tranminhkhoa oi', 16));
    expect(result.current.isOpen).toBe(false);
  });
});

describe('who it offers', () => {
  it('matches the display name without diacritics', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@dang', 5));
    expect(names(result.current.results)).toEqual(['dangngocmai']);
  });

  it('matches the username too', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@kieutrang', 10));
    expect(names(result.current.results)).toEqual(['hothikieutrang']);
  });

  it('ranks a leading match above one buried inside a word', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@tran', 5));
    // "tran" is also inside "Trang", so Kiều Trang matches too — just not first.
    expect(names(result.current.results).slice(0, 2)).toEqual(['tranminhkhoa', 'tranthimyduyen']);
    expect(names(result.current.results)).toContain('hothikieutrang');
  });

  it('offers nobody outside the list it was given', () => {
    // The scoping rule: the server only turns a handle into a mention for project members, so
    // offering anyone else produces a name on screen and no notification.
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@nguyenvanhoang', 15));
    expect(result.current.results).toEqual([]);
  });
});

describe('what it writes back', () => {
  it('replaces the partial handle with the username, not the display name', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('ping @Hồ', 8));
    let out: { newText: string; newCursor: number } | undefined;
    act(() => {
      out = result.current.selectMention(PEOPLE[0], 'ping @Hồ');
    });
    // @username is the only form the server resolves.
    expect(out?.newText).toBe('ping @hothikieutrang ');
    expect(out?.newCursor).toBe('ping @hothikieutrang '.length);
  });

  it('keeps whatever followed the caret', () => {
    const { result } = renderHook(() => useMentions(PEOPLE));
    act(() => result.current.handleTextChange('@tran xem giúp mình', 5));
    let out: { newText: string } | undefined;
    act(() => {
      out = result.current.selectMention(PEOPLE[1], '@tran xem giúp mình');
    });
    expect(out?.newText).toBe('@tranminhkhoa  xem giúp mình');
  });
});
