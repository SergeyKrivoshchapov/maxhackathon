'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { usePolling } from '@/hooks/usePolling';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/TextArea';
import { PhotoGrid } from '@/components/ui/PhotoGrid';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { wa, ready, inMax } = useMax();
  const haptic = useHaptic();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
      if (r.ok) {
        const next = await r.json();
        setData(next);
      }
    } catch (e) {
      console.error('[poll] load failed', e);
    }
  }, [id]);

  // первичная загрузка + polling каждые 10 сек
  useEffect(() => {
    if (!ready || !inMax) return;
    load().finally(() => setLoading(false));
  }, [ready, inMax, load]);

  usePolling(load, 10000, ready && inMax);

  useBackButton(() => router.back());

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    haptic.press();
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      setText('');
      haptic.success();
      await load();
    } catch (e: any) {
      haptic.error();
      wa?.showAlert?.(`Ошибка: ${e.message}`);
    } finally {
      setSending(false);
    }
  }, [text, sending, id, haptic, load, wa]);

  const hasNativeButton = !!wa?.MainButton;

  useMainButton({
    text: 'Отправить сообщение',
    visible: inMax && hasNativeButton && !!text.trim(),
    enabled: !!text.trim() && !sending,
    progress: sending,
    onClick: send,
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

  if (!data) return <Spinner />;

  const { ticket, messages } = data;
  const overdue =
    ticket.slaDeadline &&
    !['done', 'rejected'].includes(ticket.status) &&
    new Date(ticket.slaDeadline) < new Date();

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
      <h2 style={{ margin: '8px 0 12px', fontSize: 20 }}>{ticket.title}</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusBadge status={ticket.status} />
        <span style={{ fontSize: 12, color: 'var(--hint)' }}>
          {ticket.categoryName ?? 'Без категории'} ·{' '}
          {new Date(ticket.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>

      {overdue && (
        <div style={{
          background: '#fee2e2', color: '#991b1b',
          padding: 10, borderRadius: 10, fontSize: 13,
          fontWeight: 600, marginBottom: 12,
        }}>
          ⚠ Просрочено SLA
        </div>
      )}

      {ticket.description && <Card>{ticket.description}</Card>}

      {ticket.houseAddress && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--hint)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📍</span>
          <span>
            {ticket.houseAddress}
            {ticket.premiseNumber && `, кв. ${ticket.premiseNumber}`}
          </span>
        </div>
      )}
      
      <PhotoGrid urls={ticket.photos ?? []} columns={3} />

      <div className="section-title">Сообщения</div>

      {messages.length === 0 && (
        <div style={{ padding: '8px 0', color: 'var(--hint)', fontSize: 14 }}>
          Пока пусто
        </div>
      )}

      {messages.map((m: any) => (
        <Card key={m.id}>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 4 }}>
            {m.authorName ?? 'Система'} · {new Date(m.createdAt).toLocaleString('ru-RU')}
          </div>
          <PhotoGrid urls={m.attachments ?? []} columns={3} />
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
        </Card>
      ))}

      <div className="section-title">Написать</div>
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Сообщение…"
      />

      {!hasNativeButton && (
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{
            position: 'fixed',
            left: 16, right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
            padding: 16, border: 'none', borderRadius: 12,
            background: 'var(--button, #2481cc)',
            color: '#fff', fontSize: 16, fontWeight: 600,
            opacity: (!text.trim() || sending) ? 0.5 : 1,
            zIndex: 100,
          }}
        >
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      )}
    </main>
  );
}