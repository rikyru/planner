import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { daysBetween } from '@/utils/dates'

export interface TripFormValues {
  title: string
  description: string
  start_date: string
  end_date: string
}

interface Props {
  initial?: Partial<TripFormValues>
  submitLabel: string
  pending?: boolean
  onSubmit: (values: TripFormValues) => void
  onCancel?: () => void
}

export function TripForm({ initial, submitLabel, pending, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<TripFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
  })

  const set = (key: keyof TripFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))
  const datesValid = values.start_date !== '' && values.end_date !== '' && values.end_date >= values.start_date
  const valid = values.title.trim() !== '' && datesValid
  const dayCount = datesValid ? daysBetween(values.start_date, values.end_date) : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (valid) onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="trip-title">Titolo</Label>
        <Input
          id="trip-title"
          autoFocus
          placeholder="New York"
          value={values.title}
          onChange={(e) => set('title')(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="trip-start">Inizio</Label>
          <Input
            id="trip-start"
            type="date"
            value={values.start_date}
            onChange={(e) => {
              const start = e.target.value
              setValues((v) => ({ ...v, start_date: start, end_date: v.end_date && v.end_date >= start ? v.end_date : start }))
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trip-end">Fine</Label>
          <Input
            id="trip-end"
            type="date"
            min={values.start_date || undefined}
            value={values.end_date}
            onChange={(e) => set('end_date')(e.target.value)}
          />
        </div>
      </div>
      {dayCount !== null && (
        <p className="-mt-2 text-sm text-muted-foreground">
          {dayCount} {dayCount === 1 ? 'giornata' : 'giornate'}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="trip-description">
          Descrizione <span className="font-normal text-muted-foreground">(facoltativa)</span>
        </Label>
        <Textarea
          id="trip-description"
          rows={3}
          value={values.description}
          onChange={(e) => set('description')(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annulla
          </Button>
        )}
        <Button type="submit" disabled={!valid || pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
