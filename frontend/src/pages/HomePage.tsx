import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useTrips } from '@/api/trips'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { ShareDialog } from '@/features/share/ShareDialog'
import { DeleteTripDialog } from '@/features/trips/DeleteTripDialog'
import { EditTripDialog } from '@/features/trips/EditTripDialog'
import { TripCard } from '@/features/trips/TripCard'
import type { TripSummary } from '@/types'

export function HomePage() {
  const trips = useTrips()
  const [editing, setEditing] = useState<TripSummary | null>(null)
  const [deleting, setDeleting] = useState<TripSummary | null>(null)
  const [sharing, setSharing] = useState<TripSummary | null>(null)

  return (
    <div className="min-h-full">
      <AppHeader>
        <Button asChild>
          <Link to="/trips/new">
            <Plus /> Nuovo viaggio
          </Link>
        </Button>
      </AppHeader>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">I tuoi viaggi</h1>

        {trips.isPending && <p className="mt-6 text-muted-foreground">Caricamento…</p>}
        {trips.isError && <p className="mt-6 text-destructive">Impossibile caricare i viaggi: {trips.error.message}</p>}

        {trips.isSuccess && trips.data.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
            <p className="font-serif text-xl">Nessun viaggio, per ora.</p>
            <p className="mt-1 text-muted-foreground">Pianificane uno nuovo o ricostruisci un viaggio che hai già fatto.</p>
            <Button asChild className="mt-5">
              <Link to="/trips/new">
                <Plus /> Nuovo viaggio
              </Link>
            </Button>
          </div>
        )}

        {trips.isSuccess && trips.data.length > 0 && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.data.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={() => setEditing(trip)}
                onDelete={() => setDeleting(trip)}
                onShare={() => setSharing(trip)}
              />
            ))}
          </div>
        )}
      </main>

      <EditTripDialog trip={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <DeleteTripDialog trip={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
      <ShareDialog trip={sharing} onOpenChange={(open) => !open && setSharing(null)} />
    </div>
  )
}
