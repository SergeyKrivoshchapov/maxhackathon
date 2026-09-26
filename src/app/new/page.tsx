'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { useMax } from '@/components/providers/MaxProvider';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

type Category = { id: number; name: string; code: string };

export default function NewTicketPage() {
  const router = useRouter();
  const { wa, ready } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'emergency'>('normal');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories);
  }, []);

  useBackButton(() => router.back());

  const submit = useCallback(async () => {
    if (!catId || !title.trim() || busy) return;
    setBusy(true);
    haptic.press();

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: catId,
          title: title.trim(),
          description: desc.trim() || null,
          photos,
          priority,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      haptic.success();
      await dialog.alert('Обращение отправлено');
      router.push('/');
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [catId, title, desc, photos, priority, busy, haptic, dialog, router]);

  useMainButton({
    text: 'Отправить',
    visible: !!wa?.initData,
    enabled: !!catId && !!title.trim() && !busy,
    progress: busy,
    onClick: submit,
  });

  if (!ready) return <Spinner />;

  if (!wa?.initData) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <h2>Откройте через MAX</h2>
        <p style={{ color: 'var(--hint)' }}>Приложение работает внутри MAX.</p>
      </div>
    );
  }

  const pickPhoto = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const { supabaseBrowser } = await import('@/lib/supabase');
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      setBusy(true);
      const urls: string[] = [];
      for (const f of files) {
        const path = `tickets/${crypto.randomUUID()}-${f.name}`;
        const { error } = await supabaseBrowser.storage
          .from('ticket-photos')
          .upload(path, f);
        if (error) continue;
        const { data } = supabaseBrowser.storage
          .from('ticket-photos')
          .getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setPhotos((p) => [...p, ...urls]);
      setBusy(false);
      haptic.tap();
    };
    input.click();
  };

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <div className="section-title">Категория</div>
      <Select value={catId ?? ''} onChange={(e) => setCatId(Number(e.target.value))}>
        <option value="">— выберите —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>

      <div className="section-title">Кратко</div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: течёт кран в ванной"
        maxLength={120}
      />

      <div className="section-title">Описание</div>
      <Textarea
        rows={4}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Подробнее, что и где произошло"
      />

      <div className="section-title">Приоритет</div>
      <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
        <option value="low">Низкий</option>
        <option value="normal">Обычный</option>
        <option value="high">Высокий</option>
        <option value="emergency">Аварийный</option>
      </Select>

      <div className="section-title">Фото</div>
      <button
        onClick={pickPhoto}
        disabled={busy}
        style={{
          width: '100%', padding: 14, borderRadius: 10,
          border: '1px dashed var(--separator)',
          background: 'var(--bg-secondary)',
          color: 'var(--link)', fontSize: 15, cursor: 'pointer',
        }}
      >
        + Добавить фото
      </button>

      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {photos.map((u) => (
            <img
              key={u}
              src={u}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
            />
          ))}
        </div>
      )}
    </main>
  );
}