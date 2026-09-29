'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

export function LocationPicker({
  lat,
  lng,
  onChange,
  height = 280,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    let cancelled = false;

    (async () => {
      try {
        console.log('[map] loading leaflet');
        const L = (await import('leaflet')).default;

        if (cancelled || !mapRef.current) return;

        // Фикс иконок Leaflet — они не находятся в собранном Next.js
        const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

        const DefaultIcon = L.icon({
          iconUrl,
          iconRetinaUrl,
          shadowUrl,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        const initialLat = lat ?? 55.751244;
        const initialLng = lng ?? 37.618423;

        const map = L.map(mapRef.current, {
          center: [initialLat, initialLng],
          zoom: 15,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          console.log('[map] dragend:', pos.lat, pos.lng);
          onChange(pos.lat, pos.lng);
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          console.log('[map] click:', e.latlng.lat, e.latlng.lng);
          onChange(e.latlng.lat, e.latlng.lng);
        });

        mapInstance.current = map;
        markerRef.current = marker;
        setReady(true);
        console.log('[map] ready');
      } catch (e: any) {
        console.error('[map] init failed:', e);
        setError(e?.message ?? 'Ошибка карты');
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Обновление маркера, если координаты меняются извне
  useEffect(() => {
    if (!markerRef.current || !mapInstance.current || !ready) return;
    if (lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    mapInstance.current.setView([lat, lng], mapInstance.current.getZoom());
  }, [lat, lng, ready]);

  if (error) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: '#dc2626',
        background: 'var(--bg-secondary)', borderRadius: 12,
      }}>
        Не удалось загрузить карту: {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--separator, #e5e7eb)',
          background: '#f0f0f0',
          zIndex: 0,
        }}
      />
      {!ready && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.8)',
          borderRadius: 12,
        }}>
          Загрузка карты…
        </div>
      )}
    </div>
  );
}