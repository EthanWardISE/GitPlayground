import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initializeTheme, parseTheme, readTheme, setTheme, THEME_EVENT, THEME_KEY } from './theme';

describe('browser theme preference', () => {
  let storage: Map<string, string>;
  let root: { dataset: { theme?: string }; style: { colorScheme?: string } };
  let events: EventTarget;
  beforeEach(() => {
    storage = new Map();
    root = { dataset: {}, style: {} };
    events = new EventTarget();
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', events);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([null, '', 'system', 'invalid', 'light'])('defaults %s to light', (value) => {
    expect(parseTheme(value)).toBe('light');
  });
  it('persists both choices and restores them on navigation', () => {
    for (const theme of ['dark', 'light'] as const) {
      setTheme(theme);
      expect(storage.get(THEME_KEY)).toBe(theme);
      root.dataset.theme = undefined;
      const cleanup = initializeTheme();
      expect(root.dataset.theme).toBe(theme);
      expect(root.style.colorScheme).toBe(theme);
      cleanup();
    }
  });
  it('keeps switching usable when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
    expect(readTheme()).toBe('light');
    setTheme('dark');
    expect(root.dataset.theme).toBe('dark');
  });
  it('syncs relevant cross-tab changes and storage clearing, and cleans up', () => {
    const notify = vi.fn();
    events.addEventListener(THEME_EVENT, notify);
    const cleanup = initializeTheme();
    const change = (key: string | null) => events.dispatchEvent(Object.assign(new Event('storage'), { key }));
    storage.set(THEME_KEY, 'dark');
    change('unrelated');
    expect(root.dataset.theme).toBe('light');
    change(THEME_KEY);
    expect(root.dataset.theme).toBe('dark');
    storage.clear();
    change(null);
    expect(root.dataset.theme).toBe('light');
    expect(notify).toHaveBeenCalledTimes(2);
    cleanup();
    storage.set(THEME_KEY, 'dark');
    change(THEME_KEY);
    expect(root.dataset.theme).toBe('light');
  });
  it.each([null, 'dark', 'light', 'invalid'])('initializes before hydration for %s', (value) => {
    const source = readFileSync(new URL('../components/AppTheme.astro', import.meta.url), 'utf8');
    const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)![1];
    runInNewContext(script, { document: { documentElement: root }, localStorage: { getItem: () => value } });
    expect(root.dataset.theme).toBe(parseTheme(value));
  });
  it('bootstraps light when storage access throws', () => {
    const source = readFileSync(new URL('../components/AppTheme.astro', import.meta.url), 'utf8');
    runInNewContext(source.match(/<script is:inline>([\s\S]*?)<\/script>/)![1], {
      document: { documentElement: root }, localStorage: { getItem: () => { throw Error(); } },
    });
    expect(root.dataset.theme).toBe('light');
  });
});
