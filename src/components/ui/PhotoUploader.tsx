'use client';
import { useState } from 'react';

async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/heic' || file.type === 'image/heif') return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

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
      if (!ctx) return reject(new Error('no canvas ctx'));
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
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

  const pick = () => {
    if (disabled || busy) return;
    if (value.length >= max) {
      setError(`Максимум ${max} фото`);
      return;
    }
    setError(null);
    setProgress(null);

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
          setProgress(`Сжатие ${i}/${slice.length}…`);
          const compressed = await compressImage(f, 1600, 0.8);
          const name = (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
          fd.append('file', compressed, name);
        }

        setProgress('Загрузка…');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data.urls)) {
          onChange([...value, ...data.urls]);
        }
      } catch (e: any) {
        console.error('[upload] failed', e);
        setError(e?.message ?? 'Ошибка загрузки');
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
        {busy ? (progress ?? 'Загрузка…') : `+ Добавить фото (${value.length}/${max})`}
      </button>

      {error && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {value.map((u) => (
            <div key={u} style={{ position: 'relative' }}>
              <img
                src={u}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
              />
              <button
                type="button"
                onClick={() => remove(u)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: '50%',
                  border: 'none', background: '#dc2626', color: '#fff',
                  fontSize: 14, cursor: 'pointer', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}