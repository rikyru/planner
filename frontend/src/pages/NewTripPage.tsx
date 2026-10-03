import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useCreateTrip } from '@/api/trips'
import { AppHeader } from '@/components/AppHeader'
import { ModeChooser } from '@/features/trips/ModeChooser'
import { TripForm } from '@/features/trips/TripForm'
import type { TripKind } from '@/types'

export function NewTripPage() {
  const [kind, setKind] = useState<TripKind | null>(null)
  const create = useCreateTrip()
  const navigate = useNavigate()

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Viaggi
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Nuovo viaggio</h1>

        <section className="mt-6">
          <ModeChooser value={kind} onChange={setKind} />
        </section>

        {kind && (
          <section className="mt-8 rounded-xl border bg-card p-5 sm:p-6">
            <TripForm
              submitLabel={kind === 'plan' ? 'Crea viaggio' : 'Inizia la ricostruzione'}
              pending={create.isPending}
              onSubmit={(values) =>
                create.mutate(
                  {
                    title: values.title,
                    description: values.description.trim() || null,
                    start_date: values.start_date,
                    end_date: values.end_date,
                    kind,
                  },
                  {
                    onSuccess: (trip) => navigate(`/trips/${trip.id}/day/1`, { replace: true }),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            />
          </section>
        )}
      </main>
    </div>
  )
}
