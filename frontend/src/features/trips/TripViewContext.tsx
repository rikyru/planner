import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import type { TripDetail } from '@/types'

/** Stato condiviso tra timeline e mappa: tappa selezionata e tappa sotto il puntatore. */
interface TripView {
  trip: TripDetail
  selectedStopId: string | null
  setSelectedStopId: (id: string | null) => void
  hoveredStopId: string | null
  setHoveredStopId: (id: string | null) => void
}

const Ctx = createContext<TripView | null>(null)

export function TripViewProvider({ trip, children }: { trip: TripDetail; children: ReactNode }) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null)
  const value = useMemo(
    () => ({ trip, selectedStopId, setSelectedStopId, hoveredStopId, setHoveredStopId }),
    [trip, selectedStopId, hoveredStopId],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTripView(): TripView {
  const value = useContext(Ctx)
  if (!value) throw new Error('useTripView fuori da TripViewProvider')
  return value
}
