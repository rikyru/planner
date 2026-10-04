import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router'

import { useTripIdeas } from '@/api/ideas'
import { cn } from '@/lib/utils'
import type { TripDetail } from '@/types'
import { formatDayShort } from '@/utils/dates'

/** Colonna sinistra su desktop, barra orizzontale scorrevole su smartphone. */
export function DayList({ trip, orientation }: { trip: TripDetail; orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical'
  const navRef = useRef<HTMLElement>(null)
  const ideas = useTripIdeas(trip.id)
  // Su smartphone la giornata attiva resta visibile nella barra orizzontale.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  })
  return (
    <nav ref={navRef} aria-label="Giornate" className={cn(vertical ? 'space-y-1' : 'flex gap-2 overflow-x-auto px-4 pb-2')}>
      <NavLink
        to={`/trips/${trip.id}`}
        end
        className={({ isActive }) =>
          cn(
            'flex shrink-0 items-center rounded-lg text-sm font-medium transition-colors',
            vertical ? 'px-3 py-2' : 'border px-3 py-1.5',
            isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )
        }
      >
        Riepilogo
      </NavLink>
      <NavLink
        to={`/trips/${trip.id}/photos`}
        className={({ isActive }) =>
          cn(
            'flex shrink-0 items-center justify-between gap-2 rounded-lg text-sm font-medium transition-colors',
            vertical ? 'px-3 py-2' : 'border px-3 py-1.5',
            isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )
        }
      >
        Foto
        {trip.photo_count > 0 && <span className="text-xs opacity-70 tabular-nums">{trip.photo_count}</span>}
      </NavLink>
      <NavLink
        to={`/trips/${trip.id}/ideas`}
        className={({ isActive }) =>
          cn(
            'flex shrink-0 items-center justify-between gap-2 rounded-lg text-sm font-medium transition-colors',
            vertical ? 'px-3 py-2' : 'border px-3 py-1.5',
            isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )
        }
      >
        Idee
        {!!ideas.data?.length && <span className="text-xs opacity-70 tabular-nums">{ideas.data.length}</span>}
      </NavLink>
      {trip.days.map((day) => {
        const { weekday, date } = formatDayShort(day.date)
        return (
          <NavLink
            key={day.id}
            to={`/trips/${trip.id}/day/${day.day_number}`}
            className={({ isActive }) =>
              cn(
                'group flex shrink-0 items-center gap-3 rounded-lg text-left transition-colors',
                vertical ? 'px-3 py-2' : 'max-w-56 border px-3 py-1.5',
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('w-7 text-center font-serif text-lg font-semibold', !isActive && 'text-primary')}>
                  {day.day_number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{day.title || `${weekday} ${date}`}</span>
                  {vertical && (
                    <span className={cn('block text-xs', isActive ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                      {day.title ? `${weekday} ${date} · ` : ''}
                      {day.stops.length} {day.stops.length === 1 ? 'tappa' : 'tappe'}
                    </span>
                  )}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
