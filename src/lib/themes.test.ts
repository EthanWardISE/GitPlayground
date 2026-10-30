import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, THEMES, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, getThemeSnapshot, resolveTheme, selectTheme, subscribeToTheme, themeInitScript, themeStyles } from './themes';

afterEach(() => vi.unstubAllGlobals());

function browser(value: string | null = null, blocked = false) {
  const storage = {
    getItem: vi.fn(() => { if (blocked) throw new Error('Storage blocked'); return value; }),
    setItem: vi.fn((_key: string, next: string) => { if (blocked) throw new Error('Storage blocked'); value = next; }),
  };
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  const window = new EventTarget();
  const context = { document, window, localStorage: storage, Event };
  Object.entries(context).forEach(([name, instance]) => vi.stubGlobal(name, instance));
  runInNewContext(themeInitScript, context);
  const storageEvent = (key: string | null, newValue: string | null, storageArea: unknown = storage) => {
    const event = new Event('storage');
    Object.assign(event, { key, newValue, storageArea });
    window.dispatchEvent(event);
  };
  return { document, window, storage, storageEvent };
}

describe('Kinfolk theme preference', () => {
  it.each(THEMES)('restores $name synchronously before React starts', ({ id }) => {
    browser(id);
    expect(getThemeSnapshot()).toBe(id);
  });

  it.each([null, '', 'unknown', '<script>'])('uses Original Sage for invalid or missing storage: %s', (value) => {
    browser(value);
    expect(getThemeSnapshot()).toBe(DEFAULT_THEME);
    expect(resolveTheme(value)).toBe(DEFAULT_THEME);
  });

  it.each([['dark', 'hearth'], ['light', 'sage']])('preserves the legacy %s preference as %s', (legacy, theme) => {
    browser(legacy);
    expect(getThemeSnapshot()).toBe(theme);
    expect(resolveTheme(legacy)).toBe(theme);
  });

  it('applies changes immediately and notifies every picker', () => {
    const { storage } = browser();
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);
    selectTheme('rose');
    expect(getThemeSnapshot()).toBe('rose');
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'rose');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    selectTheme('blue');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('keeps changing themes when browser storage is blocked', () => {
    browser('hearth', true);
    expect(getThemeSnapshot()).toBe(DEFAULT_THEME);
    expect(() => selectTheme('lavender')).not.toThrow();
    expect(getThemeSnapshot()).toBe('lavender');
  });

  it('synchronises other tabs, removal, and clearing without writing back', () => {
    const { storage, storageEvent } = browser('peach');
    const listener = vi.fn();
    subscribeToTheme(listener);
    storageEvent(THEME_STORAGE_KEY, 'hearth');
    expect(getThemeSnapshot()).toBe('hearth');
    expect(listener).toHaveBeenCalledOnce();
    storageEvent(THEME_STORAGE_KEY, null);
    expect(getThemeSnapshot()).toBe(DEFAULT_THEME);
    storageEvent(THEME_STORAGE_KEY, 'blue');
    storageEvent(null, null);
    expect(getThemeSnapshot()).toBe(DEFAULT_THEME);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys and session storage', () => {
    const { storageEvent, window } = browser('rose');
    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);
    storageEvent('other-preference', 'blue');
    storageEvent(THEME_STORAGE_KEY, 'blue', {});
    expect(getThemeSnapshot()).toBe('rose');
    expect(listener).not.toHaveBeenCalled();
  });
});

// Check the actual palette CSS used by every page, so future colour edits cannot
// quietly reduce text or form-control contrast below WCAG AA.

function contrast(first: string, second: string) {
  function luminance(hex: string) {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

it.each(THEMES)('$name keeps text and control colours accessible', ({ id }) => {
  const css = themeStyles.split(`[data-theme="${id}"]{`)[1].split('}')[0];
  const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):([^;]+)/g)].map((match) => [match[1], match[2]]));
  for (const foreground of ['ink', 'muted']) {
    for (const background of ['page', 'surface', 'accent-soft', 'secondary', 'tertiary', 'sand']) {
      expect(contrast(tokens[foreground], tokens[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const [foreground, background] of [['on-primary', 'primary'], ['primary', 'accent-soft'], ['secondary-ink', 'secondary'], ['tertiary-ink', 'tertiary'], ['sand-ink', 'sand'], ['danger', 'danger-bg'], ['warning', 'warning-bg'], ['success', 'success-bg']]) {
    expect(contrast(tokens[foreground], tokens[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const background of ['page', 'surface']) {
    expect(contrast(tokens['control-border'], tokens[background]), `control border on ${background}`).toBeGreaterThanOrEqual(3);
  }
});
