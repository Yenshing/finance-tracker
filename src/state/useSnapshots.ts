import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Snapshot } from '../db/types';

export function useSnapshots(): Snapshot[] | undefined {
  return useLiveQuery(() => db.snapshots.orderBy('takenAt').toArray());
}
