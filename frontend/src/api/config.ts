import { useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'

export interface PublicConfig {
  map_style_url: string
  map_attribution: string
  geocoder: string
  version: string
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api<PublicConfig>('GET', '/config'),
    staleTime: Infinity,
  })
}
