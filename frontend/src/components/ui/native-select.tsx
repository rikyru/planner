import type * as React from 'react'

import { cn } from '@/lib/utils'

/** Select nativo stilizzato: su smartphone apre il picker di sistema, più comodo al tocco. */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
