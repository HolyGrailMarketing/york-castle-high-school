/**
 * Object storage for uploaded images (Supabase Storage).
 *
 * The multer disk path in middleware/upload.js writes to backend/uploads
 * locally and to os.tmpdir() on serverless, which Vercel wipes on every
 * deploy. Anything that has to survive a deploy goes through here instead.
 *
 * Entirely optional: when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not
 * set, isStorageConfigured() returns false and callers degrade to asking the
 * author for an image path or URL. Importing this module never throws.
 */
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'blog-images';

export const isStorageConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let clientPromise = null;

// Loaded lazily so the dependency is only required when storage is actually
// configured and used.
function getClient() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    );
  }
  return clientPromise;
}

/** Leading bytes, so a renamed .txt can't masquerade as an image. */
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.slice(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.slice(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
      buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function buildKey(originalname) {
  const now = new Date();
  const ext = path.extname(originalname).toLowerCase() || '.bin';
  const base = path
    .basename(originalname, path.extname(originalname))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `blog/${yyyy}/${mm}/${crypto.randomUUID()}-${base}${ext}`;
}

/**
 * Upload an image buffer. Returns { url, path }.
 * Throws if storage is not configured - check isStorageConfigured() first.
 */
export async function uploadImage({ buffer, mimetype, originalname }) {
  if (!isStorageConfigured()) {
    throw new Error('Image storage is not configured');
  }

  const supabase = await getClient();
  const key = buildKey(originalname);

  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: mimetype,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    logger.error('Image upload failed', { error: error.message, bucket: BUCKET, key });
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);

  logger.info('Image uploaded', { bucket: BUCKET, key, size: buffer.length });

  return { url: data.publicUrl, path: key };
}

export async function deleteImage(key) {
  if (!isStorageConfigured()) return false;
  const supabase = await getClient();
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) {
    logger.error('Image delete failed', { error: error.message, key });
    return false;
  }
  return true;
}

export default { isStorageConfigured, uploadImage, deleteImage, sniffImageType };
