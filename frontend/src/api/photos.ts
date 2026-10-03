import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '@/api/client'
import { tripKeys } from '@/api/trips'
import type { Photo, PhotoUpdate, PhotoUploadResult } from '@/types'

export const photoKeys = {
  list: (tripId: string) => ['photos', tripId] as const,
}

export function useTripPhotos(tripId: string) {
  return useQuery({
    queryKey: photoKeys.list(tripId),
    queryFn: () => api<Photo[]>('GET', `/trips/${tripId}/photos`),
  })
}

/** Dopo ogni modifica alle foto cambiano anche conteggi e copertina del viaggio. */
function refreshTrip(qc: QueryClient, tripId: string): void {
  void qc.invalidateQueries({ queryKey: photoKeys.list(tripId) })
  void qc.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
  void qc.invalidateQueries({ queryKey: tripKeys.all })
}

// Piccoli lotti: avanzamento visibile e richieste lontane dal limite di nginx.
const BATCH_SIZE = 4

export interface UploadTarget {
  dayId?: string | null
  stopId?: string | null
}

export function useUploadPhotos(tripId: string) {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ files, target }: { files: File[]; target?: UploadTarget }) => {
      const result: PhotoUploadResult = {
        created: [],
        duplicates: [],
        errors: [],
      }
      setProgress({ done: 0, total: files.length })
      try {
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE)
          const form = new FormData()
          for (const file of batch) form.append('files', file, file.name)
          if (target?.stopId) form.append('stop_id', target.stopId)
          else if (target?.dayId) form.append('day_id', target.dayId)
          try {
            const part = await api<PhotoUploadResult>('POST', `/trips/${tripId}/photos`, form)
            result.created.push(...part.created)
            result.duplicates.push(...part.duplicates)
            result.errors.push(...part.errors)
          } catch (error) {
            // Un lotto fallito (rete, file enorme) non ferma i successivi.
            const message = error instanceof Error ? error.message : 'Errore di caricamento'
            for (const file of batch)
              result.errors.push({
                filename: file.name,
                code: 'request_failed',
                message,
              })
          }
          setProgress({
            done: Math.min(i + BATCH_SIZE, files.length),
            total: files.length,
          })
        }
      } finally {
        setProgress(null)
      }
      return result
    },
    onSettled: () => refreshTrip(qc, tripId),
  })
  return { ...mutation, progress }
}

export function useUpdatePhoto(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PhotoUpdate }) => api<Photo>('PATCH', `/photos/${id}`, body),
    onSuccess: (photo) => {
      qc.setQueryData<Photo[]>(photoKeys.list(tripId), (list) => list?.map((p) => (p.id === photo.id ? photo : p)))
    },
  })
}

export function useDeletePhoto(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/photos/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData<Photo[]>(photoKeys.list(tripId), (list) => list?.filter((p) => p.id !== id))
      refreshTrip(qc, tripId)
    },
  })
}

export function useAssignByDate(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ assigned: number }>('POST', `/trips/${tripId}/photos/assign-by-date`),
    onSuccess: () => refreshTrip(qc, tripId),
  })
}

/** Foto raggruppate per tappa e per giorno (quelle senza tappa) per la timeline. */
export function groupPhotos(photos: Photo[] | undefined) {
  const byStop = new Map<string, Photo[]>()
  const byDay = new Map<string, Photo[]>()
  const unassigned: Photo[] = []
  for (const photo of photos ?? []) {
    if (photo.stop_id) push(byStop, photo.stop_id, photo)
    if (photo.day_id) push(byDay, photo.day_id, photo)
    else unassigned.push(photo)
  }
  return { byStop, byDay, unassigned }
}

function push(map: Map<string, Photo[]>, key: string, photo: Photo) {
  const list = map.get(key)
  if (list) list.push(photo)
  else map.set(key, [photo])
}
