import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosClient';
import { User } from '../types';
import { keys } from '../constants/queryKeys';
export function useMentions() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const triggerIndex = useRef(-1);
  const { data: results = [], isLoading } = useQuery({
    queryKey: keys.users.search(query),
    queryFn: async () => {
      if (!query) return [];
      const res = await api.get('/users/search', { params: { q: query } });
      return res.data.data as User[];
    },
    enabled: isOpen && query.length > 0,
    staleTime: 30_000,
  });
  const handleTextChange = useCallback((text: string, cursorPos: number) => {
    const match = text.slice(0, cursorPos).match(/@(\w*)$/);
    if (match) { setQuery(match[1]); setIsOpen(true); triggerIndex.current = cursorPos - match[0].length; }
    else { setIsOpen(false); setQuery(''); triggerIndex.current = -1; }
  }, []);
  const selectMention = useCallback((user: User, currentText: string) => {
    const before = currentText.slice(0, triggerIndex.current);
    const after = currentText.slice(triggerIndex.current + query.length + 1);
    const mention = '@' + user.username + ' ';
    setIsOpen(false); setQuery(''); triggerIndex.current = -1;
    return { newText: before + mention + after, newCursor: before.length + mention.length };
  }, [query.length]);
  return { query, results, isOpen, isLoading, handleTextChange, selectMention, closeMentions: () => { setIsOpen(false); setQuery(''); } };
}
