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

  const [switching, setSwitching] = useState(false);

  const switchRole = async (role: 'uk' | 'resident') => {
    if (switching) return;

    const confirmText =
      role === 'uk'
        ? 'Стать УК? Привяжутся свободные дома.'
        : 'Стать жителем? Дома, где вы были УК, освободятся.';

    if (!confirm(confirmText)) return;

    setSwitching(true);
    try {
      const res = await fetch('/api/dev/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // Успех — перезагружаем страницу, чтобы профиль обновился
      window.location.href = '/profile';
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
      setSwitching(false);
    }
  };

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

      {profile && (
        <div style={{
          marginTop: 24,
          padding: 16,
          border: '1px dashed var(--separator)',
          borderRadius: 12,
          background: 'var(--bg-secondary)',
        }}>
          <div style={{
            fontSize: 11, color: 'var(--hint)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
            marginBottom: 8,
          }}>
            🔧 Для тестирования
          </div>

          <div style={{ fontSize: 13, color: 'var(--hint)', marginBottom: 12 }}>
            Текущая роль: <b>{profile.role === 'uk' ? 'УК' :
              profile.role === 'admin' ? 'Админ' :
              profile.role === 'contractor' ? 'Исполнитель' : 'Житель'}</b>
          </div>

          {profile.role === 'resident' && (
            <button
              onClick={() => switchRole('uk')}
              disabled={switching}
              style={{
                width: '100%',
                padding: 12,
                border: 'none',
                borderRadius: 10,
                background: 'var(--button, #2481cc)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: switching ? 'wait' : 'pointer',
                opacity: switching ? 0.6 : 1,
              }}
            >
              {switching ? 'Переключение…' : '🔧 Стать УК'}
            </button>
          )}

          {(profile.role === 'uk' || profile.role === 'admin') && (
            <button
              onClick={() => switchRole('resident')}
              disabled={switching}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid var(--separator)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: switching ? 'wait' : 'pointer',
                opacity: switching ? 0.6 : 1,
              }}
            >
              {switching ? 'Переключение…' : '👤 Стать жителем'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}