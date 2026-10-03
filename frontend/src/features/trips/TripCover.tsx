import { cn } from '@/lib/utils'

const PALETTES = [
  ['#2f6577', '#7fb3b8'],
  ['#c8643b', '#f0b67f'],
  ['#4a6fa5', '#a9c3e6'],
  ['#4f7f4f', '#b5d1a3'],
  ['#6b5b95', '#c3b5e0'],
  ['#8a5a44', '#e3c09c'],
] as const

function hash(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** Cover generata finché il viaggio non ha una foto di copertina. */
export function TripCover({
  seed,
  title,
  coverUrl,
  className,
}: {
  seed: string
  title: string
  coverUrl?: string | null
  className?: string
}) {
  if (coverUrl) {
    return <img src={coverUrl} alt="" className={cn('h-full w-full object-cover', className)} />
  }
  const [a, b] = PALETTES[hash(seed) % PALETTES.length] ?? PALETTES[0]
  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="none" viewBox="0 0 200 100">
        <path d="M-10 70 C 40 40, 80 90, 120 55 S 190 30, 210 45" stroke="white" strokeWidth="1.2" fill="none" strokeDasharray="2 4" />
        <circle cx="38" cy="55" r="2.5" fill="white" />
        <circle cx="120" cy="55" r="2.5" fill="white" />
        <circle cx="178" cy="38" r="2.5" fill="white" />
      </svg>
      <span className="absolute right-4 bottom-2 font-serif text-5xl font-semibold text-white/35 select-none">
        {title.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
