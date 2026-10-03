import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { replaceDays, tripKeys } from '@/api/trips'
import type { Day, Segment, SegmentUpdate, Stop, StopCreate, StopUpdate, TripDetail } from '@/types'

export function useCreateStop(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dayId, body }: { dayId: string; body: StopCreate }) =>
      api<Day>('POST', `/days/${dayId}/stops`, body),
    onSuccess: (day) => {
      replaceDays(qc, tripId, [day])
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

function patchStop(trip: TripDetail, stop: Stop): TripDetail {
  return {
    ...trip,
    days: trip.days.map((d) =>
      d.id === stop.day_id ? { ...d, stops: d.stops.map((s) => (s.id === stop.id ? stop : s)) } : d,
    ),
  }
}

export function useUpdateStop(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stopId, body }: { stopId: string; body: StopUpdate }) =>
      api<Stop>('PATCH', `/stops/${stopId}`, body),
    onSuccess: (stop) => {
      qc.setQueryData<TripDetail>(tripKeys.detail(tripId), (t) => (t ? patchStop(t, stop) : t))
    },
  })
}

export function useDeleteStop(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stopId: string) => api<Day>('DELETE', `/stops/${stopId}`),
    onSuccess: (day) => {
      replaceDays(qc, tripId, [day])
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

/** Riordino ottimistico: la UI cambia subito, il server riallinea i segmenti. */
export function useReorderStops(tripId: string) {
  const qc = useQueryClient()
  const key = tripKeys.detail(tripId)
  return useMutation({
    mutationFn: ({ dayId, stopIds }: { dayId: string; stopIds: string[] }) =>
      api<Day>('POST', `/days/${dayId}/reorder-stops`, { stop_ids: stopIds }),
    onMutate: async ({ dayId, stopIds }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<TripDetail>(key)
      qc.setQueryData<TripDetail>(key, (trip) => {
        if (!trip) return trip
        return {
          ...trip,
          days: trip.days.map((d) => {
            if (d.id !== dayId) return d
            const byId = new Map(d.stops.map((s) => [s.id, s]))
            const stops = stopIds
              .map((id, position) => {
                const s = byId.get(id)
                return s ? { ...s, position } : null
              })
              .filter((s): s is Stop => s !== null)
            // I segmenti verranno sostituiti dalla risposta del server.
            return { ...d, stops, segments: [] }
          }),
        }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSuccess: (day) => replaceDays(qc, tripId, [day]),
  })
}

export function useMoveStop(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stopId, dayId, position }: { stopId: string; dayId: string; position?: number }) =>
      api<Day[]>('POST', `/stops/${stopId}/move`, { day_id: dayId, position }),
    onSuccess: (days) => replaceDays(qc, tripId, days),
  })
}

export function useUpdateSegment(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ segmentId, body }: { segmentId: string; body: SegmentUpdate }) =>
      api<Segment>('PATCH', `/segments/${segmentId}`, body),
    onSuccess: (segment) => {
      qc.setQueryData<TripDetail>(tripKeys.detail(tripId), (trip) =>
        trip
          ? {
              ...trip,
              days: trip.days.map((d) =>
                d.id === segment.day_id
                  ? { ...d, segments: d.segments.map((s) => (s.id === segment.id ? segment : s)) }
                  : d,
              ),
            }
          : trip,
      )
    },
  })
}
