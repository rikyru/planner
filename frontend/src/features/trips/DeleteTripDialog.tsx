import { toast } from 'sonner'

import { useDeleteTrip } from '@/api/trips'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { TripSummary } from '@/types'

export function DeleteTripDialog({
  trip,
  onOpenChange,
  onDeleted,
}: {
  trip: TripSummary | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const remove = useDeleteTrip()
  return (
    <AlertDialog open={trip !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Eliminare “{trip?.title}”?</AlertDialogTitle>
        <AlertDialogDescription>
          Verranno eliminati tutti i giorni, le tappe e le foto del viaggio. L'operazione non si può annullare.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!trip) return
              remove.mutate(trip.id, {
                onSuccess: () => {
                  toast.success('Viaggio eliminato')
                  onDeleted?.()
                },
                onError: (e) => toast.error(e.message),
              })
            }}
          >
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
