'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

const TYPE_LABELS: Record<string, string> = {
  water_cold: '💧 ХВС',
  water_hot: '🔥 ГВС',
  electricity: '⚡ Электро',
  gas: '🔥 Газ',
  heating: '♨️ Отопление',
};

type MeterInfo = {
  id: string;
  type: string;
  unit: string | null;
  lastValue: string | null;
  lastDate: string | null;
  lastAuthor: string | null;
  daysSince: number | null;
  status: 'ok' | 'warning' | 'stale';
};

type PremiseInfo = {
  premiseId: string;
  premiseNumber: string;
  houseAddress: string;
  meters: MeterInfo[];
  lastReadingDate: string | null;
  status: 'ok' | 'warning' | 'stale';
};

type Summary = {
  total: number;
  stale: number;
  warning: number;
  ok: number;
};

export default function UKMetersPage() {
  const router = useRouter();
  const { ready, inMax, profile } = useMax();
  const haptic = useHaptic();

  const [premises, setPremises] = useState<PremiseInfo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'stale' | 'warning' | 'ok'>('all');
  const [search, setSearch] = useState('');

  useBackButton(() => router.push('/uk'));

  useEffect(() => {
    if (!ready || !inMax) return;
    fetch('/api/uk/meters', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.premises) {
          setPremises(d.premises);
          setSummary(d.summary);
        }
      })
      .finally(() => setLoading(false));
  }, [ready, inMax]);

  const filtered = useMemo(() => {
    return premises.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!p.houseAddress.toLowerCase().includes(s) &&
            !p.premiseNumber.includes(s)) return false;
      }
      return true;
    });
  }, [premises, filter, search]);

  if (!ready || loading) return <Spinner />;
  if (!inMax || !['uk', 'admin'].includes(profile?.role ?? '')) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Доступ запрещён</div>;
  }

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>Счётчики по домам</h1>

      {/* Сводка */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}>
          <SummaryCard
            value={summary.stale}
            label="Просрочено"
            color="#dc2626"
            bg="rgba(220,38,38,0.08)"
            onClick={() => { haptic.tap(); setFilter('stale'); }}
            active={filter === 'stale'}
          />
          <SummaryCard
            value={summary.warning}
            label="Скоро срок"
            color="#f59e0b"
            bg="rgba(245,158,11,0.08)"
            onClick={() => { haptic.tap(); setFilter('warning'); }}
            active={filter === 'warning'}
          />
          <SummaryCard
            value={summary.ok}
            label="ОК"
            color="#10b981"
            bg="rgba(16,185,129,0.08)"
            onClick={() => { haptic.tap(); setFilter('ok'); }}
            active={filter === 'ok'}
          />
        </div>
      )}

      {/* Поиск */}
      <input
        type="text"
        placeholder="Поиск по адресу или квартире"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 10,
          border: '1px solid var(--separator)',
          background: 'var(--bg-secondary)',
          color: 'var(--text)',
          fontSize: 14,
          marginBottom: 12,
        }}
      />

      {/* Фильтр */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'stale', 'warning', 'ok'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { haptic.tap(); setFilter(f); }}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              background: filter === f ? 'var(--button, #2481cc)' : 'var(--bg-secondary)',
              color: filter === f ? '#fff' : 'var(--text)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'Все' :
             f === 'stale' ? 'Просрочено' :
             f === 'warning' ? 'Скоро' : 'ОК'}
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--hint)' }}>
            Ничего не найдено
          </div>
        </Card>
      )}

      {filtered.map((p) => (
        <Card key={p.premiseId}>
          {/* Шапка */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {p.houseAddress}, кв. {p.premiseNumber}
              </div>
              {p.lastReadingDate && (
                <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 2 }}>
                  Последняя передача:{' '}
                  {new Date(p.lastReadingDate).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
            <StatusBadge status={p.status} />
          </div>

          {/* Счётчики */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 6,
          }}>
            {p.meters.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  background: 'var(--bg-secondary)',
                  borderLeft: `3px solid ${colorForStatus(m.status)}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {TYPE_LABELS[m.type] ?? m.type}
                </div>
                {m.lastValue ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {Number(m.lastValue).toFixed(2)} {m.unit}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--hint)', marginTop: 2 }}>
                      {m.daysSince != null
                        ? m.daysSince === 0
                          ? 'сегодня'
                          : `${m.daysSince} дн. назад`
                        : '—'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#dc2626' }}>
                    Не передавали
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </main>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'stale' }) {
  const map = {
    ok: { label: 'ОК', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    warning: { label: 'Скоро', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    stale: { label: 'Просрочено', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      padding: '3px 8px',
      borderRadius: 6,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function colorForStatus(status: 'ok' | 'warning' | 'stale') {
  return status === 'stale' ? '#dc2626'
       : status === 'warning' ? '#f59e0b'
       : '#10b981';
}

function SummaryCard({
  value, label, color, bg, onClick, active,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: 10,
        border: active ? `2px solid ${color}` : '2px solid transparent',
        background: bg,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 2 }}>
        {label}
      </div>
    </button>
  );
}