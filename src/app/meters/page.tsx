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

type Reading = {
  id: string;
  value: string;
  readingDate: string;
  authorName: string | null;
  consumption: number | null;
};

export default function MetersPage() {
  const { ready, inMax } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [readings, setReadings] = useState<Record<string, Reading[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useBackButton();

  const loadAll = async () => {
    const m = await fetch('/api/meters', { credentials: 'include' }).then((r) => r.json());
    if (!Array.isArray(m)) return;
    setMeters(m);

    const allReadings: Record<string, Reading[]> = {};
    for (const meter of m) {
      const r = await fetch(`/api/meters/readings?meterId=${meter.id}`, { credentials: 'include' }).then((r) => r.json());
      if (Array.isArray(r)) allReadings[meter.id] = r;
    }
    setReadings(allReadings);
  };

  useEffect(() => {
    if (!ready || !inMax) return;
    loadAll().finally(() => setLoading(false));
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
      await loadAll();
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleExpand = (meterId: string) => {
    haptic.tap();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(meterId)) next.delete(meterId);
      else next.add(meterId);
      return next;
    });
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
        const list = readings[m.id] ?? [];
        const last = list[0];
        const isOpen = expanded.has(m.id);

        return (
          <Card key={m.id}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {TYPE_LABELS[m.type] ?? m.type}
            </div>

            {last && (
              <div style={{ fontSize: 13, color: 'var(--hint)', marginBottom: 8 }}>
                Последнее: <b style={{ color: 'var(--text)' }}>{Number(last.value).toFixed(2)} {m.unit}</b>
                {' · '}
                {new Date(last.readingDate).toLocaleDateString('ru-RU')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
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
                  padding: '0 16px', borderRadius: 10, border: 'none',
                  background: 'var(--button, #2481cc)', color: '#fff',
                  fontSize: 14, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy || !values[m.id] ? 0.5 : 1,
                }}
              >
                Передать
              </button>
            </div>

            {list.length > 0 && (
              <button
                onClick={() => toggleExpand(m.id)}
                style={{
                  width: '100%', padding: 8,
                  border: 'none', background: 'transparent',
                  color: 'var(--link, #2481cc)',
                  fontSize: 13, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {isOpen ? '▼' : '▶'} Хронология ({list.length})
              </button>
            )}

            {isOpen && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--separator)', paddingTop: 8 }}>
                {list.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < list.length - 1 ? '1px solid var(--separator)' : 'none',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {Number(r.value).toFixed(2)} {m.unit}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--hint)' }}>
                        {new Date(r.readingDate).toLocaleString('ru-RU')}
                        {r.authorName && ` · ${r.authorName}`}
                      </div>
                    </div>
                    {r.consumption != null && (
                      <div style={{
                        fontSize: 12,
                        color: '#10b981',
                        fontWeight: 600,
                        padding: '2px 8px',
                        background: 'rgba(16,185,129,0.1)',
                        borderRadius: 6,
                      }}>
                        +{r.consumption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </main>
  );
}