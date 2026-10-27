import { useEffect, useState } from 'react';
import { THEME_EVENT, setTheme, type Theme } from '../lib/theme';

export default function AppearanceSettings() {
  const [theme, updateTheme] = useState<Theme>('light');
  useEffect(() => {
    const sync = () => updateTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return (
    <section className="family-management" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Appearance</h2>
      <div className="appearance-row">
        <div><label id="dark-mode-label" htmlFor="dark-mode">Dark mode</label>
          <p id="dark-mode-help" className="muted">A softer glow for your family memories. Saved on this device.</p></div>
        <button id="dark-mode" type="button" role="switch" aria-checked={theme === 'dark'}
          aria-labelledby="dark-mode-label" aria-describedby="dark-mode-help" className="theme-switch"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span /></button>
      </div>
    </section>
  );
}
