'use client';
import { useEffect, useState } from 'react';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const TYPE_LABELS: Record<string, string> = {
  water_cold: '💧 Холодная вода',
  water_hot: '🔥 Горячая вода',
  electricity: '⚡ Электричество',
  gas: '🔥 Газ',
  heating: '♨️ Отопление',
};

type Meter = {
  id: string;
  premiseId: string;
  type: string;
  unit: string | null;
};

export default function MetersPage() {
  const { ready, inMax, profile } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton();

  useEffect(() => {
    if (!ready || !inMax) {
      console.log('[meters-page] waiting ready/inMax', { ready, inMax });
      return;
    }

    console.log('[meters-page] loading meters');
    fetch('/api/meters', { credentials: 'include' })
      .then((r) => {
        console.log('[meters-page] status:', r.status);
        return r.json();
      })
      .then((d) => {
        console.log('[meters-page] response:', d);
        if (Array.isArray(d)) setMeters(d);
        else setError('Неверный формат ответа');
      })
      .catch((e) => {
        console.error('[meters-page] fetch failed:', e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [ready, inMax]);

  const submit = async (meterId: string) => {
    const raw = values[meterId];
    if (!raw) return;
    const num = Number(raw.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      await dialog.alert('Введите корректное значение');
      return;
    }

    setBusy(true);
    haptic.press();
    try {
      const res = await fetch('/api/meters/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterId, value: num }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      haptic.success();
      await dialog.alert('Показания переданы');

      // Обновляем список
      const d = await fetch('/api/meters', { credentials: 'include' }).then((r) => r.json());
      if (Array.isArray(d)) setMeters(d);

      setValues((prev) => {
        const next = { ...prev };
        delete next[meterId];
        return next;
      });
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) return <Spinner />;

  if (!inMax) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Откройте через MAX</div>;
  }

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>Показания счётчиков</h1>

      {/* Диагностика */}
      <div style={{
        fontSize: 11, color: 'var(--hint)',
        padding: 8, borderRadius: 6,
        background: 'var(--bg-secondary)',
        marginBottom: 12,
      }}>
        Профиль: {profile?.firstName ?? '—'} ({profile?.id?.slice(0, 8)})
        {' · '}
        Счётчиков: {meters.length}
      </div>

      {error && (
        <Card>
          <div style={{ color: '#dc2626', fontSize: 13 }}>
            Ошибка: {error}
          </div>
        </Card>
      )}

      {!error && meters.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--hint)' }}>
            <div style={{ fontSize: 44 }}>📊</div>
            <p style={{ margin: '8px 0 0' }}>У вас нет счётчиков</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>
              Привяжите адрес в профиле
            </p>
          </div>
        </Card>
      )}

      {meters.map((m) => (
        <Card key={m.id}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {TYPE_LABELS[m.type] ?? m.type}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`Значение, ${m.unit ?? ''}`}
              value={values[m.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button
              onClick={() => submit(m.id)}
              disabled={busy || !values[m.id]}
              style={{
                padding: '0 16px', borderRadius: 10, border: 'none',
                background: 'var(--button, #2481cc)', color: '#fff',
                fontSize: 14, fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy || !values[m.id] ? 0.5 : 1,
              }}
            >
              {busy ? '…' : 'Передать'}
            </button>
          </div>
        </Card>
      ))}
    </main>
  );
}