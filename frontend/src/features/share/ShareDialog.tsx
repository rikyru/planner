import { Check, Copy, ExternalLink, Link2Off, LoaderCircle, RefreshCw, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { shareUrl, useShareAction, useShareInfo } from '@/api/share'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface Props {
  trip: { id: string; title: string } | null
  onOpenChange: (open: boolean) => void
}

export function ShareDialog({ trip, onOpenChange }: Props) {
  return (
    <Dialog open={trip !== null} onOpenChange={onOpenChange}>
      <DialogContent>{trip && <ShareBody key={trip.id} tripId={trip.id} title={trip.title} />}</DialogContent>
    </Dialog>
  )
}

function ShareBody({ tripId, title }: { tripId: string; title: string }) {
  const info = useShareInfo(tripId)
  const action = useShareAction(tripId)
  const [copied, setCopied] = useState(false)
  const url = info.data ? shareUrl(info.data) : null

  function run(kind: 'enable' | 'rotate' | 'disable', success: string) {
    action.mutate(kind, { onSuccess: () => toast.success(success), onError: (e) => toast.error(e.message) })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copia non riuscita: seleziona il link e copialo a mano')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Condividi “{title}”</DialogTitle>
        <DialogDescription>
          Chi ha il link vede il diario in sola lettura: giornate, tappe, mappa e le foto assegnate a una giornata. Non
          serve un account e la pagina non viene indicizzata.
        </DialogDescription>
      </DialogHeader>

      {info.isPending && <LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground" />}
      {info.isError && <p className="text-sm text-destructive">{info.error.message}</p>}

      {info.data && !url && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Il viaggio è privato.</p>
          <Button onClick={() => run('enable', 'Link creato')} disabled={action.isPending}>
            <Share2 /> Crea link di condivisione
          </Button>
        </div>
      )}

      {url && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link di condivisione" />
            <Button onClick={copy} className="shrink-0">
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copiato' : 'Copia'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink /> Apri la pagina
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={action.isPending}
              onClick={() => {
                if (window.confirm('Il link attuale smetterà di funzionare. Generarne uno nuovo?'))
                  run('rotate', 'Nuovo link generato')
              }}
            >
              <RefreshCw /> Nuovo link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={action.isPending}
              onClick={() => run('disable', 'Condivisione disattivata')}
            >
              <Link2Off /> Disattiva
            </Button>
          </div>
          {!info.data?.url && (
            <p className="text-xs text-muted-foreground">
              Il link usa l’indirizzo da cui stai navigando. Se il server è raggiungibile con un altro nome, imposta
              PUBLIC_BASE_URL.
            </p>
          )}
        </div>
      )}
    </>
  )
}
