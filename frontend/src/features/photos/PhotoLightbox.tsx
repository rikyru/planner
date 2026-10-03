import { ChevronLeft, ChevronRight, Download, ImageUp, MapPin, Star, Trash, XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useDeletePhoto, useUpdatePhoto } from '@/api/photos'
import { useUpdateTrip } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Photo, TripDetail } from '@/types'
import { formatDayLong } from '@/utils/dates'

interface Props {
  trip: TripDetail
  photos: Photo[]
  index: number | null
  onIndexChange: (index: number | null) => void
}

/** Foto a tutto schermo con pannello di associazione. L'elenco può cambiare mentre è aperta
 * (es. filtro "da assegnare"): l'indice resta e mostra la foto successiva. */
export function PhotoLightbox({ trip, photos, index, onIndexChange }: Props) {
  const current = index === null ? undefined : photos[Math.min(index, photos.length - 1)]
  const open = index !== null && current !== undefined
  const position = index === null ? 0 : Math.min(index, photos.length - 1)

  // Se l'elenco cambia (foto spostata in un altro giorno) si resta sulla stessa foto; se è
  // uscita dall'elenco (filtro "da assegnare") si passa a quella che ne ha preso il posto.
  const shownId = useRef<string | null>(null)
  const lastIndex = useRef<number | null>(null)
  useEffect(() => {
    if (index === null) {
      shownId.current = lastIndex.current = null
      return
    }
    if (photos.length === 0) {
      onIndexChange(null)
      return
    }
    if (index === lastIndex.current && shownId.current) {
      const moved = photos.findIndex((p) => p.id === shownId.current)
      if (moved >= 0 && moved !== index) {
        lastIndex.current = moved
        onIndexChange(moved)
        return
      }
    }
    const clamped = Math.min(index, photos.length - 1)
    if (clamped !== index) onIndexChange(clamped)
    lastIndex.current = clamped
    shownId.current = photos[clamped]?.id ?? null
  }, [index, photos, onIndexChange])

  const go = (delta: number) => {
    if (photos.length === 0) return
    onIndexChange((position + delta + photos.length) % photos.length)
  }

  const touchX = useRef<number | null>(null)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none lg:flex-row"
          onKeyDown={(e) => {
            if ((e.target as HTMLElement).closest('textarea, select, input')) return
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
          aria-describedby={undefined}
        >
          {current && (
            <>
              <DialogPrimitive.Title className="sr-only">
                {current.caption || current.original_filename}
              </DialogPrimitive.Title>
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center p-2 lg:p-8"
                onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
                onTouchEnd={(e) => {
                  const start = touchX.current
                  const end = e.changedTouches[0]?.clientX
                  if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1)
                  touchX.current = null
                }}
              >
                <img
                  key={current.id}
                  src={current.display_url}
                  alt={current.caption ?? ''}
                  className="max-h-full max-w-full object-contain select-none"
                  draggable={false}
                />
                {photos.length > 1 && (
                  <>
                    <NavButton side="left" onClick={() => go(-1)} />
                    <NavButton side="right" onClick={() => go(1)} />
                  </>
                )}
                <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white/85 tabular-nums">
                  {position + 1} / {photos.length}
                </span>
                <DialogPrimitive.Close className="absolute top-2 right-2 rounded-full bg-black/50 p-2 text-white/85 hover:text-white lg:hidden">
                  <XIcon className="size-5" />
                  <span className="sr-only">Chiudi</span>
                </DialogPrimitive.Close>
              </div>
              <PhotoPanel key={current.id} trip={trip} photo={current} />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Foto precedente' : 'Foto successiva'}
      className={cn(
        'absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 hover:bg-black/60 hover:text-white sm:block',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-6" />
    </button>
  )
}

function formatSize(bytes: number): string {
  return bytes < 1_048_576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`
}

function formatTaken(photo: Photo): string | null {
  if (!photo.taken_at) return null
  return `${formatDayLong(photo.taken_at.slice(0, 10))}, ${photo.taken_at.slice(11, 16)}`
}

function PhotoPanel({ trip, photo }: { trip: TripDetail; photo: Photo }) {
  const update = useUpdatePhoto(trip.id)
  const remove = useDeletePhoto(trip.id)
  const updateTrip = useUpdateTrip(trip.id)
  const [caption, setCaption] = useState(photo.caption ?? '')
  const day = trip.days.find((d) => d.id === photo.day_id)
  const isCover = trip.cover_photo_id === photo.id
  const taken = formatTaken(photo)

  function save(body: Parameters<typeof update.mutate>[0]['body']) {
    update.mutate({ id: photo.id, body }, { onError: (e) => toast.error(e.message) })
  }

  return (
    <aside className="max-h-[45dvh] shrink-0 space-y-4 overflow-y-auto bg-background p-4 lg:max-h-none lg:w-80 lg:p-5">
      <div className="hidden justify-end lg:flex">
        <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
          <span className="sr-only">Chiudi</span>
        </DialogPrimitive.Close>
      </div>
      <div className="space-y-0.5 text-sm">
        <p className="font-medium">{taken ?? 'Data di scatto sconosciuta'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {photo.original_filename}
          {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ''}
          {` · ${formatSize(photo.size_bytes)}`}
        </p>
        {photo.lat != null && photo.lon != null && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {photo.lat.toFixed(4)}, {photo.lon.toFixed(4)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo-day">Giorno</Label>
        <NativeSelect
          id="photo-day"
          value={photo.day_id ?? ''}
          onChange={(e) => save({ day_id: e.target.value || null })}
        >
          <option value="">Da assegnare</option>
          {trip.days.map((d) => (
            <option key={d.id} value={d.id}>
              Giorno {d.day_number} · {d.title || formatDayLong(d.date)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {day && (
        <div className="space-y-2">
          <Label htmlFor="photo-stop">Tappa</Label>
          <NativeSelect
            id="photo-stop"
            value={photo.stop_id ?? ''}
            onChange={(e) => save(e.target.value ? { stop_id: e.target.value } : { stop_id: null })}
          >
            <option value="">Nessuna tappa (foto della giornata)</option>
            {day.stops.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="photo-caption">Didascalia</Label>
        <Textarea
          id="photo-caption"
          rows={2}
          value={caption}
          placeholder="Facoltativa, visibile nella pagina condivisa"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption.trim() !== (photo.caption ?? '')) save({ caption: caption.trim() || null })
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant={isCover ? 'secondary' : 'outline'}
          size="sm"
          disabled={updateTrip.isPending}
          onClick={() =>
            updateTrip.mutate(
              { body: { cover_photo_id: isCover ? null : photo.id } },
              {
                onSuccess: () => toast.success(isCover ? 'Copertina rimossa' : 'Copertina aggiornata'),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          {isCover ? <Star className="fill-current" /> : <ImageUp />}
          {isCover ? 'Copertina' : 'Usa come copertina'}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={photo.original_url} target="_blank" rel="noreferrer">
            <Download /> Originale
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={remove.isPending}
          onClick={() => {
            if (!window.confirm('Eliminare questa foto? Il file originale verrà cancellato.')) return
            remove.mutate(photo.id, { onError: (e) => toast.error(e.message) })
          }}
        >
          <Trash /> Elimina
        </Button>
      </div>
    </aside>
  )
}
