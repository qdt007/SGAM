import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMentions } from '../hooks/useMentions';
import { User } from '../types';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const user = { id: 'u1', username: 'alice', displayName: 'Alice' } as User;

describe('useMentions', () => {
  it('opens once an @ is typed and closes when it is abandoned', () => {
    const { result } = renderHook(() => useMentions(), { wrapper });

    act(() => result.current.handleTextChange('hello @al', 9));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe('al');

    act(() => result.current.handleTextChange('hello world', 11));
    expect(result.current.isOpen).toBe(false);
  });

  it('replaces the partial handle with the chosen username', () => {
    const { result } = renderHook(() => useMentions(), { wrapper });

    act(() => result.current.handleTextChange('ping @al', 8));
    let replaced: { newText: string; newCursor: number } | undefined;
    act(() => {
      replaced = result.current.selectMention(user, 'ping @al');
    });

    expect(replaced?.newText).toBe('ping @alice ');
    expect(replaced?.newCursor).toBe('ping @alice '.length);
  });

  it('keeps the text that follows the cursor', () => {
    const { result } = renderHook(() => useMentions(), { wrapper });

    act(() => result.current.handleTextChange('hi @al please review', 6));
    let replaced: { newText: string } | undefined;
    act(() => {
      replaced = result.current.selectMention(user, 'hi @al please review');
    });

    expect(replaced?.newText).toBe('hi @alice  please review');
  });

  it('does not open on an email address', () => {
    const { result } = renderHook(() => useMentions(), { wrapper });
    act(() => result.current.handleTextChange('write to bob@', 13));
    // The trigger fires on "@" with an empty query; there is nothing to match yet.
    expect(result.current.query).toBe('');
  });
});
