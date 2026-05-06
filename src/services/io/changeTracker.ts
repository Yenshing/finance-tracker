/**
 * Lightweight pub/sub for "user-data changed" events.
 *
 * Wired into Dexie table hooks (see db/database.ts). Subscribers can debounce
 * file syncs without us having to instrument every repo method by hand.
 *
 * `mute(...)` is used by the file-sync writer to prevent self-triggered loops:
 * writing the file updates `linkedFile.lastWriteAt` in settings, which would
 * fire the settings hook and trigger another write.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let muted = 0;

export function onDataChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyDataChange(): void {
  if (muted > 0) return;
  for (const fn of listeners) fn();
}

export async function mute<T>(fn: () => Promise<T>): Promise<T> {
  muted++;
  try {
    return await fn();
  } finally {
    muted--;
  }
}
