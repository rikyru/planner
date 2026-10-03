import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Images, Plus } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { groupPhotos, useTripPhotos } from '@/api/photos'
import { useReorderStops } from '@/api/stops'
import { Button } from '@/components/ui/button'
import { DayHeader } from '@/features/days/DayHeader'
import { PhotoGrid } from '@/features/photos/PhotoGrid'
import { PhotoLightbox } from '@/features/photos/PhotoLightbox'
import { UploadButton } from '@/features/photos/PhotoUploader'
import { SegmentConnector } from '@/features/segments/SegmentConnector'
import { QuickAddBar } from '@/features/stops/QuickAddBar'
import { SortableStopCard } from '@/features/stops/StopCard'
import { StopDrawer } from '@/features/stops/StopDrawer'
import type { Day, Photo, Stop, TripDetail } from '@/types'

export function Timeline({ trip, day }: { trip: TripDetail; day: Day }) {
  const reorder = useReorderStops(trip.id)
  const [editing, setEditing] = useState<Stop | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const photos = useTripPhotos(trip.id)
  const grouped = useMemo(() => groupPhotos(photos.data), [photos.data])
  const dayPhotos = (grouped.byDay.get(day.id) ?? []).filter((p) => !p.stop_id)
  const [viewer, setViewer] = useState<{ list: 'day' | string; index: number } | null>(null)
  const viewerPhotos: Photo[] = !viewer
    ? []
    : viewer.list === 'day'
      ? dayPhotos
      : (grouped.byStop.get(viewer.list) ?? [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Su touch il trascinamento parte dalla maniglia dopo una breve pressione: lo scroll resta libero.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const segmentsByFrom = new Map(day.segments.map((s) => [s.from_stop_id, s]))

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = day.stops.map((s) => s.id)
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    reorder.mutate({ dayId: day.id, stopIds: next }, { onError: (e) => toast.error(`Riordino non salvato: ${e.message}`) })
  }

  function openDrawer(stop: Stop | null) {
    setEditing(stop)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <DayHeader tripId={trip.id} day={day} />
        </div>
        <Button className="hidden shrink-0 sm:inline-flex" onClick={() => openDrawer(null)}>
          <Plus /> Aggiungi tappa
        </Button>
      </div>

      {day.stops.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nessuna tappa in questa giornata. Aggiungine una qui sotto.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={day.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-0">
              {day.stops.map((stop, index) => (
                <Fragment key={stop.id}>
                  <li>
                    <SortableStopCard
                      stop={stop}
                      number={index + 1}
                      onEdit={() => openDrawer(stop)}
                      photos={grouped.byStop.get(stop.id)}
                      onOpenPhoto={(i) => setViewer({ list: stop.id, index: i })}
                    />
                  </li>
                  {index < day.stops.length - 1 && (
                    <li aria-label="Spostamento">
                      <SegmentConnector tripId={trip.id} kind={trip.kind} segment={segmentsByFrom.get(stop.id)} />
                    </li>
                  )}
                </Fragment>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <QuickAddBar trip={trip} day={day} />
      <Button variant="outline" className="w-full sm:hidden" onClick={() => openDrawer(null)}>
        <Plus /> Aggiungi tappa con dettagli
      </Button>

      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium">
            <Images className="size-4 text-muted-foreground" />
            Foto della giornata
            {dayPhotos.length > 0 && <span className="text-sm font-normal text-muted-foreground">{dayPhotos.length}</span>}
          </h2>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to={`/trips/${trip.id}/photos`}>Tutte le foto</Link>
            </Button>
            <UploadButton tripId={trip.id} target={{ dayId: day.id }} size="sm">
              Aggiungi
            </UploadButton>
          </div>
        </div>
        {dayPhotos.length > 0 ? (
          <PhotoGrid photos={dayPhotos} onOpen={(i) => setViewer({ list: 'day', index: i })} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Le foto caricate qui vanno in questa giornata; dal dettaglio di una foto puoi legarla a una tappa.
          </p>
        )}
      </section>

      <StopDrawer trip={trip} day={day} stop={editing} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <PhotoLightbox
        trip={trip}
        photos={viewerPhotos}
        index={viewer?.index ?? null}
        onIndexChange={(index) => setViewer((v) => (v && index !== null ? { ...v, index } : null))}
      />
    </div>
  )
}
