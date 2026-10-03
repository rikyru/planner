import type { Stop, TimePrecision, TripKind } from '@/types'
import { formatDuration, formatTime } from '@/utils/dates'
import { PRECISION } from '@/utils/labels'

export type Side = 'planned' | 'actual'

export function primarySide(kind: TripKind): Side {
  return kind === 'reconstruct' ? 'actual' : 'planned'
}

interface SideValues {
  arrival: string | null
  departure: string | null
  duration: number | null
  precision: TimePrecision
}

export function sideValues(stop: Stop, side: Side): SideValues {
  return side === 'planned'
    ? {
        arrival: stop.planned_arrival ?? null,
        departure: stop.planned_departure ?? null,
        duration: stop.planned_duration_min ?? null,
        precision: stop.planned_time_precision,
      }
    : {
        arrival: stop.actual_arrival ?? null,
        departure: stop.actual_departure ?? null,
        duration: stop.actual_duration_min ?? null,
        precision: stop.actual_time_precision,
      }
}

function hasInfo(v: SideValues): boolean {
  return v.arrival !== null || v.duration !== null || v.precision !== 'unknown'
}

/** Orario da mostrare in timeline: il lato principale del viaggio, altrimenti l'altro. */
export function displayTime(stop: Stop, kind: TripKind): { time: string | null; hint: string | null; duration: string | null; side: Side } {
  const first = primarySide(kind)
  const second: Side = first === 'planned' ? 'actual' : 'planned'
  const values = hasInfo(sideValues(stop, first)) ? sideValues(stop, first) : sideValues(stop, second)
  const side = hasInfo(sideValues(stop, first)) ? first : second
  const time = formatTime(values.arrival)
  const hint = PRECISION[values.precision].short || null
  return { time, hint: time && values.precision === 'exact' ? null : hint, duration: formatDuration(values.duration), side }
}
