/**
 * Supabase Storage access for files that must outlive a single request.
 *
 * The multer setup in middleware/upload.js writes to local disk (os.tmpdir() on
 * serverless), which is fine for the traditional server but useless on Vercel -
 * the file is gone by the next invocation. Anything a visitor needs to download
 * later, like a booklist, has to live in object storage instead.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The target bucket must
 * exist and be public-read; writes go through the service-role key and never
 * touch the client.
 */

import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

let client = null;

// Callers pass the bucket they want. SUPABASE_STORAGE_BUCKET is only the
// fallback - different kinds of file belong in different buckets (booklists are
// not blog images), so don't rely on it.
const getBucketName = (bucket) => bucket || process.env.SUPABASE_STORAGE_BUCKET || 'documents';

/** True when storage is usable. Callers should check before offering uploads. */
export const isStorageConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const getClient = () => {
  if (!isStorageConfigured()) {
    throw new Error(
      'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

/**
 * Upload a buffer and return its public URL.
 *
 * `path` is the key within the bucket. Callers should include a unique segment
 * so a replacement gets a new URL - the CDN caches aggressively, and reusing a
 * key means visitors keep seeing the old file.
 */
export const uploadPublicFile = async (buffer, { path, contentType, bucket: bucketName }) => {
  const bucket = getBucketName(bucketName);
  const supabase = getClient();

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    logger.error('Storage upload failed', { bucket, path, error: error.message });
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  logger.info('Uploaded file to storage', { bucket, path });

  return { path, url: data.publicUrl, bucket };
};

/**
 * Remove a stored object. Never throws - a missing or unremovable object
 * shouldn't block deleting the database row that pointed at it.
 */
export const removeFile = async (path, bucketName) => {
  if (!path || !isStorageConfigured()) return false;

  try {
    const bucket = getBucketName(bucketName);
    const { error } = await getClient().storage.from(bucket).remove([path]);
    if (error) {
      logger.warn('Storage delete failed', { bucket, path, error: error.message });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('Storage delete threw', { path, error: error.message });
    return false;
  }
};
