import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { components } from '@/types/api.gen'

export type GeocodedPlace = components['schemas']['PlaceOut']

/** `deep`: ricerca esplicita su un geocoder più completo ma più lento (nomi in altre lingue). */
export function useGeocode(query: string, bias: { lat: number; lon: number } | null, deep = false) {
  const q = query.trim()
  return useQuery({
    queryKey: ['geocode', deep, q.toLowerCase(), bias?.lat.toFixed(1), bias?.lon.toFixed(1)],
    queryFn: () => {
      const params = new URLSearchParams({ q, limit: '6' })
      if (deep) params.set('deep', 'true')
      if (bias) {
        params.set('lat', String(bias.lat))
        params.set('lon', String(bias.lon))
      }
      return api<GeocodedPlace[]>('GET', `/geocode/search?${params.toString()}`)
    },
    enabled: q.length >= 2,
    staleTime: 10 * 60_000,
    placeholderData: deep ? undefined : keepPreviousData,
    retry: false,
  })
}
