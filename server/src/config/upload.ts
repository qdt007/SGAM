import multer from 'multer';
import { Request } from 'express';
import { UPLOADS_DIR } from './storage';

export { UPLOADS_DIR };
export const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_MB || '10', 10) * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/zip', 'application/json',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// Buffered, not streamed to disk: the storage backend decides where the bytes land, and the
// cloud one has no local path to stream to. Capped at 5 x 10MB by the limits below.
const storage = multer.memoryStorage();

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { status: 415 }));
    return;
  }
  cb(null, true);
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 5 } });
