'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';

export function PhotoUploader({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const out: string[] = [];
    for (const f of Array.from(files)) {
      const path = `tickets/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabaseBrowser.storage.from('ticket-photos').upload(path, f);
      if (error) { console.error(error); continue; }
      const { data } = supabaseBrowser.storage.from('ticket-photos').getPublicUrl(path);
      out.push(data.publicUrl);
    }
    const all = [...urls, ...out];
    setUrls(all);
    onUploaded(all);
    setBusy(false);
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        disabled={busy}
        onChange={(e) => handle(e.target.files)}
      />
      {busy && <div style={{ fontSize: 12 }}>Загрузка…</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {urls.map((u) => (
          <img key={u} src={u} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}