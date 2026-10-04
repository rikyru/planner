import { Lightbulb, MapPinOff, Trash } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useCreateIdea, useDeleteIdea, useScheduleIdea, useTripIdeas, useUpdateIdea } from '@/api/ideas'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { PlaceSearch } from '@/features/geocoding/PlaceSearch'
import { useTripView } from '@/features/trips/TripViewContext'
import { cn } from '@/lib/utils'
import type { Idea, TripDetail } from '@/types'
import { formatDayLong } from '@/utils/dates'
import { CATEGORIES } from '@/utils/labels'

/** Luoghi senza giorno: da vedere (viaggio pianificato) o non visti (ricostruzione). */
export function IdeasView({ trip }: { trip: TripDetail }) {
  const ideas = useTripIdeas(trip.id)
  const create = useCreateIdea(trip.id)
  const reconstruct = trip.kind === 'reconstruct'

  function add(body: Parameters<typeof create.mutate>[0]) {
    create.mutate(body, { onError: (e) => toast.error(e.message) })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Idee</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {reconstruct
            ? 'Posti che non siete riusciti a vedere. Nel diario condiviso compaiono come «Per la prossima volta».'
            : 'Posti da vedere senza un giorno preciso. Quando decidi, mettili in una giornata.'}
        </p>
      </header>

      <PlaceSearch
        trip={trip}
        clearOnSelect
        placeholder="Aggiungi un'idea: cerca un luogo o scrivi un nome e premi Invio"
        onSelect={(place) =>
          add({
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            address: place.address,
            category: place.category ?? undefined,
            external_ref: place.external_ref,
          })
        }
        onSubmitText={(text) => text.trim() && add({ name: text.trim() })}
      />

      {ideas.isPending && <p className="text-muted-foreground">Caricamento…</p>}
      {ideas.isError && <p className="text-destructive">{ideas.error.message}</p>}
      {ideas.data?.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          <Lightbulb className="size-4 shrink-0" />
          Ancora nessuna idea.
        </p>
      )}
      <ul className="space-y-2">
        {ideas.data?.map((idea) => (
          <li key={idea.id}>
            <IdeaCard trip={trip} idea={idea} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function IdeaCard({ trip, idea }: { trip: TripDetail; idea: Idea }) {
  const update = useUpdateIdea(trip.id)
  const remove = useDeleteIdea(trip.id)
  const schedule = useScheduleIdea(trip.id)
  const navigate = useNavigate()
  const { selectedStopId, setSelectedStopId, hoveredStopId, setHoveredStopId } = useTripView()
  const [notes, setNotes] = useState(idea.notes ?? '')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  // Le note lunghe vanno a capo: il campo cresce con il testo.
  useLayoutEffect(() => {
    const el = notesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [notes])
  const category = CATEGORIES[idea.category]
  const Icon = category.icon
  const highlighted = selectedStopId === idea.id || hoveredStopId === idea.id

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs transition-shadow',
        highlighted && 'ring-2 ring-primary/40',
      )}
      onMouseEnter={() => setHoveredStopId(idea.id)}
      onMouseLeave={() => setHoveredStopId(null)}
      onFocus={() => setSelectedStopId(idea.id)}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: category.color }}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="leading-6 font-medium">{idea.name}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {idea.category === 'custom' && idea.custom_category ? idea.custom_category : category.label}
              {idea.lat == null && (
                <span className="inline-flex items-center gap-1 text-terracotta">
                  <MapPinOff className="size-3" /> senza posizione
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Elimina ${idea.name}`}
            className="text-muted-foreground"
            onClick={() => remove.mutate(idea.id, { onError: (e) => toast.error(e.message) })}
          >
            <Trash />
          </Button>
        </div>
        <Textarea
          ref={notesRef}
          rows={1}
          value={notes}
          placeholder="Note"
          aria-label={`Note per ${idea.name}`}
          className="min-h-0 resize-none text-sm"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() =>
            notes.trim() !== (idea.notes ?? '') &&
            update.mutate(
              { id: idea.id, body: { notes: notes.trim() || null } },
              { onError: (e) => toast.error(e.message) },
            )
          }
        />
        <NativeSelect
          aria-label={`Metti ${idea.name} in una giornata`}
          value=""
          disabled={schedule.isPending}
          className="h-8 text-sm md:text-sm"
          onChange={(e) => {
            const day = trip.days.find((d) => d.id === e.target.value)
            if (!day) return
            schedule.mutate(
              { id: idea.id, dayId: day.id },
              {
                onSuccess: () =>
                  toast.success(`${idea.name} aggiunta al giorno ${day.day_number}`, {
                    action: { label: 'Apri', onClick: () => navigate(`/trips/${trip.id}/day/${day.day_number}`) },
                  }),
                onError: (err) => toast.error(err.message),
              },
            )
          }}
        >
          <option value="">Metti in una giornata…</option>
          {trip.days.map((d) => (
            <option key={d.id} value={d.id}>
              Giorno {d.day_number} · {d.title || formatDayLong(d.date)}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
