type GeoResult = {
  address: string | null;
  shortAddress: string | null;
};

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeoResult> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('accept-language', 'ru');
    url.searchParams.set('zoom', '18');   // 18 = уровень дома

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim требует осмысленный User-Agent
        'User-Agent': 'zhkh-app/1.0 (contact: your-email@example.com)',
        'Accept-Language': 'ru',
      },
      // Кэш на 1 день — адрес по координатам не меняется
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.warn('[geocode] HTTP', res.status);
      return { address: null, shortAddress: null };
    }

    const data = await res.json();

    const full = data?.display_name ?? null;

    // Собираем короткий адрес: «ул. Ленина, 15»
    const a = data?.address ?? {};
    const parts = [
      a.road,
      a.house_number,
    ].filter(Boolean);
    const short = parts.length ? parts.join(', ') : null;

    return {
      address: full,
      shortAddress: short,
    };
  } catch (e) {
    console.error('[geocode] failed', e);
    return { address: null, shortAddress: null };
  }
}