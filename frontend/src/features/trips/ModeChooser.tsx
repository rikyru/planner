import { BookOpen, CalendarPlus, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { TripKind } from '@/types'

const MODES: { kind: TripKind; title: string; text: string; icon: LucideIcon }[] = [
  {
    kind: 'plan',
    title: 'Pianifica un nuovo viaggio',
    text: 'Giorni, tappe, orari e spostamenti prima di partire.',
    icon: CalendarPlus,
  },
  {
    kind: 'reconstruct',
    title: 'Ricostruisci un viaggio passato',
    text: 'Orari facoltativi o approssimativi, inserimento rapido di molte tappe.',
    icon: BookOpen,
  },
]

export function ModeChooser({ value, onChange }: { value: TripKind | null; onChange: (kind: TripKind) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo di viaggio">
      {MODES.map(({ kind, title, text, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          onClick={() => onChange(kind)}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50',
            value === kind && 'border-primary ring-2 ring-primary/20',
          )}
        >
          <Icon className="size-6 text-primary" />
          <span className="font-serif text-lg font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{text}</span>
        </button>
      ))}
    </div>
  )
}
