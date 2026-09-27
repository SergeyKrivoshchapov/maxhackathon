'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Profile = { id: string; maxUserId: number; firstName: string | null; role: string };
type Ctx = { wa: any; profile: Profile | null; ready: boolean; inMax: boolean };
const MaxCtx = createContext<Ctx>({ wa: null, profile: null, ready: false, inMax: false });

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
    console.log('[MAX] useEffect started');

    const init = async () => {
      console.log('[MAX] init start');
      const w = (window as any).WebApp;
      console.log('[MAX] WebApp exists:', !!w);

      if (!w) {
        console.log('[MAX] SDK not loaded, retry');
        return setTimeout(init, 100);
      }

      console.log('[MAX] initData length:', w.initData?.length ?? 0);

      try {
        w.ready?.();
        w.expand?.();
        setWa(w);
        console.log('[MAX] wa set');

        if (!w.initData) {
          console.log('[MAX] no initData — not in MAX');
          return;
        }

        console.log('[MAX] calling /api/auth');
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: w.initData }),
          credentials: 'include',
        });
        console.log('[MAX] /api/auth status:', res.status);

        const data = await res.json().catch((e) => {
          console.log('[MAX] json parse failed:', e);
          return {};
        });
        console.log('[MAX] /api/auth data:', data);

        if (data?.ok) {
          setProfile(data.profile);
          console.log('[MAX] profile set');
        }
      } catch (e) {
        console.error('[MAX] init failed:', e);
      } finally {
        console.log('[MAX] finally, setting ready');
        if (!cancelled) setReady(true);
      }
    };

    init();

    // страховка: через 5 секунд всё равно показать UI
    const t = setTimeout(() => {
      if (!cancelled) {
        console.log('[MAX] hard timeout, forcing ready');
        setReady(true);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
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