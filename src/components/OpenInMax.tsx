'use client';
import { useEffect, useState } from 'react';

export function OpenInMax() {
  const maxUrl = process.env.NEXT_PUBLIC_MAX_BOT_URL ?? 'https://max.ru/';
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);

  const open = () => {
    // пробуем открыть через deep link, если мобильный
    window.location.href = maxUrl;
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      background: 'var(--bg, #fff)',
      color: 'var(--text, #111)',
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24,
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 44, marginBottom: 24,
      }}>
        💬
      </div>

      <h1 style={{ fontSize: 24, margin: '0 0 12px', fontWeight: 700 }}>
        Откройте в MAX
      </h1>

      <p style={{
        fontSize: 15, color: 'var(--hint, #6b7280)',
        maxWidth: 360, margin: '0 0 32px', lineHeight: 1.5,
      }}>
        Это приложение для управления домом работает внутри мессенджера MAX.
        Откройте его там, чтобы отправлять обращения и следить за статусом.
      </p>

      <button
        onClick={open}
        style={{
          padding: '14px 32px',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(102,126,234,0.35)',
        }}
      >
        Открыть в MAX
      </button>

      {!isMobile && (
        <p style={{
          fontSize: 13, color: 'var(--hint, #6b7280)',
          marginTop: 24, maxWidth: 320, lineHeight: 1.5,
        }}>
          Если MAX не установлен на телефоне — установите его
          и отсканируйте QR-код из чата с ботом.
        </p>
      )}

      <p style={{
        fontSize: 12, color: 'var(--hint, #9ca3af)',
        marginTop: 40, opacity: 0.7,
      }}>
        Сервис ЖКХ
      </p>
    </div>
  );
}