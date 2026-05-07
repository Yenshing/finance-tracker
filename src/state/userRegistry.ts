/**
 * Multi-user (vault) registry persisted in localStorage.
 *
 * Each user has its own isolated Dexie database (see db/database.ts), so
 * switching is just "pick a user → reload the page". The default user is
 * special-cased to keep using the legacy `finance-tracker` DB name so existing
 * data continues to work without migration.
 */

const STORAGE_KEY = 'finance-tracker:user-registry';
export const DEFAULT_USER_ID = 'default';

export interface UserMeta {
  id: string;
  name: string;
  createdAt: number;
}

interface Registry {
  users: UserMeta[];
  activeUserId: string;
}

function buildInitial(): Registry {
  return {
    users: [{ id: DEFAULT_USER_ID, name: '預設', createdAt: Date.now() }],
    activeUserId: DEFAULT_USER_ID,
  };
}

function isValidRegistry(v: unknown): v is Registry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<Registry>;
  return (
    Array.isArray(o.users) &&
    o.users.length > 0 &&
    o.users.every(
      (u) =>
        u &&
        typeof u.id === 'string' &&
        typeof u.name === 'string' &&
        typeof u.createdAt === 'number',
    ) &&
    typeof o.activeUserId === 'string' &&
    o.users.some((u) => u.id === o.activeUserId)
  );
}

let cached: Registry | null = null;

function readStorage(): Registry {
  if (cached) return cached;
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidRegistry(parsed)) {
        cached = parsed;
        return parsed;
      }
    }
  } catch {
    /* fall through */
  }
  const initial = buildInitial();
  cached = initial;
  writeStorage(initial);
  return initial;
}

function writeStorage(r: Registry): void {
  cached = r;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    }
  } catch {
    /* quota or storage disabled */
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listUsers(): UserMeta[] {
  return [...readStorage().users].sort((a, b) => a.createdAt - b.createdAt);
}

export function getActiveUserId(): string {
  return readStorage().activeUserId;
}

export function getActiveUser(): UserMeta {
  const reg = readStorage();
  return reg.users.find((u) => u.id === reg.activeUserId) ?? reg.users[0];
}

export function setActiveUser(id: string): void {
  const reg = readStorage();
  if (!reg.users.some((u) => u.id === id)) return;
  writeStorage({ ...reg, activeUserId: id });
}

export function addUser(name: string): UserMeta {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('名稱不可空白');
  const reg = readStorage();
  if (reg.users.some((u) => u.name === trimmed)) {
    throw new Error(`已有名稱「${trimmed}」`);
  }
  const user: UserMeta = { id: newId(), name: trimmed, createdAt: Date.now() };
  writeStorage({ ...reg, users: [...reg.users, user] });
  return user;
}

export function renameUser(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('名稱不可空白');
  const reg = readStorage();
  if (reg.users.some((u) => u.id !== id && u.name === trimmed)) {
    throw new Error(`已有名稱「${trimmed}」`);
  }
  writeStorage({
    ...reg,
    users: reg.users.map((u) => (u.id === id ? { ...u, name: trimmed } : u)),
  });
}

export function deleteUser(id: string): void {
  const reg = readStorage();
  if (reg.users.length <= 1) throw new Error('至少要保留一個使用者');
  if (id === reg.activeUserId) throw new Error('不能刪除目前使用中的使用者');
  writeStorage({
    ...reg,
    users: reg.users.filter((u) => u.id !== id),
  });
}

export function dbNameFor(userId: string): string {
  return userId === DEFAULT_USER_ID
    ? 'finance-tracker'
    : `finance-tracker:${userId}`;
}
