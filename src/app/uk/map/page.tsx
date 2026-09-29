'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { Spinner } from '@/components/ui/Spinner';

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  lat: string | null;
  lng: string | null;
  locationAddress: string | null;
  houseAddress: string | null;
  premiseNumber: string | null;
};

export default function UKMapPage() {
  const router = useRouter();
  const { ready, inMax, profile } = useMax();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useBackButton(() => router.push('/uk'));

  // Загрузка данных
  useEffect(() => {
    if (!ready || !inMax) return;

    fetch('/api/uk/tickets/map', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setTickets(d);
          setCount(d.length);
        }
      })
      .finally(() => setLoading(false));
  }, [ready, inMax]);

  // Инициализация карты
  useEffect(() => {
    if (!tickets.length || !mapRef.current || mapInstance.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [55.751244, 37.618423],
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const colorByPriority = (priority: string, status: string) => {
        if (status === 'done') return '#10b981';
        if (status === 'rejected') return '#9ca3af';
        if (priority === 'emergency') return '#dc2626';
        if (priority === 'high') return '#f59e0b';
        return '#2563eb';
      };

      const bounds: [number, number][] = [];

      for (const t of tickets) {
        const lat = Number(t.lat);
        const lng = Number(t.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const color = colorByPriority(t.priority, t.status);

        const marker = L.circleMarker([lat, lng], {
          radius: 9,
          fillColor: color,
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);

        const address = t.locationAddress
          || (t.houseAddress ? `${t.houseAddress}, кв. ${t.premiseNumber ?? '—'}` : 'Адрес не указан');

        marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
            <strong>${t.title}</strong>
            <div style="font-size: 12px; color: #666;">${address}</div>
            <a href="/uk/ticket/${t.id}" style="display: block; margin-top: 8px; padding: 6px; text-align: center; background: #2481cc; color: #fff; border-radius: 6px; text-decoration: none; font-size: 12px;">
            Открыть заявку
            </a>
        </div>
        `);

        marker.on('click', () => {
          // Опционально: открыть карточку по кнопке в popup
        });

        bounds.push([lat, lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds as any, { padding: [40, 40] });
      }

      mapInstance.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [tickets]);

  if (!ready || loading) return <Spinner />;

  if (!inMax || !['uk', 'admin'].includes(profile?.role ?? '')) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Доступ запрещён</div>;
  }

  return (
    <main style={{
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Шапка */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--separator, #e5e7eb)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Карта заявок</div>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginTop: 2 }}>
            {count} заявок с координатами
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--separator, #e5e7eb)',
        display: 'flex',
        gap: 12,
        fontSize: 11,
        flexWrap: 'wrap',
      }}>
        <LegendDot color="#dc2626" label="Авария" />
        <LegendDot color="#f59e0b" label="Высокий" />
        <LegendDot color="#2563eb" label="Обычный" />
        <LegendDot color="#10b981" label="Выполнено" />
        <LegendDot color="#9ca3af" label="Отклонено" />
      </div>

      {/* Карта */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#f0f0f0',
          }}
        />

        {!tickets.length && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.95)',
            padding: 20,
            borderRadius: 12,
            textAlign: 'center',
            fontSize: 14,
            color: 'var(--hint)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
            Пока нет заявок с координатами
          </div>
        )}
      </div>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: color,
        border: '1px solid #fff',
        boxShadow: '0 0 2px rgba(0,0,0,0.2)',
      }} />
      <span style={{ color: 'var(--hint)' }}>{label}</span>
    </div>
  );
}