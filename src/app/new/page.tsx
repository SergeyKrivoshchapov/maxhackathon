'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { useMax } from '@/components/providers/MaxProvider';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/TextArea';
import { PhotoUploader } from '@/components/ui/PhotoUploader';
import { MSG } from '@/lib/messages';
import { LocationPicker } from '@/components/ui/LocationPicker';

type Category = { id: number; name: string; code: string };

export default function NewTicketPage() {
  const router = useRouter();
  const { wa, ready, inMax } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'emergency'>('normal');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // ─── Загрузка категорий с логами ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    console.log('[new] fetching categories');

    fetch('/api/categories')
      .then((r) => {
        console.log('[new] categories status:', r.status);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        console.log('[new] categories body:', data);
        if (Array.isArray(data)) setCategories(data);
        else {
          console.warn('[new] categories not array:', data);
          setCategories([]);
        }
      })
      .catch((e) => {
        console.error('[new] categories failed:', e);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [myPremises, setMyPremises] = useState<any[]>([]);
  const [premiseId, setPremiseId] = useState('');

  useEffect(() => {
    fetch('/api/my/premises', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setMyPremises(d);
          if (d.length > 0) setPremiseId(d[0].premiseId); // первое по умолчанию
        }
      });
  }, []);

  // ─── Нативные кнопки ───────────────────────────────────────
  useBackButton(() => router.back());

  const submit = useCallback(async () => {
    if (!catId || !title.trim() || busy) return;
    setBusy(true);
    haptic.press();

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: catId,
          title: title.trim(),
          description: desc.trim() || null,
          photos,
          priority,
          premiseId,
          lat,    
          lng, 
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      haptic.success();
      await dialog.alert('Обращение отправлено');
      router.push('/');
    } catch (e: any) {
      haptic.error();
      const text = e?.message ?? '';
      let userMsg = MSG.serverError;

      if (text.includes('401')) userMsg = MSG.sessionExpired;
      else if (text.includes('premise')) userMsg = MSG.noAddress;
      else if (text.includes('category')) userMsg = MSG.noCategory;
      else if (text.includes('fetch')) userMsg = MSG.networkError;

      await dialog.alert(userMsg);
    } finally {
      setBusy(false);
    }
  }, [catId, title, desc, photos, priority, busy, haptic, dialog, router]);

  const hasNativeButton = !!wa?.MainButton;

  useMainButton({
    text: 'Отправить',
    visible: inMax && hasNativeButton,
    enabled: !!catId && !!title.trim() && !busy,
    progress: busy,
    onClick: submit,
  });

  // ─── Ранние возвраты — строго ПОСЛЕ всех хуков ─────────────
  if (!ready) return <Spinner />;

  if (!inMax) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <h2>Откройте через MAX</h2>
        <p style={{ color: 'var(--hint)' }}>
          Приложение работает внутри мессенджера MAX.
        </p>
      </div>
    );
  }

  // ─── Обычный UI ────────────────────────────────────────────
  return (
    <main
      className="screen"
      style={{
        padding: '8px 16px',
        paddingBottom: hasNativeButton
          ? 16
          : 'calc(90px + env(safe-area-inset-bottom, 0))',
      }}
    >
      <div className="section-title">Адрес</div>
      <Select value={premiseId} onChange={(e) => setPremiseId(e.target.value)}>
        {myPremises.map((p) => (
          <option key={p.premiseId} value={p.premiseId}>
            {p.houseAddress}, кв. {p.premiseNumber}
          </option>
        ))}
      </Select>

      <div className="section-title">Категория</div>
      <Select
        value={catId ?? ''}
        onChange={(e) => setCatId(Number(e.target.value))}
      >
        <option value="">— выберите —</option>
        {categories.length === 0 && (
          <option value="" disabled>Загрузка категорий…</option>
        )}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>

      <div className="section-title">Кратко</div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: течёт кран в ванной"
        maxLength={120}
      />

      <div className="section-title">Описание</div>
      <Textarea
        rows={4}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Подробнее, что и где произошло"
      />

      <div className="section-title">Приоритет</div>
      <Select
        value={priority}
        onChange={(e) => setPriority(e.target.value as any)}
      >
        <option value="low">Низкий</option>
        <option value="normal">Обычный</option>
        <option value="high">Высокий</option>
        <option value="emergency">Аварийный</option>
      </Select>
      
      <div className="section-title">Место на карте (опционально)</div>
      <LocationPicker
        lat={lat}
        lng={lng}
        onChange={(la, ln) => { setLat(la); setLng(ln); }}
      />
      {lat != null && lng != null && (
        <div style={{ fontSize: 12, color: 'var(--hint)', marginTop: 6 }}>
          📍 Координаты: {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      )}

      <div className="section-title">Фото</div>
      <PhotoUploader
        value={photos}
        onChange={setPhotos}
        max={5}
        folder="tickets"
        disabled={busy}
      />

      {/* Fallback-кнопка «Отправить», если MainButton нет (веб-MAX) */}
      {!hasNativeButton && (
        <button
          onClick={submit}
          disabled={!catId || !title.trim() || busy}
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
            padding: '16px 20px',
            border: 'none',
            borderRadius: 12,
            background: 'var(--button, #2481cc)',
            color: 'var(--button-text, #fff)',
            fontSize: 16,
            fontWeight: 600,
            cursor: (!catId || !title.trim() || busy) ? 'not-allowed' : 'pointer',
            opacity: (!catId || !title.trim() || busy) ? 0.5 : 1,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            zIndex: 100,
          }}
        >
          {busy ? 'Отправка…' : 'Отправить'}
        </button>
      )}
    </main>
  );
}