import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type StorageType = 'local' | 'cloudinary';
/** What a backend hands back for one saved file; maps straight onto the File columns. */
export interface StoredFile { filename: string; storageKey: string; url: string; }
/** The slice of a multer file the backends need. A real Express.Multer.File satisfies it,
 *  and so can the seed script, which has bytes but never went through an HTTP upload. */
export interface UploadInput { originalname: string; mimetype: string; buffer: Buffer; }

export const STORAGE_TYPE: StorageType = process.env.STORAGE_TYPE === 'cloudinary' ? 'cloudinary' : 'local';
export const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads');
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'pm-uploads';

if (STORAGE_TYPE === 'local') fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

if (STORAGE_TYPE === 'cloudinary') {
  // The SDK also reads CLOUDINARY_URL on its own; these three win when they are set.
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Cloudinary splits its API by resource_type and needs the same one to delete that it got to
 * upload. Deriving it from the mime type keeps save and remove in agreement without a second
 * column on File. Only real raster images go to `image`; pdf and svg would land there under
 * `auto`, where Cloudinary treats them as transformable and mangles downloads.
 */
export function resourceTypeFor(mimeType: string): 'image' | 'raw' {
  return /^image\/(png|jpeg|gif|webp)$/.test(mimeType) ? 'image' : 'raw';
}

/** Never trust the client filename on disk — a random key, with the original kept in the DB. */
function randomKey(originalName: string): string {
  return `${crypto.randomUUID()}${path.extname(originalName).slice(0, 10)}`;
}

async function saveLocal(file: UploadInput): Promise<StoredFile> {
  const filename = randomKey(file.originalname);
  await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return { filename, storageKey: filename, url: `/uploads/${filename}` };
}

async function saveCloudinary(file: UploadInput): Promise<StoredFile> {
  const filename = randomKey(file.originalname);
  const res = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: filename,
        resource_type: resourceTypeFor(file.mimetype),
        use_filename: false,
        unique_filename: false,
      },
      (err, result) => (err || !result ? reject(err ?? new Error('Cloudinary upload failed')) : resolve(result)),
    );
    stream.end(file.buffer);
  });
  return { filename, storageKey: res.public_id, url: res.secure_url };
}

export async function saveFile(file: UploadInput): Promise<StoredFile> {
  return STORAGE_TYPE === 'cloudinary' ? saveCloudinary(file) : saveLocal(file);
}

/** Best-effort: the DB row is the source of truth, a leftover blob is not worth failing over. */
export async function removeFile(storageKey: string, mimeType: string): Promise<void> {
  if (STORAGE_TYPE === 'cloudinary') {
    await cloudinary.uploader
      .destroy(storageKey, { resource_type: resourceTypeFor(mimeType), invalidate: true })
      .catch(() => undefined);
    return;
  }
  await fs.unlink(path.join(UPLOADS_DIR, storageKey)).catch(() => undefined);
}
