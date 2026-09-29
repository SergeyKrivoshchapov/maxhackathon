'use client';
import { useRouter } from 'next/navigation';

export function ProfileLink() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push('/profile')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary, #f4f4f5)',
        borderRadius: 12,
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--button, #2481cc)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>👤</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Профиль</div>
          <div style={{ fontSize: 12, color: 'var(--hint)' }}>
            Адреса, роль, кабинет УК
          </div>
        </div>
      </div>
      <div style={{ fontSize: 20, color: 'var(--hint)' }}>→</div>
    </div>
  );
}