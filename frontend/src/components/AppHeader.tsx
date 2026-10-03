import type { ReactNode } from 'react'
import { Link } from 'react-router'

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-7" />
          Planner
        </Link>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  )
}
