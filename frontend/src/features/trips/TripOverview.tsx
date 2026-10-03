import { Link } from 'react-router'

import { DAY_COLORS } from '@/features/map/mapData'
import type { TripDetail } from '@/types'
import { formatDateRange, formatDayLong } from '@/utils/dates'
import { CATEGORIES } from '@/utils/labels'

/** Vista complessiva del viaggio: una riga per giornata con le sue tappe. */
export function TripOverview({ trip }: { trip: TripDetail }) {
  const located = trip.days.flatMap((d) => d.stops).filter((s) => s.lat != null).length
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {trip.kind === 'reconstruct' ? 'Ricordo di viaggio' : 'Viaggio pianificato'}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{trip.title}</h1>
        <p className="mt-1 text-muted-foreground">{formatDateRange(trip.start_date, trip.end_date)}</p>
        {trip.description && <p className="mt-3 max-w-prose">{trip.description}</p>}
        <dl className="mt-4 flex gap-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Giornate</dt>
            <dd className="font-serif text-2xl font-semibold">{trip.day_count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tappe</dt>
            <dd className="font-serif text-2xl font-semibold">{trip.stop_count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sulla mappa</dt>
            <dd className="font-serif text-2xl font-semibold">{located}</dd>
          </div>
        </dl>
      </header>

      <ol className="space-y-3">
        {trip.days.map((day) => (
          <li key={day.id}>
            <Link
              to={`/trips/${trip.id}/day/${day.day_number}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="font-serif text-2xl font-semibold"
                  style={{ color: DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length] }}
                >
                  {day.day_number}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{day.title || formatDayLong(day.date)}</p>
                  {day.title && <p className="text-xs text-muted-foreground">{formatDayLong(day.date)}</p>}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {day.stops.length} {day.stops.length === 1 ? 'tappa' : 'tappe'}
                </span>
              </div>
              {day.stops.length > 0 && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {day.stops.map((s, i) => {
                    const Icon = CATEGORIES[s.category].icon
                    return (
                      <span key={s.id}>
                        {i > 0 && ' → '}
                        <Icon className="mr-0.5 inline size-3 align-[-1px]" style={{ color: CATEGORIES[s.category].color }} />
                        {s.name}
                      </span>
                    )
                  })}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
