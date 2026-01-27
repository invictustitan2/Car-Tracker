import { useEffect, useState } from 'react';
import PackageCarTracker from './PackageCarTracker.jsx';

const THEME_KEY = 'ups-tracker-theme';

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors font-sans text-slate-900 dark:text-slate-100">
      <PackageCarTracker theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}
