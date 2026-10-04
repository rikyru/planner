import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { ApiError } from '@/api/client'
import { useSharedTrip } from '@/api/share'
import { DAY_COLORS, type MapPoint } from '@/features/map/mapData'
import { TripMap } from '@/features/map/TripMap'
import { TripCover } from '@/features/trips/TripCover'
import { cn } from '@/lib/utils'
import type { SharedDay, SharedIdea, SharedPhoto, SharedStop, SharedTrip } from '@/types'
import { formatDateRange, formatDayLong, formatDuration, formatTime } from '@/utils/dates'
import { CATEGORIES, PRECISION, TRANSPORT } from '@/utils/labels'

/** Diario pubblico in sola lettura (/share/:token). Caricato a parte: chi apre il link non
 * scarica l'editor. */
export function SharePage() {
  const { token } = useParams()
  const trip = useSharedTrip(token)
  useDocumentMeta(trip.data?.title)

  if (trip.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">Caricamento del diario…</div>
    )
  }
  if (trip.isError) {
    const missing = trip.error instanceof ApiError && trip.error.status === 404
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-serif text-3xl font-semibold">
          {missing ? 'Diario non disponibile' : 'Qualcosa è andato storto'}
        </p>
        <p className="max-w-sm text-muted-foreground">
          {missing ? 'Il link potrebbe essere stato disattivato o sostituito da uno nuovo.' : trip.error.message}
        </p>
      </div>
    )
  }
  return <Journal trip={trip.data} />
}

function useDocumentMeta(title: string | undefined) {
  useEffect(() => {
    const previous = document.title
    if (title) document.title = title
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => {
      document.title = previous
      robots.remove()
    }
  }, [title])
}

function dayColor(day: SharedDay) {
  return DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length] ?? '#2f6577'
}

function mapData(days: SharedDay[]) {
  const points: MapPoint[] = []
  const features: GeoJSON.Feature<GeoJSON.LineString, { color: string; dashed: boolean }>[] = []
  for (const day of days) {
    const color = dayColor(day)
    const located = day.stops.filter(
      (s): s is SharedStop & { lat: number; lon: number } => s.lat != null && s.lon != null,
    )
    for (const stop of located) {
      points.push({
        id: stop.id,
        lat: stop.lat,
        lon: stop.lon,
        label: String(day.day_number),
        title: stop.name,
        subtitle: `Giorno ${day.day_number}${day.title ? ` · ${day.title}` : ''}`,
        color,
      })
    }
    if (located.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { color, dashed: true },
        geometry: { type: 'LineString', coordinates: located.map((s) => [s.lon, s.lat]) },
      })
    }
  }
  return { points, lines: { type: 'FeatureCollection' as const, features } }
}

function Journal({ trip }: { trip: SharedTrip }) {
  const { points, lines } = useMemo(() => mapData(trip.days), [trip.days])
  const allPhotos = useMemo(() => trip.days.flatMap((d) => d.photos), [trip.days])
  const [viewer, setViewer] = useState<number | null>(null)
  const openPhoto = (photo: SharedPhoto) => setViewer(allPhotos.findIndex((p) => p.id === photo.id))
  const days = trip.days.filter((d) => d.stops.length > 0 || d.photos.length > 0 || d.notes || d.title)

  return (
    <div className="min-h-svh bg-background">
      <header className="relative flex min-h-[68svh] items-end overflow-hidden bg-neutral-900 text-white">
        <div className="absolute inset-0">
          <TripCover seed={trip.title} title={trip.title} coverUrl={trip.cover_url} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="relative mx-auto w-full max-w-3xl px-5 pt-24 pb-10 sm:px-8 sm:pb-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
            {trip.kind === 'reconstruct' ? 'Diario di viaggio' : 'Itinerario'}
          </p>
          <h1 className="mt-2 font-serif text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl">
            {trip.title}
          </h1>
          <p className="mt-4 text-white/85 sm:text-lg">
            {formatDateRange(trip.start_date, trip.end_date)}
            <span className="mx-2 opacity-60">·</span>
            {trip.days.length} {trip.days.length === 1 ? 'giorno' : 'giorni'}
            <span className="mx-2 opacity-60">·</span>
            {trip.stop_count} {trip.stop_count === 1 ? 'tappa' : 'tappe'}
          </p>
        </div>
      </header>

      <DayNav days={days} />

      <main className="mx-auto max-w-3xl px-5 sm:px-8">
        {trip.description && (
          <p className="pt-10 font-serif text-xl leading-relaxed text-pretty sm:pt-14 sm:text-2xl">
            {trip.description}
          </p>
        )}

        {points.length > 0 && (
          <div className="mt-10 h-72 overflow-hidden rounded-2xl border shadow-xs sm:h-96">
            <TripMap points={points} lines={lines} fitKey="share" compact interactive={false} />
          </div>
        )}

        {days.map((day) => (
          <DayChapter key={day.day_number} day={day} onOpenPhoto={openPhoto} />
        ))}

        {trip.ideas.length > 0 && <IdeasChapter trip={trip} />}

        <footer className="border-t py-10 text-center text-sm text-muted-foreground">
          {formatDateRange(trip.start_date, trip.end_date)} · creato con Planner
        </footer>
      </main>

      <ShareLightbox photos={allPhotos} index={viewer} onIndexChange={setViewer} />
    </div>
  )
}

function DayNav({ days }: { days: SharedDay[] }) {
  if (days.length < 2) return null
  return (
    <nav
      aria-label="Giornate"
      className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-5 py-2.5 sm:px-8">
        {days.map((day) => (
          <a
            key={day.day_number}
            href={`#giorno-${day.day_number}`}
            className="shrink-0 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted"
          >
            <span className="font-serif font-semibold" style={{ color: dayColor(day) }}>
              {day.day_number}
            </span>
            <span className="ml-1.5 text-muted-foreground">
              {formatDayLong(day.date).split(' ').slice(1).join(' ')}
            </span>
          </a>
        ))}
      </div>
    </nav>
  )
}

function DayChapter({ day, onOpenPhoto }: { day: SharedDay; onOpenPhoto: (photo: SharedPhoto) => void }) {
  const color = dayColor(day)
  const byStop = new Map<string, SharedPhoto[]>()
  const loose: SharedPhoto[] = []
  for (const photo of day.photos) {
    if (photo.stop_id) byStop.set(photo.stop_id, [...(byStop.get(photo.stop_id) ?? []), photo])
    else loose.push(photo)
  }
  const segmentFrom = new Map(day.segments.map((s) => [s.from_stop_id, s]))

  return (
    <section id={`giorno-${day.day_number}`} className="scroll-mt-16 pt-16 sm:pt-20">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color }}>
        Giorno {day.day_number} · {formatDayLong(day.date)}
      </p>
      <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {day.title || formatDayLong(day.date)}
      </h2>
      {day.notes && (
        <p
          className="mt-4 border-l-2 pl-4 font-serif text-lg leading-relaxed text-muted-foreground italic"
          style={{ borderColor: color }}
        >
          {day.notes}
        </p>
      )}

      {day.stops.length > 0 && (
        <ol className="mt-8">
          {day.stops.map((stop, index) => {
            const segment = segmentFrom.get(stop.id)
            const last = index === day.stops.length - 1
            return (
              <li key={stop.id} className="relative grid grid-cols-[3.75rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr]">
                <StopTime stop={stop} />
                <div className={cn('relative border-l pb-8 pl-6', last && !loose.length && 'border-transparent')}>
                  <span
                    className="absolute top-1.5 -left-[7px] size-3.5 rounded-full border-2 border-background"
                    style={{ backgroundColor: CATEGORIES[stop.category].color }}
                    aria-hidden
                  />
                  <h3 className="font-serif text-xl leading-snug font-semibold">{stop.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {stop.category === 'custom' && stop.custom_category
                      ? stop.custom_category
                      : CATEGORIES[stop.category].label}
                    {stop.duration_min != null && ` · ${formatDuration(stop.duration_min)}`}
                  </p>
                  {stop.notes && <p className="mt-2 leading-relaxed text-pretty">{stop.notes}</p>}
                  {byStop.get(stop.id) && <PhotoSet photos={byStop.get(stop.id) ?? []} onOpen={onOpenPhoto} />}
                  {segment && !last && (
                    <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TransportIcon mode={segment.transport_mode} />
                      {TRANSPORT[segment.transport_mode].label}
                      {segment.duration_min != null && ` · ${formatDuration(segment.duration_min)}`}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {loose.length > 0 && (
        <div className={cn(day.stops.length > 0 ? 'mt-2' : 'mt-8')}>
          {day.stops.length > 0 && (
            <p className="mb-3 text-sm font-medium text-muted-foreground">Altri momenti della giornata</p>
          )}
          <PhotoSet photos={loose} onOpen={onOpenPhoto} />
        </div>
      )}
    </section>
  )
}

/** Nei diari i posti non visti, negli itinerari quelli ancora senza giorno. */
function IdeasChapter({ trip }: { trip: SharedTrip }) {
  const reconstruct = trip.kind === 'reconstruct'
  return (
    <section id="idee" className="scroll-mt-16 pt-16 pb-12 sm:pt-20">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {reconstruct ? 'Rimasti in lista' : 'Senza un giorno'}
      </p>
      <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {reconstruct ? 'Per la prossima volta' : 'Altre idee'}
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {trip.ideas.map((idea, index) => (
          <IdeaItem key={index} idea={idea} />
        ))}
      </ul>
    </section>
  )
}

function IdeaItem({ idea }: { idea: SharedIdea }) {
  const category = CATEGORIES[idea.category]
  const Icon = category.icon
  return (
    <li className="flex gap-3 rounded-xl border p-4">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: category.color }}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="font-serif text-lg leading-snug font-semibold">{idea.name}</h3>
        <p className="text-sm text-muted-foreground">
          {idea.category === 'custom' && idea.custom_category ? idea.custom_category : category.label}
        </p>
        {idea.notes && <p className="mt-1.5 text-sm leading-relaxed text-pretty">{idea.notes}</p>}
      </div>
    </li>
  )
}

function TransportIcon({ mode }: { mode: SharedDay['segments'][number]['transport_mode'] }) {
  const Icon = TRANSPORT[mode].icon
  return <Icon className="size-3.5" style={{ color: TRANSPORT[mode].color }} />
}

function StopTime({ stop }: { stop: SharedStop }) {
  const time = formatTime(stop.time)
  const hint = stop.time_precision === 'exact' ? '' : PRECISION[stop.time_precision].short
  return (
    <div className="pt-1 text-right text-sm leading-tight tabular-nums">
      {time && <span className="block font-semibold">{time}</span>}
      {hint && <span className="block text-xs text-muted-foreground">{hint === 'pom.' ? 'pomeriggio' : hint}</span>}
    </div>
  )
}

/** Una foto: piena larghezza. Più foto: griglia a due colonne, la prima grande se dispari. */
function PhotoSet({ photos, onOpen }: { photos: SharedPhoto[]; onOpen: (photo: SharedPhoto) => void }) {
  if (photos.length === 1 && photos[0]) {
    const photo = photos[0]
    return (
      <figure className="mt-4">
        <button
          type="button"
          onClick={() => onOpen(photo)}
          className="block w-full overflow-hidden rounded-xl bg-muted"
        >
          <img
            src={photo.display_url}
            alt={photo.caption ?? ''}
            loading="lazy"
            decoding="async"
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            className="h-auto max-h-[70svh] w-full object-cover"
          />
        </button>
        {photo.caption && (
          <figcaption className="mt-2 text-sm text-muted-foreground italic">{photo.caption}</figcaption>
        )}
      </figure>
    )
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-1.5">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(photo)}
          className={cn(
            'overflow-hidden rounded-lg bg-muted',
            i === 0 && photos.length % 2 === 1 ? 'col-span-2 aspect-[3/2]' : 'aspect-square',
          )}
        >
          <img
            src={i === 0 && photos.length % 2 === 1 ? photo.display_url : photo.thumb_url}
            alt={photo.caption ?? ''}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </button>
      ))}
    </div>
  )
}

function ShareLightbox({
  photos,
  index,
  onIndexChange,
}: {
  photos: SharedPhoto[]
  index: number | null
  onIndexChange: (index: number | null) => void
}) {
  const photo = index === null ? undefined : photos[index]
  const touchX = useRef<number | null>(null)
  const go = (delta: number) => index !== null && onIndexChange((index + delta + photos.length) % photos.length)

  return (
    <DialogPrimitive.Root open={photo !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 outline-none sm:p-10"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touchX.current
            const end = e.changedTouches[0]?.clientX
            if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1)
            touchX.current = null
          }}
        >
          {photo && (
            <>
              <DialogPrimitive.Title className="sr-only">{photo.caption || 'Foto'}</DialogPrimitive.Title>
              <img
                key={photo.id}
                src={photo.display_url}
                alt={photo.caption ?? ''}
                className="min-h-0 max-w-full flex-1 object-contain select-none"
                draggable={false}
              />
              {(photo.caption || photo.taken_time) && (
                <p className="mt-3 max-w-xl text-center text-sm text-white/80">
                  {photo.caption}
                  {photo.caption && photo.taken_time && <span className="mx-2 opacity-50">·</span>}
                  {photo.taken_time && <span className="tabular-nums">{formatTime(photo.taken_time)}</span>}
                </p>
              )}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto precedente"
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 sm:block"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Foto successiva"
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 sm:block"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
              <DialogPrimitive.Close className="absolute top-3 right-3 rounded-full bg-white/10 p-2 text-white/85 hover:bg-white/20">
                <XIcon className="size-5" />
                <span className="sr-only">Chiudi</span>
              </DialogPrimitive.Close>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
