import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { useUploadPhotos, type UploadTarget } from '@/api/photos'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PhotoUploadResult } from '@/types'

const ACCEPT = 'image/*,.heic,.heif'

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function notify(result: PhotoUploadResult) {
  const parts: string[] = []
  if (result.created.length) parts.push(plural(result.created.length, 'foto caricata', 'foto caricate'))
  if (result.duplicates.length) parts.push(plural(result.duplicates.length, 'già presente', 'già presenti'))
  const summary = parts.join(' · ')
  if (result.errors.length === 0) {
    toast.success(summary || 'Nessuna foto caricata')
    return
  }
  const shown = result.errors.slice(0, 3).map((e) => `${e.filename}: ${e.message}`)
  if (result.errors.length > 3) shown.push(`e altre ${result.errors.length - 3}`)
  toast.warning(`${summary ? `${summary} · ` : ''}${plural(result.errors.length, 'scartata', 'scartate')}`, {
    description: shown.join('\n'),
  })
}

function imageFiles(list: FileList | null): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
}

/** Selezione multipla di file + trascinamento; carica a piccoli lotti con avanzamento. */
function usePhotoUpload(tripId: string, target?: UploadTarget) {
  const upload = useUploadPhotos(tripId)
  const inputRef = useRef<HTMLInputElement>(null)

  function start(files: File[]) {
    if (files.length === 0) {
      toast.error('Nessuna immagine tra i file scelti')
      return
    }
    upload.mutate({ files, target }, { onSuccess: notify, onError: (e) => toast.error(e.message) })
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      multiple
      hidden
      onChange={(e) => {
        start(imageFiles(e.target.files))
        e.target.value = ''
      }}
    />
  )
  const label = upload.progress ? `Caricamento ${upload.progress.done}/${upload.progress.total}…` : null
  return {
    input,
    open: () => inputRef.current?.click(),
    start,
    busy: upload.isPending,
    label,
  }
}

export function UploadButton({
  tripId,
  target,
  children = 'Aggiungi foto',
  ...props
}: { tripId: string; target?: UploadTarget; children?: React.ReactNode } & Omit<
  React.ComponentProps<typeof Button>,
  'onClick' | 'children'
>) {
  const { input, open, busy, label } = usePhotoUpload(tripId, target)
  return (
    <>
      {input}
      <Button type="button" variant="outline" {...props} disabled={busy || props.disabled} onClick={open}>
        {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
        {label ?? children}
      </Button>
    </>
  )
}

export function UploadDropzone({
  tripId,
  target,
  className,
  hint,
}: {
  tripId: string
  target?: UploadTarget
  className?: string
  hint?: string
}) {
  const { input, open, start, busy, label } = usePhotoUpload(tripId, target)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        start(imageFiles(e.dataTransfer.files))
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        over ? 'border-primary bg-primary/5' : 'border-border',
        className,
      )}
    >
      {input}
      {busy ? (
        <LoaderCircle className="size-6 animate-spin text-primary" />
      ) : (
        <ImagePlus className="size-6 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">{label ?? 'Trascina qui le foto o sceglile dal dispositivo'}</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {hint ?? 'JPEG, HEIC, PNG o WebP. Gli originali restano intatti; data e posizione vengono lette dai metadati.'}
      </p>
      <Button type="button" size="sm" className="mt-1" disabled={busy} onClick={open}>
        Scegli foto
      </Button>
    </div>
  )
}
