'use client';
import { useState } from 'react';
import { MSG } from '@/lib/messages';

async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  const isSupported =
    type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' ||
    name.endsWith('.jpg') || name.endsWith('.jpeg') ||
    name.endsWith('.png') || name.endsWith('.webp');

  if (!isSupported) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  folder?: 'tickets' | 'messages';
  disabled?: boolean;
};

export function PhotoUploader({
  value,
  onChange,
  max = 5,
  folder = 'tickets',
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pick = () => {
    if (disabled || busy) return;
    if (value.length >= max) {
      setError(`Максимум ${max} фото`);
      return;
    }
    setError(null);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      setBusy(true);
      setError(null);

      try {
        const fd = new FormData();
        const slice = files.slice(0, max - value.length);
        let i = 0;
        for (const f of slice) {
          i++;
          setProgress(`Обработка ${i}/${slice.length}…`);
          const compressed = await compressImage(f, 1600, 0.8);
          const name = (f.name || `photo-${i}`).replace(/\.[^.]+$/, '') + '.jpg';
          fd.append('file', compressed, name);
        }

        setProgress('Загрузка…');
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(MSG.uploadFailed);
        }

        const data = await res.json();
        if (Array.isArray(data.urls) && data.urls.length) {
          onChange([...value, ...data.urls]);
        } else {
          setError(MSG.uploadFailed);
        }
      } catch (e: any) {
        setError(e?.message ?? MSG.uploadFailed);
      } finally {
        setBusy(false);
        setProgress(null);
      }
    };

    input.click();
  };

  const remove = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div>
      <button
        type="button"
        onClick={pick}
        disabled={disabled || busy || value.length >= max}
        style={{
          width: '100%', padding: 14, borderRadius: 10,
          border: '1px dashed var(--separator, #ccc)',
          background: 'var(--bg-secondary, #f4f4f5)',
          color: 'var(--link, #2481cc)',
          fontSize: 15,
          cursor: disabled || busy ? 'wait' : 'pointer',
          opacity: disabled || busy ? 0.6 : 1,
        }}
      >
        {busy
          ? (progress ?? 'Загрузка…')
          : value.length >= max
            ? `Загружено максимум (${max})`
            : `+ Добавить фото (${value.length}/${max})`}
      </button>

      {error && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 8,
          marginTop: 12,
        }}>
          {value.map((u, i) => (
            <div key={u} style={{ position: 'relative', aspectRatio: '1 / 1' }}>
              <img
                src={u}
                alt={`Фото ${i + 1}`}
                loading="lazy"
                onClick={() => setPreviewUrl(u)}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  borderRadius: 10,
                  cursor: 'zoom-in',
                  border: '1px solid var(--separator, #e5e7eb)',
                }}
              />
              <button
                type="button"
                onClick={() => remove(u)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 24, height: 24, borderRadius: '50%',
                  border: '2px solid var(--bg, #fff)',
                  background: '#dc2626', color: '#fff',
                  fontSize: 14, cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <img
            src={previewUrl}
            alt="Просмотр"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}