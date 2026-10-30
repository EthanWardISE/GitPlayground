import { useId, useSyncExternalStore, type CSSProperties } from 'react';
import { DEFAULT_THEME, THEMES, getThemeSnapshot, selectTheme, subscribeToTheme } from '../lib/themes';

export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const selected = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => DEFAULT_THEME);
  const choices = (
    <fieldset className="theme-choices">
      <legend>{compact ? 'Choose your colours' : 'Choose a palette'}</legend>
      <div className="theme-grid">
        {THEMES.map((theme) => (
          <label className="theme-option" key={theme.id}>
            <input type="radio" name={`theme-${id}`} value={theme.id} checked={selected === theme.id} onChange={() => selectTheme(theme.id)} />
            <span className="theme-card">
              <span className="theme-preview" aria-hidden="true" style={{ '--preview-page': theme.background, '--preview-surface': theme.surface, '--preview-accent': theme.accent, '--preview-primary': theme.primary, '--preview-secondary': theme.secondary, '--preview-tertiary': theme.tertiary } as CSSProperties}>
                <span className="theme-preview-sidebar"><i /><i /><i /></span>
                <span className="theme-preview-content"><span className="theme-preview-banner" /><span className="theme-preview-photos"><i /><i /><i /></span></span>
              </span>
              <span className="theme-option-heading"><span>{theme.name}</span><span className="theme-selected" aria-hidden="true">✓</span></span>
              {!compact && <span className="theme-description">{theme.description}</span>}
              <span className="theme-swatches" aria-hidden="true">{[theme.background, theme.accent, theme.primary, theme.secondary, theme.tertiary].map((color) => <i key={color} style={{ background: color }} />)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  if (compact) return (
    <details className="theme-picker-compact" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }
    }}>
      <summary><span aria-hidden="true">◐</span> Appearance</summary>
      {choices}
    </details>
  );
  return (
    <section className="appearance-settings" aria-labelledby={`appearance-${id}`}>
      <div className="eyebrow">A little colour, a little you</div>
      <h2 id={`appearance-${id}`}>Appearance</h2>
      <p>Pick the pages your memories live on. Saved in this browser, just for you.</p>
      {choices}
    </section>
  );
}
