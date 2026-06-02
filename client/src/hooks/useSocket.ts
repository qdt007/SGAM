import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:5000';

export function useSocket() {
  const { socket, connected, setSocket, setConnected, disconnect } = useSocketStore();
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnect();
      return;
    }
    if (socket?.connected) return;

    const newSocket: Socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
    newSocket.on('connect_error', (err) => console.error('[Socket]', err.message));

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  const joinProject = useCallback((projectId: string) => {
    socket?.emit('project:join', { projectId });
  }, [socket]);

  const leaveProject = useCallback((projectId: string) => {
    socket?.emit('project:leave', { projectId });
  }, [socket]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socket?.on(event, handler);
  }, [socket]);

  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    socket?.off(event, handler);
  }, [socket]);

  return { socket, connected, joinProject, leaveProject, on, off };
}
