import { cn } from '@/lib/utils'
import type { Photo } from '@/types'

export function PhotoThumb({ photo, onClick, className }: { photo: Photo; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative block overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      aria-label={photo.caption || photo.original_filename}
    >
      <img
        src={photo.thumb_url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </button>
  )
}

export function PhotoGrid({ photos, onOpen }: { photos: Photo[]; onOpen: (index: number) => void }) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-5">
      {photos.map((photo, index) => (
        <li key={photo.id} className="aspect-square">
          <PhotoThumb photo={photo} onClick={() => onOpen(index)} className="h-full w-full" />
        </li>
      ))}
    </ul>
  )
}

/** Striscia compatta per le card delle tappe: alcune miniature e il conteggio delle restanti. */
export function PhotoStrip({
  photos,
  onOpen,
  max = 4,
}: {
  photos: Photo[]
  onOpen: (index: number) => void
  max?: number
}) {
  const shown = photos.slice(0, max)
  const rest = photos.length - shown.length
  return (
    <div className="flex gap-1.5">
      {shown.map((photo, index) => (
        <div key={photo.id} className="relative size-14 shrink-0">
          <PhotoThumb photo={photo} onClick={() => onOpen(index)} className="h-full w-full" />
          {rest > 0 && index === shown.length - 1 && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/45 text-sm font-semibold text-white">
              +{rest}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
