import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TimePrecision } from '@/types'
import { PERIOD_PRECISIONS, PRECISION } from '@/utils/labels'

const ORDER: TimePrecision[] = ['exact', 'approximate', 'morning', 'afternoon', 'evening', 'unknown']

interface Props {
  time: string
  precision: TimePrecision
  onChange: (time: string, precision: TimePrecision) => void
}

/** Ora + precisione. "Mattina/Pomeriggio/Sera/Non so" non richiedono un orario. */
export function TimeField({ time, precision, onChange }: Props) {
  const needsTime = !PERIOD_PRECISIONS.includes(precision) && precision !== 'unknown'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Precisione dell'orario">
        {ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={precision === p}
            onClick={() => onChange(PERIOD_PRECISIONS.includes(p) || p === 'unknown' ? '' : time, p)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              precision === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {PRECISION[p].label}
          </button>
        ))}
      </div>
      {needsTime && (
        <Input
          type="time"
          aria-label="Orario"
          value={time}
          onChange={(e) => onChange(e.target.value, precision)}
          className="w-36"
        />
      )}
    </div>
  )
}
