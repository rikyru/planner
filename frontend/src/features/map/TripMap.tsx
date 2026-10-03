import 'maplibre-gl/dist/maplibre-gl.css'
import '@/features/map/maplibreWorker'

import { LngLatBounds, Map as MapLibre, Marker, NavigationControl, Popup, type GeoJSONSource } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'

import { usePublicConfig } from '@/api/config'
import type { MapPoint } from '@/features/map/mapData'
import { cn } from '@/lib/utils'

interface Props {
  points: MapPoint[]
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>
  /** Cambia quando si deve ricentrare (es. cambio giorno). */
  fitKey: string
  selectedId?: string | null
  hoveredId?: string | null
  onSelect?: (id: string | null) => void
  onHover?: (id: string | null) => void
  className?: string
  interactive?: boolean
  /** Marker più piccoli, per la vista d'insieme con molte tappe. */
  compact?: boolean
}

const SOURCE = 'segments'

function markerElement(point: MapPoint, compact: boolean): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = compact ? 'trip-marker is-compact' : 'trip-marker'
  el.style.setProperty('--marker-color', point.color)
  el.textContent = point.label
  el.setAttribute('aria-label', `${point.label}. ${point.title}`)
  return el
}

/** Mappa MapLibre: marker numerati, linee dei segmenti, bounds automatici, sync con la timeline. */
export function TripMap({ points, lines, fitKey, selectedId, hoveredId, onSelect, onHover, className, interactive = true, compact = false }: Props) {
  const config = usePublicConfig()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>())
  const popup = useRef<Popup | null>(null)
  const [loaded, setLoaded] = useState(false)
  const handlers = useRef({ onSelect, onHover })
  handlers.current = { onSelect, onHover }

  // Creazione della mappa una sola volta, con lo stile letto da /api/config.
  useEffect(() => {
    if (!container.current || !config.data || mapRef.current) return
    const map = new MapLibre({
      container: container.current,
      style: config.data.map_style_url,
      center: [12.5, 41.9],
      zoom: 2,
      attributionControl: { compact: true, customAttribution: config.data.map_attribution || undefined },
      cooperativeGestures: !interactive,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'segments-solid',
        type: 'line',
        source: SOURCE,
        filter: ['==', ['get', 'dashed'], false],
        paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.85 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: 'segments-dashed',
        type: 'line',
        source: SOURCE,
        filter: ['==', ['get', 'dashed'], true],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [1.5, 1.5] },
        layout: { 'line-cap': 'round' },
      })
      setLoaded(true)
    })
    map.on('click', (e) => {
      if ((e.originalEvent.target as HTMLElement).closest('.trip-marker')) return
      handlers.current.onSelect?.(null)
    })
    mapRef.current = map
    const currentMarkers = markers.current
    return () => {
      currentMarkers.forEach(({ marker }) => marker.remove())
      currentMarkers.clear()
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [config.data, interactive])

  // Marker: ricreati quando cambiano le tappe.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markers.current.forEach(({ marker }) => marker.remove())
    markers.current.clear()
    for (const point of points) {
      const el = markerElement(point, compact)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handlers.current.onSelect?.(point.id)
      })
      el.addEventListener('mouseenter', () => handlers.current.onHover?.(point.id))
      el.addEventListener('mouseleave', () => handlers.current.onHover?.(null))
      const marker = new Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map)
      markers.current.set(point.id, { marker, el })
    }
  }, [points, config.data, compact])

  // Linee dei segmenti.
  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCE) as GeoJSONSource | undefined
    if (loaded && source) source.setData(lines)
  }, [lines, loaded])

  // Bounds automatici al cambio giorno (o quando compaiono le prime coordinate).
  const hasPoints = points.length > 0
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasPoints) return
    const bounds = new LngLatBounds()
    points.forEach((p) => bounds.extend([p.lon, p.lat]))
    map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, hasPoints, config.data])

  // Evidenziazione e popup della tappa selezionata.
  useEffect(() => {
    const map = mapRef.current
    markers.current.forEach(({ el }, id) => {
      el.classList.toggle('is-selected', id === selectedId)
      el.classList.toggle('is-hovered', id === hoveredId)
    })
    popup.current?.remove()
    const point = points.find((p) => p.id === selectedId)
    if (!map || !point) return
    const content = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = point.title
    const sub = document.createElement('div')
    sub.textContent = point.subtitle
    sub.className = 'trip-popup-sub'
    content.append(title, sub)
    popup.current = new Popup({ offset: 18, closeButton: false, className: 'trip-popup' })
      .setLngLat([point.lon, point.lat])
      .setDOMContent(content)
      .addTo(map)
    map.easeTo({ center: [point.lon, point.lat], duration: 400 })
  }, [selectedId, hoveredId, points])

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-muted', className)}>
      <div ref={container} className="h-full w-full" />
      {!hasPoints && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow">
          Le tappe con una posizione compariranno qui
        </div>
      )}
    </div>
  )
}
