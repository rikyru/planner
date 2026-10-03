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
import { Plus } from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'

import { useReorderStops } from '@/api/stops'
import { Button } from '@/components/ui/button'
import { DayHeader } from '@/features/days/DayHeader'
import { SegmentConnector } from '@/features/segments/SegmentConnector'
import { QuickAddBar } from '@/features/stops/QuickAddBar'
import { SortableStopCard } from '@/features/stops/StopCard'
import { StopDrawer } from '@/features/stops/StopDrawer'
import type { Day, Stop, TripDetail } from '@/types'

export function Timeline({ trip, day }: { trip: TripDetail; day: Day }) {
  const reorder = useReorderStops(trip.id)
  const [editing, setEditing] = useState<Stop | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
                    <SortableStopCard stop={stop} number={index + 1} onEdit={() => openDrawer(stop)} />
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

      <StopDrawer trip={trip} day={day} stop={editing} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
