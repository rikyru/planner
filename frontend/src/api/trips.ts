import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Day, DayUpdate, TripCreate, TripDetail, TripSummary, TripUpdate } from '@/types'

export const tripKeys = {
  all: ['trips'] as const,
  detail: (id: string) => ['trip', id] as const,
}

export function useTrips() {
  return useQuery({ queryKey: tripKeys.all, queryFn: () => api<TripSummary[]>('GET', '/trips') })
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: tripKeys.detail(id ?? ''),
    queryFn: () => api<TripDetail>('GET', `/trips/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TripCreate) => api<TripDetail>('POST', '/trips', body),
    onSuccess: (trip) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip)
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

export function useUpdateTrip(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, confirmDeleteDays }: { body: TripUpdate; confirmDeleteDays?: boolean }) =>
      api<TripDetail>('PATCH', `/trips/${id}${confirmDeleteDays ? '?confirm_delete_days=true' : ''}`, body),
    onSuccess: (trip) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip)
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/trips/${id}`),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: tripKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

/** Sostituisce uno o più giorni nella cache del viaggio (le API delle tappe restituiscono il giorno). */
export function replaceDays(qc: QueryClient, tripId: string, days: Day[]): void {
  qc.setQueryData<TripDetail>(tripKeys.detail(tripId), (trip) => {
    if (!trip) return trip
    const byId = new Map(days.map((d) => [d.id, d]))
    const nextDays = trip.days.map((d) => byId.get(d.id) ?? d)
    return {
      ...trip,
      days: nextDays,
      stop_count: nextDays.reduce((n, d) => n + d.stops.length, 0),
    }
  })
}

export function useUpdateDay(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dayId, body }: { dayId: string; body: DayUpdate }) =>
      api<Day>('PATCH', `/days/${dayId}`, body),
    onSuccess: (day) => replaceDays(qc, tripId, [day]),
  })
}
