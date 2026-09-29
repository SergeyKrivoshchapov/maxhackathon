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
  const { ready, inMax } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [lastReadings, setLastReadings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useBackButton();

  useEffect(() => {
    if (!ready || !inMax) return;
    fetch('/api/meters', { credentials: 'include' })
      .then((r) => r.json())
      .then(async (d) => {
        if (!Array.isArray(d)) return;
        setMeters(d);
        // Загрузить последние показания
        const last: Record<string, any> = {};
        for (const m of d) {
          const r = await fetch(`/api/meters/readings?meterId=${m.id}`, { credentials: 'include' });
          const readings = await r.json();
          if (Array.isArray(readings) && readings.length) last[m.id] = readings[0];
        }
        setLastReadings(last);
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
      setValues((v) => ({ ...v, [meterId]: '' }));
      // Обновить последнее
      const r = await fetch(`/api/meters/readings?meterId=${meterId}`, { credentials: 'include' });
      const readings = await r.json();
      if (Array.isArray(readings) && readings.length) {
        setLastReadings((p) => ({ ...p, [meterId]: readings[0] }));
      }
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) return <Spinner />;
  if (!inMax) return <div style={{ padding: 60, textAlign: 'center' }}>Откройте в MAX</div>;

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>Показания счётчиков</h1>

      {meters.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--hint)' }}>
          <div style={{ fontSize: 44 }}>📊</div>
          <p>У вас нет счётчиков</p>
        </div>
      )}

      {meters.map((m) => {
        const last = lastReadings[m.id];
        return (
          <Card key={m.id}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {TYPE_LABELS[m.type] ?? m.type}
            </div>

            {last && (
              <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 8 }}>
                Последнее: <b>{Number(last.value).toFixed(2)} {m.unit}</b>
                {' · '}
                {new Date(last.readingDate).toLocaleDateString('ru-RU')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={`Новое значение, ${m.unit}`}
                value={values[m.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button
                onClick={() => submit(m.id)}
                disabled={busy || !values[m.id]}
                style={{
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--button, #2481cc)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy || !values[m.id] ? 0.5 : 1,
                }}
              >
                Передать
              </button>
            </div>
          </Card>
        );
      })}
    </main>
  );
}