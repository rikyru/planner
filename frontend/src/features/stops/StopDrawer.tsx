import { Trash } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useTripPhotos } from '@/api/photos'
import { useCreateStop, useDeleteStop, useMoveStop, useUpdateStop } from '@/api/stops'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PlaceSearch, type Place } from '@/features/geocoding/PlaceSearch'
import { UploadButton } from '@/features/photos/PhotoUploader'
import { CategoryPicker } from '@/features/stops/CategoryPicker'
import { primarySide, type Side } from '@/features/stops/stopTime'
import { TimeField } from '@/features/stops/TimeField'
import type { Day, Stop, StopCategory, StopCreate, TimePrecision, TripDetail } from '@/types'
import { formatDayLong, formatTime } from '@/utils/dates'

interface Props {
  trip: TripDetail
  day: Day
  /** Tappa da modificare; null = nuova tappa. */
  stop: Stop | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StopDrawer(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        {props.open && <StopForm key={props.stop?.id ?? 'new'} {...props} />}
      </SheetContent>
    </Sheet>
  )
}

interface TimeState {
  time: string
  precision: TimePrecision
  duration: string
}

interface FormState {
  name: string
  lat: string
  lon: string
  address: string
  external_ref: string | null
  category: StopCategory
  custom_category: string
  notes: string
  planned: TimeState
  actual: TimeState
}

function initialState(stop: Stop | null): FormState {
  return {
    name: stop?.name ?? '',
    lat: stop?.lat != null ? String(stop.lat) : '',
    lon: stop?.lon != null ? String(stop.lon) : '',
    address: stop?.address ?? '',
    external_ref: stop?.external_ref ?? null,
    category: stop?.category ?? 'attraction',
    custom_category: stop?.custom_category ?? '',
    notes: stop?.notes ?? '',
    planned: {
      time: formatTime(stop?.planned_arrival) ?? '',
      precision: stop?.planned_time_precision ?? 'unknown',
      duration: stop?.planned_duration_min != null ? String(stop.planned_duration_min) : '',
    },
    actual: {
      time: formatTime(stop?.actual_arrival) ?? '',
      precision: stop?.actual_time_precision ?? 'unknown',
      duration: stop?.actual_duration_min != null ? String(stop.actual_duration_min) : '',
    },
  }
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? null : n
}

function StopForm({ trip, day, stop, onOpenChange }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(stop))
  const [side, setSide] = useState<Side>(primarySide(trip.kind))
  const create = useCreateStop(trip.id)
  const update = useUpdateStop(trip.id)
  const remove = useDeleteStop(trip.id)
  const move = useMoveStop(trip.id)

  const lat = toNumber(form.lat)
  const lon = toNumber(form.lon)
  const coordsValid = (lat === null) === (lon === null) && (lat === null || (Math.abs(lat) <= 90 && Math.abs(lon ?? 0) <= 180))
  const valid = form.name.trim() !== '' && coordsValid
  const pending = create.isPending || update.isPending

  const setTime = (s: Side, patch: Partial<TimeState>) => setForm((f) => ({ ...f, [s]: { ...f[s], ...patch } }))

  function applyPlace(place: Place) {
    setForm((f) => ({
      ...f,
      name: f.name.trim() === '' ? place.name : f.name,
      lat: String(place.lat),
      lon: String(place.lon),
      address: place.address ?? '',
      external_ref: place.external_ref,
      category: f.name.trim() === '' && place.category ? place.category : f.category,
    }))
  }

  function payload(): StopCreate {
    const timeFor = (s: TimeState) => ({
      arrival: s.time === '' ? null : s.time,
      precision: s.precision === 'unknown' && s.time !== '' ? 'exact' : s.precision,
      duration: toNumber(s.duration),
    })
    const p = timeFor(form.planned)
    const a = timeFor(form.actual)
    return {
      name: form.name.trim(),
      lat,
      lon,
      address: form.address.trim() || null,
      external_ref: form.external_ref,
      category: form.category,
      custom_category: form.category === 'custom' ? form.custom_category.trim() || null : null,
      notes: form.notes.trim() || null,
      planned_arrival: p.arrival,
      planned_time_precision: p.precision,
      planned_duration_min: p.duration,
      actual_arrival: a.arrival,
      actual_time_precision: a.precision,
      actual_duration_min: a.duration,
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    const body = payload()
    const done = { onSuccess: () => onOpenChange(false), onError: (e: Error) => toast.error(e.message) }
    if (stop) update.mutate({ stopId: stop.id, body }, done)
    else create.mutate({ dayId: day.id, body }, done)
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{stop ? 'Modifica tappa' : 'Nuova tappa'}</SheetTitle>
        <SheetDescription>
          Giorno {day.day_number} · {formatDayLong(day.date)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-5 py-4">
        <div className="space-y-2">
          <Label>Cerca luogo</Label>
          <PlaceSearch trip={trip} onSelect={applyPlace} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stop-name">Nome</Label>
          <Input
            id="stop-name"
            value={form.name}
            maxLength={200}
            placeholder="Brooklyn Bridge"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          {form.address && <p className="text-xs text-muted-foreground">{form.address}</p>}
        </div>

        <details className="group rounded-lg border px-3 py-2" open={!coordsValid}>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Coordinate {lat !== null && lon !== null ? `· ${lat.toFixed(5)}, ${lon.toFixed(5)}` : '· non impostate'}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input aria-label="Latitudine" inputMode="decimal" placeholder="Lat" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} />
            <Input aria-label="Longitudine" inputMode="decimal" placeholder="Lon" value={form.lon} onChange={(e) => setForm((f) => ({ ...f, lon: e.target.value }))} />
          </div>
          {!coordsValid && <p className="mt-1 text-xs text-destructive">Inserisci latitudine e longitudine valide, oppure nessuna delle due.</p>}
        </details>

        <div className="space-y-2">
          <Label>Categoria</Label>
          <CategoryPicker value={form.category} onChange={(category) => setForm((f) => ({ ...f, category }))} />
          {form.category === 'custom' && (
            <Input
              aria-label="Categoria personalizzata"
              placeholder="Es. Museo, Spiaggia…"
              maxLength={50}
              value={form.custom_category}
              onChange={(e) => setForm((f) => ({ ...f, custom_category: e.target.value }))}
            />
          )}
        </div>

        <Tabs value={side} onValueChange={(v) => setSide(v as Side)}>
          <TabsList className="w-full">
            <TabsTrigger value="planned">Pianificato</TabsTrigger>
            <TabsTrigger value="actual">Effettivo</TabsTrigger>
          </TabsList>
          {(['planned', 'actual'] as const).map((s) => (
            <TabsContent key={s} value={s} className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label>Orario di arrivo</Label>
                <TimeField
                  time={form[s].time}
                  precision={form[s].precision}
                  onChange={(time, precision) => setTime(s, { time, precision })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`duration-${s}`}>Durata della visita (minuti)</Label>
                <Input
                  id={`duration-${s}`}
                  type="number"
                  min={0}
                  step={5}
                  inputMode="numeric"
                  className="w-36"
                  value={form[s].duration}
                  onChange={(e) => setTime(s, { duration: e.target.value })}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="stop-notes">Note</Label>
          <Textarea id="stop-notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        {stop && <StopPhotos tripId={trip.id} stopId={stop.id} />}

        {stop && trip.days.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="stop-move">Sposta in un altro giorno</Label>
            <NativeSelect
              id="stop-move"
              value={day.id}
              onChange={(e) =>
                move.mutate(
                  { stopId: stop.id, dayId: e.target.value },
                  {
                    onSuccess: () => {
                      toast.success('Tappa spostata')
                      onOpenChange(false)
                    },
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
            >
              {trip.days.map((d) => (
                <option key={d.id} value={d.id}>
                  Giorno {d.day_number} · {d.title || formatDayLong(d.date)}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background px-5 py-3">
        {stop && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (!window.confirm(`Eliminare “${stop.name}”?`)) return
              remove.mutate(stop.id, { onSuccess: () => onOpenChange(false), onError: (e) => toast.error(e.message) })
            }}
          >
            <Trash /> Elimina
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="submit" disabled={!valid || pending}>
            {stop ? 'Salva' : 'Aggiungi tappa'}
          </Button>
        </div>
      </div>
    </form>
  )
}

function StopPhotos({ tripId, stopId }: { tripId: string; stopId: string }) {
  const photos = useTripPhotos(tripId)
  const count = photos.data?.filter((p) => p.stop_id === stopId).length ?? 0
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Foto</p>
        <p className="text-xs text-muted-foreground">
          {count === 0 ? 'Nessuna foto per questa tappa' : `${count} foto, visibili sotto la tappa`}
        </p>
      </div>
      <UploadButton tripId={tripId} target={{ stopId }} size="sm">
        Aggiungi
      </UploadButton>
    </div>
  )
}
