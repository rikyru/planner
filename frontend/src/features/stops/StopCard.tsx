import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MapPinOff, Pencil } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { PhotoStrip } from '@/features/photos/PhotoGrid'
import { useTripView } from '@/features/trips/TripViewContext'
import { displayTime } from '@/features/stops/stopTime'
import { cn } from '@/lib/utils'
import type { Photo, Stop } from '@/types'
import { CATEGORIES } from '@/utils/labels'

interface Props {
  stop: Stop
  number: number
  onEdit: () => void
  photos?: Photo[]
  onOpenPhoto?: (index: number) => void
}

export function SortableStopCard(props: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.stop.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-90')}
    >
      <StopCard
        {...props}
        dragging={isDragging}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Trascina ${props.stop.name}`}
            className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}

export function StopCard({
  stop,
  number,
  onEdit,
  photos,
  onOpenPhoto,
  handle,
  dragging,
}: Props & { handle?: React.ReactNode; dragging?: boolean }) {
  const { trip, selectedStopId, setSelectedStopId, hoveredStopId, setHoveredStopId } = useTripView()
  const selected = selectedStopId === stop.id
  const hovered = hoveredStopId === stop.id
  const category = CATEGORIES[stop.category]
  const Icon = category.icon
  const { time, hint, duration } = displayTime(stop, trip.kind)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  return (
    <div
      ref={ref}
      className="flex items-start gap-1"
      onMouseEnter={() => setHoveredStopId(stop.id)}
      onMouseLeave={() => setHoveredStopId(null)}
    >
      <div className="w-12 shrink-0 pt-2.5 text-right text-sm tabular-nums" title={hint ?? undefined}>
        {time ? <span className="font-semibold">{time}</span> : null}
        {hint && <span className={cn('block text-[11px] leading-tight text-muted-foreground', !time && 'pt-0.5')}>{hint}</span>}
      </div>
      {handle ?? <div className="w-6 shrink-0" />}
      <div
        onClick={() => setSelectedStopId(selected ? null : stop.id)}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition-all',
          (selected || hovered) && 'border-primary/60',
          selected && 'ring-2 ring-primary/25',
          dragging && 'shadow-lg',
        )}
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: category.color }}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate leading-7 font-medium">
              <button type="button" className="max-w-full truncate text-left outline-none focus-visible:underline" aria-pressed={selected}>
                {stop.name}
              </button>
            </h3>
            <button
              type="button"
              aria-label={`Modifica ${stop.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="-mt-0.5 -mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon className="size-3.5" style={{ color: category.color }} />
              {stop.category === 'custom' && stop.custom_category ? stop.custom_category : category.label}
            </span>
            {duration && <span>· {duration}</span>}
            {stop.lat == null && (
              <span className="inline-flex items-center gap-1 text-terracotta">
                <MapPinOff className="size-3" /> senza posizione
              </span>
            )}
          </div>
          {stop.notes && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{stop.notes}</p>}
          {photos && photos.length > 0 && onOpenPhoto && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <PhotoStrip photos={photos} onOpen={onOpenPhoto} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
