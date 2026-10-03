import { usePublicConfig } from '@/api/config'

export function HomePage() {
  const config = usePublicConfig()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Planner</h1>
      <p className="mt-2 text-muted-foreground">
        {config.isSuccess ? `Backend raggiungibile, versione ${config.data.version}.` : 'Connessione al backend…'}
      </p>
    </main>
  )
}
