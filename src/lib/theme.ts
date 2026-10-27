export type Theme = 'light' | 'dark';
export const THEME_KEY = 'kinfolk-theme';
export const THEME_EVENT = 'kinfolk-theme-change';

export function parseTheme(value: string | null): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

export function readTheme(): Theme {
  try { return parseTheme(localStorage.getItem(THEME_KEY)); }
  catch { return 'light'; }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep the current session usable without storage. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function initializeTheme(): () => void {
  applyTheme(readTheme());
  const sync = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      applyTheme(readTheme());
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  };
  window.addEventListener('storage', sync);
  return () => window.removeEventListener('storage', sync);
}
