import { useEffect, useState, lazy, Suspense } from 'react';
import PackageCarTracker from './PackageCarTracker.jsx';

const THEME_KEY = 'ups-tracker-theme';

// Feature flag for Unload module (default OFF)
const isUnloadEnabled = () => {
  try {
    return import.meta.env.VITE_ENABLE_UNLOAD_MODULE === 'true';
  } catch {
    return false;
  }
};

// Lazy load Unload module only when enabled
const UnloadApp = lazy(() => import('./unload/UnloadApp.jsx'));

// Simple pathname-based route detection (no React Router needed)
function usePathnameRoute() {
  const [pathname, setPathname] = useState(() => 
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return pathname;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const pathname = usePathnameRoute();
  const unloadEnabled = isUnloadEnabled();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // If user visits /unload while flag is OFF, redirect to /
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname === '/unload' && !unloadEnabled) {
      window.history.replaceState(null, '', '/');
    }
  }, [pathname, unloadEnabled]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Route: /unload (only when flag enabled)
  if (pathname === '/unload' && unloadEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors font-sans text-slate-900 dark:text-slate-100">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-pulse text-slate-500">Loading Unload module...</div>
          </div>
        }>
          <UnloadApp />
        </Suspense>
      </div>
    );
  }

  // Default: Package Car Tracker
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors font-sans text-slate-900 dark:text-slate-100">
      <PackageCarTracker theme={theme} onToggleTheme={toggleTheme} unloadEnabled={unloadEnabled} />
    </div>
  );
}
