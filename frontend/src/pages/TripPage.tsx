import { ArrowLeft, List, Map as MapIcon, Pencil, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { useTripIdeas } from '@/api/ideas'
import { useTrip } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { DayList } from '@/features/days/DayList'
import { IdeasView } from '@/features/ideas/IdeasView'
import { EMPTY_LINES, dayLines, dayPoints, ideaPoints, overviewLines, overviewPoints } from '@/features/map/mapData'
import { TripMap } from '@/features/map/TripMap'
import { PhotosView } from '@/features/photos/PhotosView'
import { ShareDialog } from '@/features/share/ShareDialog'
import { Timeline } from '@/features/stops/Timeline'
import { EditTripDialog } from '@/features/trips/EditTripDialog'
import { TripOverview } from '@/features/trips/TripOverview'
import { TripViewProvider, useTripView } from '@/features/trips/TripViewContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import type { Day, TripDetail } from '@/types'
import { formatDateRange } from '@/utils/dates'

export type TripPageView = 'photos' | 'ideas'

export function TripPage({ view }: { view?: TripPageView }) {
  const { tripId, dayNumber } = useParams()
  const trip = useTrip(tripId)

  if (trip.isPending) return <p className="p-8 text-muted-foreground">Caricamento…</p>
  if (trip.isError) {
    return (
      <div className="p-8">
        <p className="text-destructive">{trip.error.message}</p>
        <Link to="/" className="mt-2 inline-block text-primary">
          Torna ai viaggi
        </Link>
      </div>
    )
  }

  const day = dayNumber ? trip.data.days.find((d) => d.day_number === Number(dayNumber)) : null
  if (dayNumber && !day) return <Navigate to={`/trips/${trip.data.id}`} replace />

  return (
    <TripViewProvider trip={trip.data}>
      <TripLayout trip={trip.data} day={day ?? null} view={view} />
    </TripViewProvider>
  )
}

function TripLayout({ trip, day, view }: { trip: TripDetail; day: Day | null; view?: TripPageView }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline')
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  const content =
    view === 'photos' ? (
      <PhotosView trip={trip} />
    ) : view === 'ideas' ? (
      <IdeasView trip={trip} />
    ) : day ? (
      <Timeline key={day.id} trip={trip} day={day} />
    ) : (
      <TripOverview trip={trip} />
    )

  return (
    <div className="flex h-full flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Tutti i viaggi">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight font-semibold">{trip.title}</p>
          <p className="truncate text-xs text-muted-foreground">{formatDateRange(trip.start_date, trip.end_date)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSharing(true)}>
          <Share2 /> <span className="hidden sm:inline">{trip.visibility === 'unlisted' ? 'Condiviso' : 'Condividi'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> <span className="hidden sm:inline">Modifica</span>
        </Button>
      </header>

      {desktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[248px_minmax(0,1fr)_minmax(360px,42%)]">
          <aside className="overflow-y-auto border-r p-3">
            <DayList trip={trip} orientation="vertical" />
          </aside>
          <main className="overflow-y-auto px-6 py-6">{content}</main>
          <section className="border-l">
            <TripMapPanel trip={trip} day={day} view={view} />
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b pt-2">
            <DayList trip={trip} orientation="horizontal" />
          </div>
          <div className={cn('min-h-0 flex-1', mobileTab === 'timeline' ? 'overflow-y-auto px-4 py-5 pb-24' : 'hidden')}>
            {content}
          </div>
          <div className={cn('min-h-0 flex-1', mobileTab !== 'map' && 'hidden')}>
            {mobileTab === 'map' && <TripMapPanel trip={trip} day={day} view={view} />}
          </div>
          <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="flex rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur">
              <MobileTab active={mobileTab === 'timeline'} onClick={() => setMobileTab('timeline')} icon={<List />} label="Timeline" />
              <MobileTab active={mobileTab === 'map'} onClick={() => setMobileTab('map')} icon={<MapIcon />} label="Mappa" />
            </div>
          </nav>
        </div>
      )}

      <EditTripDialog trip={editing ? trip : null} onOpenChange={setEditing} />
      <ShareDialog trip={sharing ? trip : null} onOpenChange={setSharing} />
    </div>
  )
}

function MobileTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors [&_svg]:size-4',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function TripMapPanel({ trip, day, view }: { trip: TripDetail; day: Day | null; view?: TripPageView }) {
  const { selectedStopId, setSelectedStopId, hoveredStopId, setHoveredStopId } = useTripView()
  const showIdeas = view === 'ideas'
  const ideas = useTripIdeas(trip.id, showIdeas)
  const points = useMemo(
    () => (showIdeas ? ideaPoints(ideas.data ?? []) : day ? dayPoints(day) : overviewPoints(trip.days)),
    [showIdeas, ideas.data, trip.days, day],
  )
  const lines = useMemo(
    () => (showIdeas ? EMPTY_LINES : day ? dayLines(day) : overviewLines(trip.days)),
    [showIdeas, trip.days, day],
  )
  return (
    <TripMap
      points={points}
      lines={lines}
      // Le idee arrivano dopo il viaggio: si ricentra quando sono caricate.
      fitKey={showIdeas ? `ideas-${ideas.isSuccess}` : (day?.id ?? 'overview')}
      compact={!day && !showIdeas}
      selectedId={selectedStopId}
      hoveredId={hoveredStopId}
      onSelect={setSelectedStopId}
      onHover={setHoveredStopId}
    />
  )
}
