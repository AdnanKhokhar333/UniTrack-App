/** Haversine distance in kilometres between two WGS84 points. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rough ETA minutes assuming average bus speed (km/h). */
export function etaMinutes(
  distanceKm: number,
  speedKmh?: number | null
): number {
  const speed =
    speedKmh != null && speedKmh > 5 ? speedKmh : 25; // fallback city bus speed
  return (distanceKm / speed) * 60;
}

export function isValidCoord(
  lat?: number | null,
  lng?: number | null
): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
