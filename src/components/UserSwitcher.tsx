import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
  addUser,
  deleteUser,
  getActiveUser,
  listUsers,
  renameUser,
  setActiveUser,
  type UserMeta,
} from '../state/userRegistry';
import { dropUserDatabase } from '../db/database';

export default function UserSwitcher() {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = getActiveUser();
  const users = listUsers();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSwitch(id: string) {
    if (id === active.id) {
      setOpen(false);
      return;
    }
    setActiveUser(id);
    window.location.reload();
  }

  function handleAdd() {
    setOpen(false);
    const name = window.prompt('新使用者名稱')?.trim();
    if (!name) return;
    let user: UserMeta;
    try {
      user = addUser(name);
    } catch (e) {
      window.alert((e as Error).message);
      return;
    }
    if (window.confirm(`已新增「${user.name}」。要立即切換過去嗎？`)) {
      setActiveUser(user.id);
      window.location.reload();
    }
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <UserIcon />
          <span>{active.name}</span>
          <ChevronDownIcon />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400">
              切換使用者
            </div>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                role="menuitem"
                onClick={() => handleSwitch(u.id)}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100',
                  u.id === active.id && 'font-semibold text-gray-900',
                )}
              >
                <span className="flex-1">{u.name}</span>
                {u.id === active.id && (
                  <span className="text-xs text-gray-400">使用中</span>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              role="menuitem"
              onClick={handleAdd}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              + 新增使用者
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setManageOpen(true);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              管理使用者…
            </button>
          </div>
        )}
      </div>

      {manageOpen && <ManageModal onClose={() => setManageOpen(false)} />}
    </>
  );
}

function ManageModal({ onClose }: { onClose: () => void }) {
  const active = getActiveUser();
  const [users, setUsers] = useState<UserMeta[]>(listUsers());

  function refresh() {
    setUsers(listUsers());
  }

  function handleRename(u: UserMeta) {
    const name = window.prompt('新名稱', u.name)?.trim();
    if (!name || name === u.name) return;
    try {
      renameUser(u.id, name);
      refresh();
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleDelete(u: UserMeta) {
    if (u.id === active.id) {
      window.alert('不能刪除目前使用中的使用者；請先切換到其他人。');
      return;
    }
    const ok = window.confirm(
      `刪除「${u.name}」？\n\n這會永久刪除其所有資產資料、快照與設定，無法復原。\n` +
        `（連結的備份檔本身不會被刪除；要的話請手動到雲端刪。）`,
    );
    if (!ok) return;
    try {
      deleteUser(u.id);
      await dropUserDatabase(u.id);
      refresh();
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">管理使用者</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            aria-label="關閉"
          >
            ✕
          </button>
        </header>
        <ul className="divide-y divide-gray-100">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 py-2 text-sm"
            >
              <span className="flex-1">
                {u.name}
                {u.id === active.id && (
                  <span className="ml-2 text-xs text-gray-400">使用中</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleRename(u)}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                重新命名
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(u)}
                disabled={u.id === active.id || users.length <= 1}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          每個使用者擁有獨立的 IndexedDB 與連結備份檔；切換使用者會重新載入頁面。
        </p>
      </div>
    </div>,
    document.body,
  );
}

function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
