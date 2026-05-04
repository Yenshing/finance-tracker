import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import clsx from 'clsx';
import Dashboard from './routes/Dashboard';
import AssetsList from './routes/AssetsList';
import AssetForm from './routes/AssetForm';
import Settings from './routes/Settings';
import { ensureFreshFx } from './services/fx/erApiClient';
import { takeSnapshot } from './domain/takeSnapshot';

const navItems = [
  { to: '/', label: '總覽', end: true },
  { to: '/assets', label: '資產', end: false },
  { to: '/settings', label: '設定', end: false },
];

function App() {
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
        </nav>
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
  );
}

export default App;
