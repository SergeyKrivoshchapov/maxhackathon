'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, address?: string | null) => void;
};

export function LocationPicker({
  open,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);

  // Инициализация карты
  useEffect(() => {
    if (!open || !mapRef.current || mapInstance.current) return;

    let cancelled = false;
    setReady(false);
    setError(null);
    setAddress(null);

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (cancelled || !mapRef.current) return;

        const startLat = initialLat ?? 55.751244;
        const startLng = initialLng ?? 37.618423;

        const map = L.map(mapRef.current, {
          center: [startLat, startLng],
          zoom: 17,
          zoomControl: false,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const updateCenter = () => {
          const c = map.getCenter();
          setCenter({ lat: c.lat, lng: c.lng });
          scheduleGeocode(c.lat, c.lng);
        };

        map.on('move', updateCenter);
        map.on('moveend', updateCenter);

        updateCenter();
        mapInstance.current = map;
        setReady(true);
      } catch (e: any) {
        console.error('[map] init failed:', e);
        setError(e?.message ?? 'Ошибка карты');
      }
    })();

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      setReady(false);
    };
  }, [open, initialLat, initialLng]);

  // Дебаунс геокодирования — 800 мс после остановки карты
  const scheduleGeocode = (lat: number, lng: number) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      runGeocode(lat, lng);
    }, 800);
  };

  const runGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `/api/geocode?lat=${lat}&lng=${lng}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setAddress(data.shortAddress ?? data.address ?? null);
      } else {
        setAddress(null);
      }
    } catch (e) {
      console.error('[geocode] failed', e);
      setAddress(null);
    } finally {
      setGeocoding(false);
    }
  };

  const goToMyLocation = () => {
    if (!navigator.geolocation || !mapInstance.current) {
      setError('Геолокация не поддерживается');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapInstance.current.setView(
          [pos.coords.latitude, pos.coords.longitude],
          17
        );
      },
      (err) => {
        setLocating(false);
        console.error('[map] geo error', err);
        setError('Не удалось определить местоположение');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    if (!center) return;
    onConfirm(center.lat, center.lng, address);
    onClose();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#fff', display: 'flex', flexDirection: 'column',
    }}>
      {/* Верхняя панель */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(12px + env(safe-area-inset-top, 0)) 16px 12px',
        background: '#fff',
        borderBottom: '1px solid var(--separator, #e5e7eb)',
        zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', fontSize: 16,
          color: 'var(--link, #2481cc)', cursor: 'pointer', padding: 4,
        }}>Отмена</button>

        <div style={{ fontSize: 15, fontWeight: 600 }}>Укажите место</div>

        <button
          onClick={handleConfirm}
          disabled={!ready || !center}
          style={{
            border: 'none', background: 'transparent', fontSize: 16,
            fontWeight: 600,
            color: ready && center ? 'var(--link, #2481cc)' : 'var(--hint, #999)',
            cursor: ready && center ? 'pointer' : 'not-allowed',
            padding: 4,
          }}
        >Готово</button>
      </div>

      {/* Карта */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#f0f0f0' }} />

        {/* Прицел */}
        {ready && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none', zIndex: 500,
            fontSize: 40, lineHeight: 1,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
          }}>📍</div>
        )}

        {/* Точка-якорь */}
        {ready && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            pointerEvents: 'none', zIndex: 500,
          }} />
        )}

        {/* Кнопка «Моё местоположение» */}
        {ready && (
          <button
            onClick={goToMyLocation}
            disabled={locating}
            aria-label="Моё местоположение"
            style={{
              position: 'absolute', right: 16, bottom: 100,
              width: 48, height: 48, borderRadius: '50%',
              border: 'none', background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: 22,
              cursor: locating ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 500,
            }}
          >{locating ? '⏳' : '🎯'}</button>
        )}

        {!ready && !error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', zIndex: 600,
          }}>Загрузка карты…</div>
        )}

        {error && (
          <div style={{
            position: 'absolute', top: 16, left: 16, right: 16,
            padding: 12, borderRadius: 10,
            background: '#fee2e2', color: '#991b1b',
            fontSize: 14, zIndex: 600,
          }}>{error}</div>
        )}
      </div>

      {/* Нижняя панель — адрес + координаты */}
      <div style={{
        padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0))',
        background: '#fff',
        borderTop: '1px solid var(--separator, #e5e7eb)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 6 }}>
          Двигайте карту, чтобы поставить точку
        </div>

        <div style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
          minHeight: 20,
        }}>
          {geocoding
            ? '⏳ Определяем адрес…'
            : address
              ? `📍 ${address}`
              : center
                ? `📍 ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
                : '—'}
        </div>

        {address && center && (
          <div style={{ fontSize: 12, color: 'var(--hint)' }}>
            {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </div>
        )}
      </div>
    </div>
  );
}