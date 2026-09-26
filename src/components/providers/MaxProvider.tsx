'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Profile = { id: string; maxUserId: number; firstName: string | null; role: string };
type Ctx = { wa: any; profile: Profile | null; ready: boolean };
const MaxCtx = createContext<Ctx>({ wa: null, profile: null, ready: false });

export function MaxProvider({ children }: { children: React.ReactNode }) {
  const [wa, setWa] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  
  const applyTheme = useCallback((w: any) => {
    const t = w.themeParams ?? {};
    const root = document.documentElement;
    const map: [string, string][] = [
      ['--bg', 'bg_color'],
      ['--bg-secondary', 'secondary_bg_color'],
      ['--text', 'text_color'],
      ['--hint', 'hint_color'],
      ['--link', 'link_color'],
      ['--button', 'button_color'],
      ['--button-text', 'button_text_color'],
      ['--header-bg', 'header_bg_color'],
      ['--section-bg', 'section_bg_color'],
      ['--separator', 'section_separator_color'],
    ];
    for (const [css, key] of map) {
      if (t[key]) root.style.setProperty(css, t[key]);
    }
    document.body.dataset.theme = isDark(t.bg_color) ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const w = (window as any).WebApp;
      if (!w) return setTimeout(init, 100);

      w.ready?.();
      w.expand?.();
      w.disableVerticalSwipes?.();

      applyTheme(w);
      w.onEvent?.('themeChanged', () => applyTheme(w));

      setWa(w);

      const initData = w.initData;
      if (initData) {
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
            credentials: 'include',
          });
          const data = await res.json();
          if (!cancelled && data.ok) setProfile(data.profile);
        } catch (e) {
          console.error('auth failed', e);
        }
      }
      else {
        if (!cancelled) setReady(true);
        return;
      }
    };

    init();
    return () => { cancelled = true; };
  }, [applyTheme]);
  const inMax = !!wa?.initData;

  return <MaxCtx.Provider value={{ wa, profile, ready, inMax }}>{children}</MaxCtx.Provider>;
}

function isDark(hex?: string) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export const useMax = () => useContext(MaxCtx);