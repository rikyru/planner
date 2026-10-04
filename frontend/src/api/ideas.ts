import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { replaceDays, tripKeys } from '@/api/trips'
import type { Day, Idea, IdeaCreate, IdeaUpdate } from '@/types'

export const ideaKeys = {
  list: (tripId: string) => ['ideas', tripId] as const,
}

export function useTripIdeas(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ideaKeys.list(tripId),
    queryFn: () => api<Idea[]>('GET', `/trips/${tripId}/ideas`),
    enabled,
  })
}

export function useCreateIdea(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: IdeaCreate) => api<Idea>('POST', `/trips/${tripId}/ideas`, body),
    onSuccess: (idea) => qc.setQueryData<Idea[]>(ideaKeys.list(tripId), (list) => [...(list ?? []), idea]),
  })
}

export function useUpdateIdea(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: IdeaUpdate }) => api<Idea>('PATCH', `/ideas/${id}`, body),
    onSuccess: (idea) =>
      qc.setQueryData<Idea[]>(ideaKeys.list(tripId), (list) => list?.map((i) => (i.id === idea.id ? idea : i))),
  })
}

export function useDeleteIdea(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/ideas/${id}`),
    onSuccess: (_, id) => qc.setQueryData<Idea[]>(ideaKeys.list(tripId), (list) => list?.filter((i) => i.id !== id)),
  })
}

/** Idea → tappa in coda al giorno scelto. */
export function useScheduleIdea(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dayId }: { id: string; dayId: string }) =>
      api<Day>('POST', `/ideas/${id}/schedule`, { day_id: dayId }),
    onSuccess: (day, { id }) => {
      replaceDays(qc, tripId, [day])
      qc.setQueryData<Idea[]>(ideaKeys.list(tripId), (list) => list?.filter((i) => i.id !== id))
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

/** Tappa → idea: esce dal giorno e perde orari e segmenti. */
export function useStopToIdea(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stopId: string) => api<{ day: Day; idea: Idea }>('POST', `/stops/${stopId}/to-idea`),
    onSuccess: ({ day, idea }) => {
      replaceDays(qc, tripId, [day])
      qc.setQueryData<Idea[]>(ideaKeys.list(tripId), (list) => (list ? [...list, idea] : list))
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}
