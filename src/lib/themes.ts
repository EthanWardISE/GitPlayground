/** Shared by the pre-paint script, React pickers, and generated palette CSS. */
export const THEMES = [
  { id: 'sage', name: 'Original Sage', description: 'Warm paper & garden greens', background: '#fbf9f5', surface: '#fffefa', accent: '#dce5d8', primary: '#3f5e4d', secondary: '#ecd2c1', tertiary: '#dce5e1' },
  { id: 'peach', name: 'Peach Keepsake', description: 'Sunlit pages & soft terracotta', background: '#fff8f2', surface: '#fffcf9', accent: '#f0d5c3', primary: '#85513b', secondary: '#e8dfbc', tertiary: '#dce5d8' },
  { id: 'rose', name: 'Rose Album', description: 'Blush paper & pressed petals', background: '#fcf5f6', surface: '#fffbfc', accent: '#eed5dc', primary: '#824b60', secondary: '#e5def0', tertiary: '#eddfcb' },
  { id: 'lavender', name: 'Lavender Letters', description: 'Lilac pages & quiet afternoons', background: '#f8f6fc', surface: '#fdfbff', accent: '#e3dcf1', primary: '#675184', secondary: '#eed9df', tertiary: '#d9e5e7' },
  { id: 'blue', name: 'Mist Blue', description: 'Cloud paper & coastal mornings', background: '#f4f8fa', surface: '#fbfdff', accent: '#d6e6ed', primary: '#41677a', secondary: '#dce5d8', tertiary: '#ecdfcd' },
  { id: 'hearth', name: 'Evening Hearth', description: 'Warm charcoal & lamplight', background: '#242724', surface: '#2d322e', accent: '#39483e', primary: '#bcd3b5', secondary: '#4b3d39', tertiary: '#35454d' },
] as const;

export type ThemeId = typeof THEMES[number]['id'];
export const DEFAULT_THEME: ThemeId = 'sage';
export const THEME_STORAGE_KEY = 'kinfolk-theme';
export const THEME_CHANGE_EVENT = 'kinfolk:theme-change';

export function resolveTheme(value: unknown): ThemeId {
  // Keep preferences saved by the original light/dark toggle.
  if (value === 'dark') return 'hearth';
  return THEMES.find((theme) => theme.id === value)?.id ?? DEFAULT_THEME;
}

export function getThemeSnapshot(): ThemeId {
  return resolveTheme(document.documentElement.dataset.theme);
}

export function selectTheme(value: string) {
  const theme = resolveTheme(value);
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Still works for this page when storage is blocked. */ }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(listener: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, listener);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, listener);
}

// Serialized into an inline head script: keep this function self-contained.
export function initializeTheme(ids: readonly string[], fallback: string, key: string, eventName: string) {
  const apply = (value: string | null) => {
    const candidate = value === 'dark' ? 'hearth' : value;
    document.documentElement.dataset.theme = candidate && ids.includes(candidate) ? candidate : fallback;
  };
  try { apply(localStorage.getItem(key)); } catch { apply(null); }
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || (event.key !== key && event.key !== null)) return;
    apply(event.newValue);
    window.dispatchEvent(new Event(eventName));
  });
}

export const themeInitScript = `(${initializeTheme.toString()})(${JSON.stringify(THEMES.map(({ id }) => id))},${JSON.stringify(DEFAULT_THEME)},${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(THEME_CHANGE_EVENT)});`;

export const themeStyles = THEMES.map((theme) => {
  const dark = theme.id === 'hearth';
  const tokens = {
    'page': theme.background, 'surface': theme.surface, 'accent-soft': theme.accent,
    'primary': theme.primary, 'primary-hover': dark ? '#d3e3cc' : `color-mix(in srgb, ${theme.primary}, black 15%)`,
    'on-primary': dark ? '#242724' : '#ffffff',
    'ink': dark ? '#f2efe7' : '#312f29', 'muted': dark ? '#c2c5bc' : '#5e5b53',
    'line': dark ? '#505b52' : `color-mix(in srgb, ${theme.primary} 24%, ${theme.surface})`,
    'control-border': dark ? '#879686' : '#807d73',
    'soft': `color-mix(in srgb, ${theme.accent} 35%, ${theme.surface})`,
    'secondary': theme.secondary, 'tertiary': theme.tertiary,
    'sand': dark ? '#494637' : '#e9e2d4',
    'secondary-ink': dark ? '#f0d5c3' : '#724b3b',
    'tertiary-ink': dark ? '#c4dee6' : '#355954',
    'sand-ink': dark ? '#e9dfb9' : '#645032',
    'focus': theme.primary,
    'danger': dark ? '#ffb4a6' : '#9d352c', 'danger-bg': dark ? '#4a302c' : '#fff0ec',
    'warning': dark ? '#f3d59c' : '#6e5121', 'warning-bg': dark ? '#403a29' : '#fff5dc',
    'success': dark ? '#bcd3b5' : '#35583d', 'success-bg': dark ? '#344337' : '#e4eddf',
    'story': dark ? '#39483e' : theme.primary, 'on-story': dark ? '#f2efe7' : '#ffffff',
  };
  return `${theme.id === DEFAULT_THEME ? ':root,' : ''}[data-theme="${theme.id}"]{color-scheme:${dark ? 'dark' : 'light'};${Object.entries(tokens).map(([key, value]) => `--${key}:${value}`).join(';')}}`;
}).join('\n');
