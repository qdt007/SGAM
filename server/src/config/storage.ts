import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../utils/env';

export type StorageType = 'local' | 'cloudinary';
/** What a backend hands back for one saved file; maps straight onto the File columns. */
export interface StoredFile { filename: string; storageKey: string; url: string; }
/** The slice of a multer file the backends need. A real Express.Multer.File satisfies it,
 *  and so can the seed script, which has bytes but never went through an HTTP upload. */
export interface UploadInput { originalname: string; mimetype: string; buffer: Buffer; }

export const STORAGE_TYPE: StorageType = env('STORAGE_TYPE') === 'cloudinary' ? 'cloudinary' : 'local';
export const UPLOADS_DIR = path.resolve(process.cwd(), env('UPLOADS_DIR') ?? 'uploads');
const CLOUDINARY_FOLDER = env('CLOUDINARY_FOLDER') ?? 'pm-uploads';

if (STORAGE_TYPE === 'local') fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Whether Cloudinary is usable, decided by asking the SDK what it actually ended up holding
 * rather than by guessing from environment variables.
 *
 * That matters because the settings can arrive two ways — the three CLOUDINARY_* variables or a
 * single CLOUDINARY_URL — and passing `undefined` for a key would wipe out a value the URL had
 * supplied. Only keys that are set are passed, and the answer comes from `cloudinary.config()`.
 *
 * Without this, a missing configuration failed inside the SDK with "cloud_name is disabled" and
 * reached the browser as a bare "Internal server error".
 */
function configureCloudinary(): string[] {
  const provided: Record<string, string> = {};
  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  const apiKey = env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');
  if (cloudName) provided.cloud_name = cloudName;
  if (apiKey) provided.api_key = apiKey;
  if (apiSecret) provided.api_secret = apiSecret;

  cloudinary.config({ ...provided, secure: true });

  const active = cloudinary.config();
  return (
    [
      ['CLOUDINARY_CLOUD_NAME', active.cloud_name],
      ['CLOUDINARY_API_KEY', active.api_key],
      ['CLOUDINARY_API_SECRET', active.api_secret],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

const missingCloudinary: string[] = STORAGE_TYPE === 'cloudinary' ? configureCloudinary() : [];

if (missingCloudinary.length) {
  console.error(
    `[Storage] STORAGE_TYPE=cloudinary but ${missingCloudinary.join(', ')} ${
      missingCloudinary.length === 1 ? 'is' : 'are'
    } not set. Uploads will be refused until they are.`,
  );
}

/**
 * What /health reports, so a misconfigured deployment is visible without reading the logs.
 *
 * `cloudName` is included because a wrong one is the likeliest mistake — the Cloudinary console
 * shows an API key table whose "Key Name" column reads `Root`, and copying that instead of the
 * cloud name is an easy slip. It is safe to publish: the cloud name appears in the URL of every
 * image the account serves. The key and secret are never reported.
 */
export function storageStatus(): {
  type: StorageType;
  ready: boolean;
  missing: string[];
  cloudName?: string;
} {
  return {
    type: STORAGE_TYPE,
    ready: missingCloudinary.length === 0,
    missing: missingCloudinary,
    ...(STORAGE_TYPE === 'cloudinary' ? { cloudName: cloudinary.config().cloud_name } : {}),
  };
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
  if (missingCloudinary.length) {
    throw Object.assign(
      new Error(`File storage is not configured on this server: ${missingCloudinary.join(', ')} missing.`),
      { status: 503 },
    );
  }
  const filename = randomKey(file.originalname);
  const resourceType = resourceTypeFor(file.mimetype);
  // Cloudinary appends the format to an image delivery URL, so an extension left on the public_id
  // comes out twice (`name.png.png`). `raw` serves the public_id verbatim and needs it kept.
  const publicId = resourceType === 'image' ? filename.replace(/\.[^.]+$/, '') : filename;
  const res = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        resource_type: resourceType,
        use_filename: false,
        unique_filename: false,
      },
      (err, result) => {
        if (err || !result) {
          // Cloudinary's own wording ("Invalid Signature", "Invalid api_key", a timeout) is what
          // distinguishes a wrong credential from an unreachable network. It names no secret, so
          // passing it through is safe and saves a trip to the server logs to find out which.
          const detail = (err as { message?: string } | undefined)?.message ?? 'no response';
          reject(Object.assign(new Error(`Upload to Cloudinary failed: ${detail}`), { status: 502 }));
          return;
        }
        resolve(result);
      },
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
