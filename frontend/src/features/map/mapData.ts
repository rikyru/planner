import type { Day, Segment, Stop } from '@/types'
import { CATEGORIES, TRANSPORT } from '@/utils/labels'

export interface MapPoint {
  id: string
  lat: number
  lon: number
  label: string
  title: string
  subtitle: string
  color: string
}

export function dayPoints(day: Day): MapPoint[] {
  return day.stops.flatMap((stop, index) =>
    stop.lat != null && stop.lon != null
      ? [
          {
            id: stop.id,
            lat: stop.lat,
            lon: stop.lon,
            // Numero = posizione in timeline: una tappa senza coordinate lascia un buco, di proposito.
            label: String(index + 1),
            title: stop.name,
            subtitle: CATEGORIES[stop.category].label,
            color: CATEGORIES[stop.category].color,
          },
        ]
      : [],
  )
}

export const DAY_COLORS = ['#2f6577', '#c8643b', '#6b5b95', '#4f7f4f', '#b5577a', '#4a6fa5', '#b07d2b', '#3d3b6e']

export function overviewPoints(days: Day[]): MapPoint[] {
  return days.flatMap((day) =>
    day.stops.flatMap((stop) =>
      stop.lat != null && stop.lon != null
        ? [
            {
              id: stop.id,
              lat: stop.lat,
              lon: stop.lon,
              label: String(day.day_number),
              title: stop.name,
              subtitle: `Giorno ${day.day_number}${day.title ? ` · ${day.title}` : ''}`,
              color: DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length] ?? '#2f6577',
            },
          ]
        : [],
    ),
  )
}

type LineFeature = GeoJSON.Feature<GeoJSON.LineString, { color: string; dashed: boolean }>

function segmentLine(segment: Segment, byId: Map<string, Stop>, color: string): LineFeature | null {
  if (segment.geometry && segment.geometry.length >= 2) {
    return {
      type: 'Feature',
      properties: { color, dashed: false },
      geometry: { type: 'LineString', coordinates: segment.geometry.map(([lon, lat]) => [lon, lat]) },
    }
  }
  const a = byId.get(segment.from_stop_id)
  const b = byId.get(segment.to_stop_id)
  if (a?.lat == null || a.lon == null || b?.lat == null || b.lon == null) return null
  // Senza percorso reale: linea retta tratteggiata tra le due tappe.
  return {
    type: 'Feature',
    properties: { color, dashed: true },
    geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
  }
}

export function dayLines(day: Day): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const byId = new Map(day.stops.map((s) => [s.id, s]))
  const features = day.segments
    .map((seg) => segmentLine(seg, byId, TRANSPORT[seg.transport_mode].color))
    .filter((f): f is LineFeature => f !== null)
  return { type: 'FeatureCollection', features }
}

export function overviewLines(days: Day[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features = days.flatMap((day) => {
    const byId = new Map(day.stops.map((s) => [s.id, s]))
    const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length] ?? '#2f6577'
    return day.segments.map((seg) => segmentLine(seg, byId, color)).filter((f): f is LineFeature => f !== null)
  })
  return { type: 'FeatureCollection', features }
}
