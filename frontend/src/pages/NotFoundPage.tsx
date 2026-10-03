import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl font-semibold">Pagina non trovata</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
        Torna ai viaggi
      </Link>
    </main>
  )
}
