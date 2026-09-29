'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  lat?: number | string | null;
  lng?: number | string | null;
  address?: string | null;
};

export function TicketLocation({ lat, lng, address }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const nLat = lat != null ? Number(lat) : null;
  const nLng = lng != null ? Number(lng) : null;

  const hasCoords =
    nLat != null && nLng != null &&
    Number.isFinite(nLat) && Number.isFinite(nLng);

  useEffect(() => {
    if (!expanded || !hasCoords || !mapRef.current || mapInstance.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;

      const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
      const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
      const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
      const DefaultIcon = L.icon({
        iconUrl, iconRetinaUrl, shadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      const map = L.map(mapRef.current, {
        center: [nLat!, nLng!],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        tap: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.marker([nLat!, nLng!]).addTo(map);

      mapInstance.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [expanded, hasCoords, nLat, nLng]);

  if (!hasCoords && !address) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      {address && (
        <div style={{
          fontSize: 14, color: 'var(--text)',
          marginBottom: 6,
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <span>📍</span>
          <span>{address}</span>
        </div>
      )}

      {hasCoords && (
        <>
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                width: '100%', padding: 12,
                borderRadius: 10,
                border: '1px dashed var(--separator, #e5e7eb)',
                background: 'var(--bg-secondary, #f4f4f5)',
                color: 'var(--link, #2481cc)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              🗺 Показать на карте
            </button>
          )}

          {expanded && (
            <div style={{ position: 'relative' }}>
              <div
                ref={mapRef}
                style={{
                  width: '100%', height: 200,
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid var(--separator)',
                  background: '#f0f0f0',
                }}
              />
              {!ready && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 12,
                }}>Загрузка…</div>
              )}
              <button
                onClick={() => setExpanded(false)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 32, height: 32, borderRadius: '50%',
                  border: 'none', background: 'rgba(255,255,255,0.9)',
                  cursor: 'pointer', fontSize: 16,
                }}
              >×</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}