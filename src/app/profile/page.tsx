'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

type Premise = {
  residencyId: string;
  verified: boolean;
  premiseId: string;
  premiseNumber: string;
  houseId: string;
  houseAddress: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { profile, ready, inMax } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [premises, setPremises] = useState<Premise[]>([]);
  const [loading, setLoading] = useState(true);

  useBackButton(() => router.push('/'));

  const load = () => {
    fetch('/api/my/premises', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPremises(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!ready || !inMax) return;
    load();
  }, [ready, inMax]);

  const remove = async (id: string) => {
    if (!await dialog.confirm('Отвязать этот адрес?')) return;
    haptic.tap();
    await fetch(`/api/my/premises/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  };

  if (!ready || loading) return <Spinner />;

  if (!inMax) return <div style={{ padding: 60, textAlign: 'center' }}>Откройте через MAX</div>;

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 22, margin: '16px 0' }}>Профиль</h1>

      {profile && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {profile.firstName ?? 'Житель'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 4 }}>
            Роль: {profile.role === 'resident' ? 'Житель' :
                   profile.role === 'uk' ? 'УК' :
                   profile.role === 'admin' ? 'Админ' : profile.role}
          </div>
        </Card>
      )}

      <div className="section-title">Мои адреса</div>

      {premises.length === 0 && (
        <div style={{ padding: 20, color: 'var(--hint)', textAlign: 'center' }}>
          Нет привязанных адресов
        </div>
      )}

      {premises.map((p) => (
        <Card key={p.residencyId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.houseAddress}</div>
              <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 4 }}>
                Кв. {p.premiseNumber}
                {p.verified && ' ✓ подтверждено'}
              </div>
            </div>
            <button
              onClick={() => remove(p.residencyId)}
              style={{
                border: 'none', background: 'transparent',
                color: '#dc2626', fontSize: 14, cursor: 'pointer',
                padding: 4,
              }}
            >
              Удалить
            </button>
          </div>
        </Card>
      ))}

      <button
        onClick={() => router.push('/onboarding')}
        style={{
          width: '100%', padding: 14, marginTop: 12,
          border: '1px dashed var(--separator)',
          borderRadius: 12, background: 'var(--bg-secondary)',
          color: 'var(--link)', fontSize: 15, cursor: 'pointer',
        }}
      >
        + Добавить адрес
      </button>

      {['uk', 'admin'].includes(profile?.role ?? '') && (
        <button
          onClick={() => router.push('/uk')}
          style={{
            width: '100%', padding: 14, marginTop: 12,
            border: 'none', borderRadius: 12,
            background: 'var(--button, #2481cc)', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Кабинет УК
        </button>
      )}
    </main>
  );
}