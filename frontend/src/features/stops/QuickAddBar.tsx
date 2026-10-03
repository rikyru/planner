import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useCreateStop } from '@/api/stops'
import { PlaceSearch, type Place } from '@/features/geocoding/PlaceSearch'
import { primarySide } from '@/features/stops/stopTime'
import { cn } from '@/lib/utils'
import type { Day, StopCreate, TimePrecision, TripDetail } from '@/types'
import { PRECISION } from '@/utils/labels'

const PERIODS: (TimePrecision | null)[] = [null, 'morning', 'afternoon', 'evening']

/** Aggiunta rapida da tastiera: scrivi, Invio, la tappa è creata e il campo resta pronto.
 * Il periodo scelto (mattina/pomeriggio/sera) resta attivo per le tappe successive. */
export function QuickAddBar({ trip, day }: { trip: TripDetail; day: Day }) {
  const create = useCreateStop(trip.id)
  const [period, setPeriod] = useState<TimePrecision | null>(null)
  const side = primarySide(trip.kind)

  function add(body: StopCreate) {
    if (period) body[`${side}_time_precision`] = period
    create.mutate({ dayId: day.id, body }, { onError: (e) => toast.error(e.message) })
  }

  function fromPlace(place: Place) {
    add({
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      address: place.address,
      external_ref: place.external_ref,
      category: place.category ?? 'attraction',
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed bg-muted/40 p-3">
      <PlaceSearch
        trip={trip}
        clearOnSelect
        placeholder="Aggiungi una tappa: cerca un luogo o scrivi un nome e premi Invio"
        leading={<Plus className="size-4" />}
        inputClassName="bg-background"
        onSelect={fromPlace}
        onSubmitText={(name) => add({ name })}
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Momento:</span>
        {PERIODS.map((p) => (
          <button
            key={p ?? 'none'}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={cn(
              'rounded-full border px-2.5 py-0.5 transition-colors',
              period === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            )}
          >
            {p ? PRECISION[p].label : 'Nessuno'}
          </button>
        ))}
      </div>
    </div>
  )
}
