'use client';
import { useState } from 'react';

type Props = {
  urls: string[];
  size?: number;
  columns?: number;
};

export function PhotoGrid({ urls, columns = 3 }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  if (!urls?.length) return null;

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${100 / columns}px, 1fr))`,
        gap: 8,
        marginTop: 8,
      }}>
        {urls.map((u, i) => (
          <div key={u} style={{ aspectRatio: '1/1' }}>
            <img
              src={u}
              alt={`Фото ${i + 1}`}
              loading="lazy"
              onClick={() => setPreview(u)}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                borderRadius: 10,
                cursor: 'zoom-in',
                border: '1px solid var(--separator, #e5e7eb)',
              }}
            />
          </div>
        ))}
      </div>

      {preview && (
        <div
          onClick={() => setPreview(null)}
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
            src={preview}
            alt="Просмотр"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </>
  );
}