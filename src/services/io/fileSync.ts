/**
 * Optional "linked backup file" via the File System Access API (FSA).
 *
 * IndexedDB stays the live store. Once the user picks a file, every DB write
 * triggers a debounced JSON snapshot to that file (handled in useFileSync).
 *
 * FSA is Chromium-only (Chrome / Edge / Brave / Opera). Safari / Firefox users
 * fall back to manual export/import.
 */

import { settingsRepo } from '../../db/repositories/settingsRepo';
import { mute } from './changeTracker';
import {
  exportAll,
  parseImportFile,
  replaceAll,
  type ExportFile,
} from './exportImport';

type FSPermMode = 'read' | 'readwrite';
type FSPermDescriptor = { mode: FSPermMode };

declare global {
  interface FileSystemFileHandle {
    queryPermission(desc?: FSPermDescriptor): Promise<PermissionState>;
    requestPermission(desc?: FSPermDescriptor): Promise<PermissionState>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }

  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  startIn?: string;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}

const FILE_TYPES = [
  {
    description: 'Finance Tracker backup',
    accept: { 'application/json': ['.json'] },
  },
];

export function isFileSyncSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function'
  );
}

/** Either pick an existing JSON file (open) or create a new one (save). */
export async function pickAndLink(mode: 'open' | 'save'): Promise<FileSystemFileHandle | null> {
  if (!isFileSyncSupported()) {
    throw new Error('此瀏覽器不支援連結備份檔（需要 Chrome / Edge）');
  }
  try {
    const handle =
      mode === 'open'
        ? (await window.showOpenFilePicker!({ multiple: false, types: FILE_TYPES }))[0]
        : await window.showSaveFilePicker!({
            suggestedName: 'finance-tracker.json',
            types: FILE_TYPES,
          });
    return handle;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: FSPermMode = 'readwrite',
  ask: boolean,
): Promise<PermissionState> {
  const status = await handle.queryPermission({ mode });
  if (status === 'granted') return 'granted';
  if (!ask) return status;
  const after = await handle.requestPermission({ mode });
  return after;
}

export async function readLinkedFile(
  handle: FileSystemFileHandle,
): Promise<ExportFile | null> {
  const file = await handle.getFile();
  if (file.size === 0) return null;
  const text = await file.text();
  const raw = JSON.parse(text);
  return parseImportFile(raw);
}

export async function writeLinkedFile(
  handle: FileSystemFileHandle,
  data: ExportFile,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
  } finally {
    await writable.close();
  }
}

/**
 * Snapshot the DB and write it to the linked file. Wrapped in `mute` so the
 * resulting `linkedFile.lastWriteAt` update doesn't re-trigger this path.
 */
export async function syncToFile(handle: FileSystemFileHandle): Promise<ExportFile> {
  const data = await exportAll();
  await writeLinkedFile(handle, data);
  await mute(async () => {
    await settingsRepo.updateLinkedFileWriteMeta({
      lastWriteAt: Date.now(),
      lastWriteExportedAt: data.exportedAt,
    });
  });
  return data;
}

/** Apply a parsed file back into the DB. */
export async function importFromFile(parsed: ExportFile): Promise<void> {
  await mute(async () => {
    await replaceAll(parsed);
    // Mark that the local DB now mirrors this file's exportedAt — anything
    // older won't trigger another reconciliation banner.
    await settingsRepo.updateLinkedFileWriteMeta({
      lastWriteAt: Date.now(),
      lastWriteExportedAt: parsed.exportedAt,
    });
  });
}
