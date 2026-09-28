// src/app/onboarding/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';

type House = { id: string; address: string; region: string | null };
type Premise = { id: string; number: string; type: string | null };

export default function OnboardingPage() {
  const router = useRouter();
  const { wa, ready, inMax } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [houses, setHouses] = useState<House[]>([]);
  const [premises, setPremises] = useState<Premise[]>([]);
  const [houseId, setHouseId] = useState('');
  const [premiseId, setPremiseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/houses', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setHouses(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!houseId) { setPremises([]); setPremiseId(''); return; }
    fetch(`/api/houses/${houseId}/premises`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPremises(d));
  }, [houseId]);

  useBackButton(undefined, false);

  const submit = useCallback(async () => {
    if (!premiseId || busy) return;
    setBusy(true);
    haptic.press();

    try {
      const res = await fetch('/api/my/premises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premiseId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      haptic.success();
      await dialog.alert('Адрес добавлен');
      router.replace('/');
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e?.message ?? 'неизвестная'}`);
    } finally {
      setBusy(false);
    }
  }, [premiseId, busy, haptic, dialog, router]);

  const hasNativeButton = !!wa?.MainButton;

  useMainButton({
    text: 'Подтвердить',
    visible: inMax && hasNativeButton,
    enabled: !!premiseId && !busy,
    progress: busy,
    onClick: submit,
  });

  if (!ready || loading) return <Spinner />;

  if (!inMax) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <h2>Откройте через MAX</h2>
      </div>
    );
  }

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
      <h1 style={{ fontSize: 22, margin: '24px 0 8px', textAlign: 'center' }}>
        Укажите адрес
      </h1>
      <p style={{ fontSize: 14, color: 'var(--hint)', textAlign: 'center', marginBottom: 24 }}>
        Чтобы отправлять обращения, выберите дом и квартиру
      </p>

      <div className="section-title">Дом</div>
      <Select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
        <option value="">— выберите дом —</option>
        {houses.map((h) => (
          <option key={h.id} value={h.id}>{h.address}</option>
        ))}
      </Select>

      {houseId && (
        <>
          <div className="section-title">Квартира / помещение</div>
          <Select value={premiseId} onChange={(e) => setPremiseId(e.target.value)}>
            <option value="">— выберите —</option>
            {premises.map((p) => (
              <option key={p.id} value={p.id}>Кв. {p.number}</option>
            ))}
          </Select>
          {premises.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--hint)' }}>
              В этом доме пока нет помещений. Обратитесь в УК.
            </p>
          )}
        </>
      )}

      {!hasNativeButton && (
        <button
          onClick={submit}
          disabled={!premiseId || busy}
          style={{
            position: 'fixed',
            left: 16, right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
            padding: 16, border: 'none', borderRadius: 12,
            background: 'var(--button, #2481cc)',
            color: '#fff', fontSize: 16, fontWeight: 600,
            opacity: (!premiseId || busy) ? 0.5 : 1,
            zIndex: 100,
          }}
        >
          {busy ? 'Сохранение…' : 'Подтвердить'}
        </button>
      )}
    </main>
  );
}