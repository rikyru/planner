import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { tripKeys } from '@/api/trips'
import type { ShareInfo, SharedTrip } from '@/types'

const shareKey = (tripId: string) => ['share', tripId] as const

export function useShareInfo(tripId: string | undefined) {
  return useQuery({
    queryKey: shareKey(tripId ?? ''),
    queryFn: () => api<ShareInfo>('GET', `/trips/${tripId}/share`),
    enabled: Boolean(tripId),
  })
}

type ShareAction = 'enable' | 'rotate' | 'disable'

const REQUESTS: Record<ShareAction, (id: string) => Promise<ShareInfo>> = {
  enable: (id) => api<ShareInfo>('POST', `/trips/${id}/share`),
  rotate: (id) => api<ShareInfo>('POST', `/trips/${id}/share/rotate`),
  disable: (id) => api<ShareInfo>('DELETE', `/trips/${id}/share`),
}

export function useShareAction(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: ShareAction) => REQUESTS[action](tripId),
    onSuccess: (info) => {
      qc.setQueryData(shareKey(tripId), info)
      void qc.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      void qc.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

export function shareUrl(info: ShareInfo): string | null {
  if (!info.path) return null
  return info.url ?? `${window.location.origin}${info.path}`
}

/** Pagina pubblica: nessuna autenticazione, solo il token. */
export function useSharedTrip(token: string | undefined) {
  return useQuery({
    queryKey: ['shared', token],
    queryFn: () => api<SharedTrip>('GET', `/share/${token}`),
    enabled: Boolean(token),
    retry: false,
  })
}
