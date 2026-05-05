import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { mute, onDataChange } from '../services/io/changeTracker';
import {
  ensurePermission,
  importFromFile,
  isFileSyncSupported,
  pickAndLink,
  readLinkedFile,
  syncToFile,
} from '../services/io/fileSync';
import type { ExportFile } from '../services/io/exportImport';
import type { LinkedFileMeta } from '../db/types';

export type FileSyncStatus =
  | { kind: 'disabled' }
  | { kind: 'loading' }
  | { kind: 'unlinked' }
  | { kind: 'needs_permission'; meta: LinkedFileMeta }
  | { kind: 'reconcile'; meta: LinkedFileMeta; remote: ExportFile }
  | {
      kind: 'linked';
      meta: LinkedFileMeta;
      lastWriteAt: number;
      syncing: boolean;
    }
  | { kind: 'error'; message: string };

interface ContextValue {
  status: FileSyncStatus;
  link: (mode: 'open' | 'save') => Promise<void>;
  unlink: () => Promise<void>;
  grantPermission: () => Promise<void>;
  loadFromFile: () => Promise<void>;
  dismissReconciliation: () => Promise<void>;
  clearError: () => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function FileSyncProvider({ children }: { children: ReactNode }) {
  const value = useFileSyncImpl();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFileSync(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error('useFileSync must be used inside <FileSyncProvider>');
  return ctx;
}

async function loadMeta(): Promise<LinkedFileMeta | null> {
  const s = await settingsRepo.get();
  return s.linkedFile ?? null;
}

function useFileSyncImpl(): ContextValue {
  const supported = isFileSyncSupported();
  const [status, setStatus] = useState<FileSyncStatus>(
    supported ? { kind: 'loading' } : { kind: 'disabled' },
  );
  const statusRef = useRef(status);
  statusRef.current = status;

  const setLinked = useCallback((meta: LinkedFileMeta) => {
    setStatus({
      kind: 'linked',
      meta,
      lastWriteAt: meta.lastWriteAt,
      syncing: false,
    });
  }, []);

  const reconcile = useCallback(
    async (meta: LinkedFileMeta, askPermission: boolean) => {
      const perm = await ensurePermission(meta.handle, 'readwrite', askPermission);
      if (perm !== 'granted') {
        setStatus({ kind: 'needs_permission', meta });
        return;
      }
      let remote: ExportFile | null;
      try {
        remote = await readLinkedFile(meta.handle);
      } catch (e) {
        setStatus({
          kind: 'error',
          message: `讀取檔案失敗：${(e as Error).message}`,
        });
        return;
      }
      if (!remote) {
        // Empty file (just created): seed with current DB state.
        try {
          await syncToFile(meta.handle);
          const fresh = await loadMeta();
          if (fresh) setLinked(fresh);
        } catch (e) {
          setStatus({
            kind: 'error',
            message: `寫入檔案失敗：${(e as Error).message}`,
          });
        }
        return;
      }
      if (remote.exportedAt > (meta.lastWriteExportedAt || 0)) {
        setStatus({ kind: 'reconcile', meta, remote });
        return;
      }
      if (remote.exportedAt < (meta.lastWriteExportedAt || 0)) {
        // Local is ahead — silently overwrite the file to catch up.
        try {
          await syncToFile(meta.handle);
          const fresh = await loadMeta();
          if (fresh) setLinked(fresh);
        } catch (e) {
          setStatus({
            kind: 'error',
            message: `寫入檔案失敗：${(e as Error).message}`,
          });
        }
        return;
      }
      setLinked(meta);
    },
    [setLinked],
  );

  // Boot: load any persisted handle and reconcile.
  useEffect(() => {
    if (!supported) return;
    (async () => {
      const meta = await loadMeta();
      if (!meta) {
        setStatus({ kind: 'unlinked' });
        return;
      }
      await reconcile(meta, false);
    })();
  }, [supported, reconcile]);

  // Debounced auto-write whenever DB changes (only while linked).
  useEffect(() => {
    if (status.kind !== 'linked') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onDataChange(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(async () => {
        const cur = statusRef.current;
        if (cur.kind !== 'linked') return;
        setStatus({ ...cur, syncing: true });
        try {
          await syncToFile(cur.meta.handle);
          const fresh = await loadMeta();
          if (fresh) {
            setStatus({
              kind: 'linked',
              meta: fresh,
              lastWriteAt: fresh.lastWriteAt,
              syncing: false,
            });
          }
        } catch (e) {
          setStatus({
            kind: 'error',
            message: `自動寫入失敗：${(e as Error).message}`,
          });
        }
      }, 1000);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [status]);

  const link = useCallback(
    async (mode: 'open' | 'save') => {
      if (!supported) return;
      let handle: FileSystemFileHandle | null;
      try {
        handle = await pickAndLink(mode);
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message });
        return;
      }
      if (!handle) return; // user cancelled
      const meta: LinkedFileMeta = {
        handle,
        name: handle.name,
        linkedAt: Date.now(),
        lastWriteAt: 0,
        lastWriteExportedAt: 0,
      };
      await mute(() => settingsRepo.setLinkedFile(meta));
      await reconcile(meta, true);
    },
    [supported, reconcile],
  );

  const unlink = useCallback(async () => {
    await mute(() => settingsRepo.clearLinkedFile());
    setStatus({ kind: 'unlinked' });
  }, []);

  const grantPermission = useCallback(async () => {
    const cur = statusRef.current;
    if (cur.kind !== 'needs_permission') return;
    await reconcile(cur.meta, true);
  }, [reconcile]);

  const loadFromFile = useCallback(async () => {
    const cur = statusRef.current;
    if (cur.kind !== 'reconcile') return;
    try {
      await importFromFile(cur.remote);
      const fresh = await loadMeta();
      if (fresh) setLinked(fresh);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: `匯入檔案失敗：${(e as Error).message}`,
      });
    }
  }, [setLinked]);

  const dismissReconciliation = useCallback(async () => {
    const cur = statusRef.current;
    if (cur.kind !== 'reconcile') return;
    try {
      await syncToFile(cur.meta.handle);
      const fresh = await loadMeta();
      if (fresh) setLinked(fresh);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: `寫入檔案失敗：${(e as Error).message}`,
      });
    }
  }, [setLinked]);

  const clearError = useCallback(() => {
    setStatus((s) => (s.kind === 'error' ? { kind: 'unlinked' } : s));
  }, []);

  return {
    status,
    link,
    unlink,
    grantPermission,
    loadFromFile,
    dismissReconciliation,
    clearError,
  };
}
