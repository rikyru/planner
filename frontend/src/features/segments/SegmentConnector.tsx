import { useState } from 'react'
import { toast } from 'sonner'

import { useUpdateSegment } from '@/api/stops'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Segment, TripKind } from '@/types'
import { formatDuration } from '@/utils/dates'
import { TRANSPORT, TRANSPORT_ORDER } from '@/utils/labels'

function formatDistance(m: number | null | undefined): string | null {
  if (m == null) return null
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`
}

/** Lo spostamento tra due tappe: "🚶 A piedi · 18 min". Un tocco apre la modifica in linea. */
export function SegmentConnector({ tripId, kind, segment }: { tripId: string; kind: TripKind; segment: Segment | undefined }) {
  const [open, setOpen] = useState(false)
  const update = useUpdateSegment(tripId)

  if (!segment) {
    return <div className="ml-[4.25rem] h-6 border-l-2 border-dotted border-border" aria-hidden />
  }

  const mode = TRANSPORT[segment.transport_mode]
  const Icon = mode.icon
  const durationKey = kind === 'reconstruct' ? 'actual_duration_min' : 'planned_duration_min'
  const duration = segment[durationKey] ?? segment.planned_duration_min ?? segment.actual_duration_min
  const details = [formatDuration(duration), formatDistance(segment.distance_m)].filter(Boolean).join(' · ')

  function save(body: Parameters<typeof update.mutate>[0]['body']) {
    update.mutate({ segmentId: segment!.id, body }, { onError: (e) => toast.error(e.message) })
  }

  return (
    <div className="relative ml-[4.25rem] border-l-2 border-dashed py-1 pl-4" style={{ borderColor: `${mode.color}66` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-muted',
          segment.transport_mode === 'unknown' ? 'text-muted-foreground' : 'font-medium',
        )}
      >
        <Icon className="size-3.5" style={{ color: mode.color }} />
        {segment.transport_mode === 'unknown' ? 'Come ti sposti?' : mode.label}
        {details && <span className="font-normal text-muted-foreground">· {details}</span>}
      </button>

      {open && (
        <div className="my-2 space-y-3 rounded-lg border bg-card p-3 shadow-xs">
          <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Mezzo di trasporto">
            {TRANSPORT_ORDER.map((m) => {
              const t = TRANSPORT[m]
              const MIcon = t.icon
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={segment.transport_mode === m}
                  onClick={() => save({ transport_mode: m })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] transition-colors',
                    segment.transport_mode === m ? 'border-primary bg-accent' : 'hover:bg-muted',
                  )}
                >
                  <MIcon className="size-4" style={{ color: t.color }} />
                  {t.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Durata (min)
              <Input
                key={`d-${segment.id}-${duration ?? ''}`}
                type="number"
                min={0}
                inputMode="numeric"
                className="h-8 w-24"
                defaultValue={duration ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v !== duration) save({ [durationKey]: v })
                }}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Distanza (km)
              <Input
                key={`k-${segment.id}-${segment.distance_m ?? ''}`}
                type="number"
                min={0}
                step={0.1}
                inputMode="decimal"
                className="h-8 w-24"
                defaultValue={segment.distance_m != null ? segment.distance_m / 1000 : ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Math.round(Number(e.target.value.replace(',', '.')) * 1000)
                  if (v !== segment.distance_m) save({ distance_m: v })
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
