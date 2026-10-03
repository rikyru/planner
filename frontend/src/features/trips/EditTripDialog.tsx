import { toast } from 'sonner'

import { ApiError } from '@/api/client'
import { useUpdateTrip } from '@/api/trips'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripForm, type TripFormValues } from '@/features/trips/TripForm'
import type { TripSummary } from '@/types'
import { formatDayLong } from '@/utils/dates'

interface Props {
  trip: TripSummary | null
  onOpenChange: (open: boolean) => void
}

export function EditTripDialog({ trip, onOpenChange }: Props) {
  return (
    <Dialog open={trip !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica viaggio</DialogTitle>
          <DialogDescription>Cambiando le date i giorni esistenti vengono mantenuti.</DialogDescription>
        </DialogHeader>
        {trip && <EditForm trip={trip} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ trip, onDone }: { trip: TripSummary; onDone: () => void }) {
  const update = useUpdateTrip(trip.id)

  function save(values: TripFormValues, confirmDeleteDays = false) {
    update.mutate(
      {
        body: {
          title: values.title,
          description: values.description.trim() || null,
          start_date: values.start_date,
          end_date: values.end_date,
        },
        confirmDeleteDays,
      },
      {
        onSuccess: () => {
          toast.success('Viaggio aggiornato')
          onDone()
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            const days = ((error.details as { days?: string[] } | null)?.days ?? []).map(formatDayLong)
            const ok = window.confirm(
              `Questi giorni contengono tappe e verrebbero eliminati:\n\n${days.join('\n')}\n\nContinuare?`,
            )
            if (ok) save(values, true)
            return
          }
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <TripForm
      initial={{
        title: trip.title,
        description: trip.description ?? '',
        start_date: trip.start_date,
        end_date: trip.end_date,
      }}
      submitLabel="Salva"
      pending={update.isPending}
      onSubmit={(v) => save(v)}
      onCancel={onDone}
    />
  )
}
