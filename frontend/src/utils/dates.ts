const LOCALE = 'it-IT'

/** Le date dell'API sono "YYYY-MM-DD": le interpretiamo a mezzogiorno UTC per evitare
 * slittamenti di giorno dovuti al fuso del browser. */
export function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' })
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' })
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start)
  const e = parseDate(end)
  if (start === end) return dayMonthYear.format(s)
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear()
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth()
  if (sameMonth) return `${s.getUTCDate()}–${dayMonthYear.format(e)}`
  if (sameYear) return `${dayMonth.format(s)} – ${dayMonthYear.format(e)}`
  return `${dayMonthYear.format(s)} – ${dayMonthYear.format(e)}`
}

export function formatDayLong(iso: string): string {
  const d = parseDate(iso)
  return `${capitalize(weekdayLong.format(d))} ${dayMonth.format(d)}`
}

export function formatDayShort(iso: string): { weekday: string; date: string } {
  const d = parseDate(iso)
  return { weekday: weekdayShort.format(d).replace('.', ''), date: shortDate.format(d) }
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000) + 1
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "09:45:00" → "09:45" */
export function formatTime(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null
}

export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}
