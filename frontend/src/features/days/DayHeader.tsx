import { useState } from 'react'

import { useUpdateDay } from '@/api/trips'
import { Textarea } from '@/components/ui/textarea'
import type { Day } from '@/types'
import { formatDayLong } from '@/utils/dates'

/** Titolo e note del giorno modificabili sul posto: si salvano quando il campo perde il focus.
 * Il componente padre è montato con key = id del giorno, quindi lo stato riparte a ogni cambio giorno. */
export function DayHeader({ tripId, day }: { tripId: string; day: Day }) {
  const update = useUpdateDay(tripId)
  const [title, setTitle] = useState(day.title ?? '')
  const [notes, setNotes] = useState(day.notes ?? '')
  const [showNotes, setShowNotes] = useState(Boolean(day.notes))

  function save(body: { title?: string; notes?: string }) {
    update.mutate({ dayId: day.id, body })
  }

  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">
        Giorno {day.day_number} · {formatDayLong(day.date)}
      </p>
      <input
        aria-label="Titolo della giornata"
        className="w-full rounded-md bg-transparent font-serif text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus:bg-muted/60 sm:text-3xl"
        placeholder="Dai un titolo alla giornata"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== (day.title ?? '') && save({ title })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {showNotes ? (
        <Textarea
          aria-label="Note della giornata"
          rows={2}
          placeholder="Note della giornata"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (day.notes ?? '') && save({ notes })}
          className="mt-2"
        />
      ) : (
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowNotes(true)}>
          + Aggiungi note
        </button>
      )}
    </header>
  )
}
