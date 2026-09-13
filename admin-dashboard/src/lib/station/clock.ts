import { getMeta, setMeta } from './db';

/**
 * Keeping the station's idea of the time honest.
 *
 * A counter laptop stamps its own clock onto every scan, and school laptops are
 * routinely minutes or hours out. Every response from the server carries
 * X-Server-Time; the difference is remembered and added to each scan's
 * timestamp before it is queued.
 *
 * This only corrects the *recorded* time. Ordering within the station is the
 * queue's own sequence number, so even a wildly wrong clock - or someone fixing
 * the date halfway through a shift - cannot reorder anything.
 */

let offsetMs = 0;

export const loadOffset = async () => {
  offsetMs = await getMeta<number>('serverTimeOffsetMs', 0);
  return offsetMs;
};

export const getOffset = () => offsetMs;

/** Record the gap between this computer's clock and the school's. */
export const noteServerTime = (header: string | null | undefined) => {
  if (!header) return;
  const server = Date.parse(header);
  if (Number.isNaN(server)) return;
  offsetMs = server - Date.now();
  void setMeta('serverTimeOffsetMs', offsetMs);
};

/** Now, as the school's clock would have it. */
export const correctedNow = (): Date => new Date(Date.now() + offsetMs);

/**
 * Worth telling the librarian about? Only past a few minutes - below that it is
 * noise, and above it they will otherwise report the timestamps as a bug.
 */
export const skewWarning = (): string | null => {
  const minutes = Math.round(Math.abs(offsetMs) / 60000);
  if (minutes < 5) return null;
  const direction = offsetMs < 0 ? 'fast' : 'slow';
  return `This computer's clock is about ${minutes} minutes ${direction}. Scans are still saved with the correct time.`;
};
