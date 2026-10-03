import { Ellipsis, ExternalLink, Pencil, Share2, Trash } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TripCover } from '@/features/trips/TripCover'
import type { TripSummary } from '@/types'
import { formatDateRange } from '@/utils/dates'

interface Props {
  trip: TripSummary
  onEdit: () => void
  onDelete: () => void
  onShare: () => void
}

export function TripCard({ trip, onEdit, onDelete, onShare }: Props) {
  return (
    <article className="group relative overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <Link to={`/trips/${trip.id}`} className="block">
        <div className="aspect-[16/9]">
          <TripCover seed={trip.id} title={trip.title} coverUrl={trip.cover_url} />
        </div>
        <div className="space-y-1 p-4 pr-12">
          <h2 className="truncate font-serif text-xl font-semibold">{trip.title}</h2>
          <p className="text-sm text-muted-foreground">{formatDateRange(trip.start_date, trip.end_date)}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>
              {trip.day_count} {trip.day_count === 1 ? 'giorno' : 'giorni'}
            </span>
            <span aria-hidden>·</span>
            <span>
              {trip.stop_count} {trip.stop_count === 1 ? 'tappa' : 'tappe'}
            </span>
            {trip.photo_count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{trip.photo_count} foto</span>
              </>
            )}
            {trip.kind === 'reconstruct' && (
              <Badge variant="secondary" className="ml-1">
                Ricordo
              </Badge>
            )}
            {trip.visibility === 'unlisted' && <Badge variant="outline">Condiviso</Badge>}
          </div>
        </div>
      </Link>
      <div className="absolute right-2 bottom-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Azioni per ${trip.title}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/trips/${trip.id}`}>
                <ExternalLink /> Apri
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Modifica
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShare}>
              <Share2 /> Condividi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash /> Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}
