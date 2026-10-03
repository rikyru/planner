import { ClockArrowLeft, LoaderCircle, MapPin, Search } from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

import { useGeocode } from '@/api/geocode'
import { Input } from '@/components/ui/input'
import { matchTripPlaces, tripCenter, tripPlaces, type Place } from '@/features/geocoding/places'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { TripDetail } from '@/types'

export type { Place }

interface Props {
  trip: TripDetail
  onSelect: (place: Place) => void
  /** Invio senza scegliere un risultato: usato dall'aggiunta rapida per creare una tappa col solo nome. */
  onSubmitText?: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
  clearOnSelect?: boolean
  inputClassName?: string
  leading?: ReactNode
}

/** Combobox di ricerca luoghi: prima i luoghi già usati nel viaggio, poi il geocoder. */
export function PlaceSearch({
  trip,
  onSelect,
  onSubmitText,
  placeholder = 'Cerca un luogo…',
  autoFocus,
  clearOnSelect,
  inputClassName,
  leading,
}: Props) {
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(text, 350)

  const known = useMemo(() => tripPlaces(trip), [trip])
  const bias = useMemo(() => tripCenter(trip), [trip])
  const geocode = useGeocode(debounced, bias)

  const fromTrip = matchTripPlaces(known, text)
  const fromGeocoder: Place[] = (debounced.trim().length >= 2 ? (geocode.data ?? []) : [])
    .map((p) => ({ ...p, address: p.address ?? null, category: p.category ?? null, external_ref: p.external_ref ?? null, source: 'geocoder' as const }))
    .filter((p) => !fromTrip.some((t) => t.external_ref && t.external_ref === p.external_ref))
  const options = [...fromTrip, ...fromGeocoder]

  function choose(place: Place) {
    onSelect(place)
    setOpen(false)
    setActive(0)
    setText(clearOnSelect ? '' : place.name)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = open ? options[active] : undefined
      if (option) choose(option)
      else if (onSubmitText && text.trim()) {
        onSubmitText(text.trim())
        setText('')
        setOpen(false)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && text.trim().length > 0
  return (
    <div className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          {leading ?? (geocode.isFetching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />)}
        </span>
        <Input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          className={cn('pl-9', inputClassName)}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {options.map((place, index) => (
            <li
              key={`${place.source}-${place.external_ref ?? place.name}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(index)}
              className={cn('flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm', index === active && 'bg-accent')}
            >
              {place.source === 'trip' ? (
                <ClockArrowLeft className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium">{place.name}</span>
                {place.address && <span className="block truncate text-xs text-muted-foreground">{place.address}</span>}
              </span>
            </li>
          ))}
          {options.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">
              {geocode.isError
                ? 'Ricerca luoghi non disponibile.'
                : debounced !== text || geocode.isFetching
                  ? 'Cerco…'
                  : 'Nessun risultato.'}
              {onSubmitText && ' Invio per aggiungere solo il nome.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
