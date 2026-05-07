import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import clsx from 'clsx';
import Dashboard from './routes/Dashboard';
import AssetsList from './routes/AssetsList';
import AssetForm from './routes/AssetForm';
import Settings from './routes/Settings';
import FileSyncBanner from './components/FileSyncBanner';
import UserSwitcher from './components/UserSwitcher';
import { ensureFreshFx } from './services/fx/erApiClient';
import { takeSnapshot } from './domain/takeSnapshot';
import { useUiStore } from './state/uiPreferences';
import { FileSyncProvider } from './state/useFileSync';

const navItems = [
  { to: '/', label: '總覽', end: true },
  { to: '/assets', label: '資產', end: false },
  { to: '/settings', label: '設定', end: false },
];

function App() {
  const amountsHidden = useUiStore((s) => s.amountsHidden);
  const toggleAmountsHidden = useUiStore((s) => s.toggleAmountsHidden);

  useEffect(() => {
    (async () => {
      try {
        await ensureFreshFx();
      } catch {
        /* silent — explicit refresh button covers errors */
      }
      try {
        await takeSnapshot('auto');
      } catch {
        /* silent */
      }
    })();
  }, []);

  return (
    <FileSyncProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <span className="text-lg font-semibold tracking-tight">資產盤點</span>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <UserSwitcher />
              <button
                type="button"
                onClick={toggleAmountsHidden}
                title={amountsHidden ? '顯示金額' : '隱藏金額'}
                aria-label={amountsHidden ? '顯示金額' : '隱藏金額'}
                className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
              >
                {amountsHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </nav>
          <FileSyncBanner />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assets" element={<AssetsList />} />
            <Route path="/assets/new" element={<AssetForm />} />
            <Route path="/assets/:id/edit" element={<AssetForm />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </FileSyncProvider>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default App;
