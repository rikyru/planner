import { ClockArrowLeft, Globe, LoaderCircle, MapPin, Search } from 'lucide-react'
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
  // "Cerca ancora": su richiesta, un secondo geocoder che conosce più nomi (Pechino, Mosca…).
  const [deepText, setDeepText] = useState<string | null>(null)
  const deepActive = deepText !== null && deepText === text.trim()
  const deep = useGeocode(deepActive ? deepText : '', bias, true)

  const fromTrip = matchTripPlaces(known, text)
  const seen = new Set(fromTrip.map((t) => t.external_ref).filter(Boolean))
  const fromGeocoder: Place[] = [
    ...(debounced.trim().length >= 2 ? (geocode.data ?? []) : []),
    ...(deepActive ? (deep.data ?? []) : []),
  ]
    .map((p) => ({ ...p, address: p.address ?? null, category: p.category ?? null, external_ref: p.external_ref ?? null, source: 'geocoder' as const }))
    .filter((p) => {
      if (!p.external_ref) return true
      if (seen.has(p.external_ref)) return false
      seen.add(p.external_ref)
      return true
    })
  const options = [...fromTrip, ...fromGeocoder]
  const canSearchMore = text.trim().length >= 2 && !deepActive
  const searchMoreIndex = canSearchMore ? options.length : -1

  function choose(place: Place) {
    onSelect(place)
    setOpen(false)
    setActive(0)
    setText(clearOnSelect ? '' : place.name)
  }

  function searchMore() {
    setDeepText(text.trim())
    setActive(options.length)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - (canSearchMore ? 0 : 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = open ? options[active] : undefined
      if (option) choose(option)
      // Senza risultati Invio resta "aggiungi solo il nome"; "Cerca ancora" si sceglie con le frecce o il tocco.
      else if (open && active === searchMoreIndex && options.length > 0) searchMore()
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
          {leading ?? (geocode.isFetching || deep.isFetching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />)}
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
              {(deepActive ? deep.isError : geocode.isError)
                ? 'Ricerca luoghi non disponibile.'
                : debounced !== text || geocode.isFetching || deep.isFetching
                  ? 'Cerco…'
                  : 'Nessun risultato.'}
              {onSubmitText && ' Invio per aggiungere solo il nome.'}
            </li>
          )}
          {canSearchMore && (
            <li
              role="option"
              aria-selected={active === searchMoreIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={searchMore}
              onMouseEnter={() => setActive(searchMoreIndex)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-primary',
                active === searchMoreIndex && 'bg-accent',
              )}
            >
              <Globe className="size-4 shrink-0" />
              <span className="min-w-0 truncate">
                Non lo trovi? Cerca ancora «{text.trim()}»
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
