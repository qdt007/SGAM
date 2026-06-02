import { create } from 'zustand';
import { Socket } from 'socket.io-client';
interface SocketState { socket:Socket|null; connected:boolean; setSocket:(s:Socket)=>void; setConnected:(c:boolean)=>void; disconnect:()=>void; }
export const useSocketStore = create<SocketState>()((set, get) => ({
  socket: null, connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  disconnect: () => { get().socket?.disconnect(); set({ socket: null, connected: false }); },
}));
