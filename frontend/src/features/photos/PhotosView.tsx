import { CalendarCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { groupPhotos, useAssignByDate, useTripPhotos } from '@/api/photos'
import { Button } from '@/components/ui/button'
import { PhotoGrid } from '@/features/photos/PhotoGrid'
import { PhotoLightbox } from '@/features/photos/PhotoLightbox'
import { UploadButton, UploadDropzone } from '@/features/photos/PhotoUploader'
import { cn } from '@/lib/utils'
import type { Photo, TripDetail } from '@/types'
import { formatDayLong } from '@/utils/dates'

type Filter = 'all' | 'unassigned'

interface Section {
  id: string
  title: string
  subtitle?: string
  photos: Photo[]
  /** Indice della prima foto della sezione nell'elenco piatto del lightbox. */
  start: number
}

/** Tutte le foto del viaggio, raggruppate per giornata, con le foto da assegnare in cima. */
export function PhotosView({ trip }: { trip: TripDetail }) {
  const photos = useTripPhotos(trip.id)
  const assign = useAssignByDate(trip.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const { sections, flat, unassigned } = useMemo(() => {
    const groups = groupPhotos(photos.data)
    const list: Section[] = []
    if (groups.unassigned.length) {
      list.push({
        id: 'unassigned',
        title: 'Da assegnare',
        subtitle: 'Apri una foto per scegliere giorno e tappa.',
        photos: groups.unassigned,
        start: 0,
      })
    }
    if (filter === 'all') {
      for (const day of trip.days) {
        const dayPhotos = groups.byDay.get(day.id)
        if (dayPhotos?.length) {
          list.push({
            id: day.id,
            title: `Giorno ${day.day_number} · ${day.title || formatDayLong(day.date)}`,
            subtitle: day.title ? formatDayLong(day.date) : undefined,
            photos: dayPhotos,
            start: list.reduce((n, sec) => n + sec.photos.length, 0),
          })
        }
      }
    }
    return {
      sections: list,
      flat: list.flatMap((s) => s.photos),
      unassigned: groups.unassigned,
    }
  }, [photos.data, trip.days, filter])

  const datable = unassigned.filter((p) => p.taken_at).length
  const total = photos.data?.length ?? 0

  if (photos.isPending) return <p className="text-muted-foreground">Caricamento foto…</p>
  if (photos.isError) return <p className="text-destructive">{photos.error.message}</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Foto</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'Nessuna foto ancora' : `${total} foto nel viaggio`}
          </p>
        </div>
        {total > 0 && <UploadButton tripId={trip.id} />}
      </header>

      {total === 0 ? (
        <UploadDropzone tripId={trip.id} className="py-12" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
              Tutte · {total}
            </FilterChip>
            <FilterChip
              active={filter === 'unassigned'}
              onClick={() => setFilter('unassigned')}
              disabled={unassigned.length === 0}
            >
              Da assegnare · {unassigned.length}
            </FilterChip>
            {datable > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={assign.isPending}
                title="Le foto senza giorno vanno nella giornata della loro data di scatto"
                onClick={() =>
                  assign.mutate(undefined, {
                    onSuccess: ({ assigned }) =>
                      toast.success(
                        assigned
                          ? `${assigned} foto assegnate alla loro giornata`
                          : 'Nessuna data di scatto rientra nelle date del viaggio',
                      ),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                <CalendarCheck /> Assegna per data di scatto
              </Button>
            )}
          </div>

          {sections.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Tutte le foto sono assegnate a una giornata.
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className={cn('font-medium', section.id === 'unassigned' && 'text-terracotta')}>
                    {section.title}
                  </h2>
                  {section.subtitle && <p className="text-xs text-muted-foreground">{section.subtitle}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{section.photos.length}</span>
              </div>
              <PhotoGrid photos={section.photos} onOpen={(i) => setLightbox(section.start + i)} />
            </section>
          ))}
        </>
      )}

      <PhotoLightbox trip={trip} photos={flat} index={lightbox} onIndexChange={setLightbox} />
    </div>
  )
}

function FilterChip({
  active,
  children,
  ...props
}: {
  active: boolean
  children: React.ReactNode
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
      {...props}
    >
      {children}
    </button>
  )
}
