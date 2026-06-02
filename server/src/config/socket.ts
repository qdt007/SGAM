import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
let io: Server;
export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET','POST'], credentials: true } });
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      (socket as Socket & { userId: string }).userId = payload.userId;
      next();
    } catch { next(new Error('Invalid or expired token')); }
  });
  io.on('connection', (socket: Socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    socket.join(`user:${userId}`);
    socket.on('project:join', ({ projectId }: { projectId: string }) => socket.join(`project:${projectId}`));
    socket.on('project:leave', ({ projectId }: { projectId: string }) => socket.leave(`project:${projectId}`));
  });
  return io;
}
export function getIO(): Server { if (!io) throw new Error('Socket.io not initialized'); return io; }
export function emitToUser(userId: string, event: string, data: unknown): void { getIO().to(`user:${userId}`).emit(event, data); }
export function emitToProject(projectId: string, event: string, data: unknown): void { getIO().to(`project:${projectId}`).emit(event, data); }
