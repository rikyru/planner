/** Client HTTP minimo: stessa origine (nginx o proxy Vite inoltrano /api al backend). */

export interface ApiErrorBody {
  error: { code: string; message: string; details: unknown }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? `Errore HTTP ${status}`)
    this.status = status
    this.code = body?.error.code ?? 'http_error'
    this.details = body?.error.details ?? null
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (!response.ok) {
    let parsed: ApiErrorBody | null = null
    try {
      parsed = (await response.json()) as ApiErrorBody
    } catch {
      parsed = null
    }
    throw new ApiError(response.status, parsed)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
