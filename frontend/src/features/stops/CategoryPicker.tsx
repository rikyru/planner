import { cn } from '@/lib/utils'
import type { StopCategory } from '@/types'
import { CATEGORIES, CATEGORY_ORDER } from '@/utils/labels'

export function CategoryPicker({ value, onChange }: { value: StopCategory; onChange: (c: StopCategory) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Categoria">
      {CATEGORY_ORDER.map((c) => {
        const { label, icon: Icon, color } = CATEGORIES[c]
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors',
              value === c ? 'border-primary bg-accent' : 'bg-card hover:bg-muted',
            )}
          >
            <Icon className="size-4" style={{ color }} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
