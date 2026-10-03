import type { StopCategory, TripDetail } from '@/types'

/** Luogo scelto: dal geocoder o da una tappa già presente nel viaggio. */
export interface Place {
  name: string
  address: string | null
  lat: number
  lon: number
  category: StopCategory | null
  external_ref: string | null
  source: 'trip' | 'geocoder'
}

/** Luoghi già usati nel viaggio (hotel, stazioni…): si riusano senza chiamare il geocoder. */
export function tripPlaces(trip: TripDetail): Place[] {
  const seen = new Map<string, Place>()
  for (const day of trip.days) {
    for (const s of day.stops) {
      if (s.lat == null || s.lon == null) continue
      const key = s.external_ref ?? `${s.name.toLowerCase()}|${s.lat.toFixed(4)}|${s.lon.toFixed(4)}`
      if (!seen.has(key)) {
        seen.set(key, {
          name: s.name,
          address: s.address ?? null,
          lat: s.lat,
          lon: s.lon,
          category: s.category,
          external_ref: s.external_ref ?? null,
          source: 'trip',
        })
      }
    }
  }
  return [...seen.values()]
}

/** Centro delle tappe geolocalizzate: orienta la ricerca verso la zona del viaggio. */
export function tripCenter(trip: TripDetail): { lat: number; lon: number } | null {
  const pts = trip.days.flatMap((d) => d.stops).filter((s) => s.lat != null && s.lon != null)
  if (pts.length === 0) return null
  return {
    lat: pts.reduce((n, s) => n + (s.lat ?? 0), 0) / pts.length,
    lon: pts.reduce((n, s) => n + (s.lon ?? 0), 0) / pts.length,
  }
}

export function matchTripPlaces(places: Place[], query: string, limit = 4): Place[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []
  return places.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit)
}
