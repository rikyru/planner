# Design

Il documento di progettazione completo (requisiti, schema del database, API, componenti,
problemi architetturali, milestone) è il Claude Doc del progetto:
https://claude.ai/code/artifact/9e3d7448-fb32-4070-ba76-a46d2b8a395e

Questa pagina registra solo dove l'implementazione dell'MVP (M0–M5) si discosta dal documento
o lo precisa.

## Scostamenti

- **Niente login.** Su decisione di Riccardo l'MVP usa un utente locale implicito
  (`LOCAL_USERNAME`), creato al primo accesso. Mancano quindi pagina di login, route `auth` e
  password; il punto unico in cui aggiungerli è `get_current_user` in `backend/app/api/deps.py`.
- **Porta separata per la condivisione.** Oltre all'app completa su `APP_PORT`, nginx ascolta su
  `SHARE_PORT` (8081) servendo solo `/share/<token>`, `/api/share/*`, `/api/config` e i file
  statici. È la porta da esporre su Internet al posto delle regole nel reverse proxy.
- **Upload delle foto a lotti.** Il client invia lotti sequenziali di 4 file (invece di 3 richieste
  parallele): avanzamento visibile, carico costante sul Mac mini e richieste lontane dal limite di
  nginx. Limiti: 60 MB a file, 200 file per richiesta.
- **Associazione per data di scatto** (`POST /api/trips/{id}/photos/assign-by-date`): azione
  esplicita dell'utente che mette nel giorno della data EXIF le foto ancora senza giorno. Non è il
  matching automatico foto→tappa, che resta un punto d'estensione (`services/photo_matching.py`).
- **Copertina di ripiego.** Senza copertina scelta, card e pagina condivisa usano la prima foto
  scattata (nella pagina condivisa, la prima tra quelle assegnate a una giornata).
- **Varianti rigenerate su richiesta.** Se un file `thumbs/` o `display/` manca, il backend lo
  ricrea dall'originale alla prima richiesta.
- **Spostare una tappa sposta le sue foto** nel nuovo giorno (`photos.day_id` segue `stop.day_id`).
- **`GET /api/trips/{id}/share`** restituisce lo stato della condivisione per il dialog.
- **Idee senza giorno** (aggiunta dopo il test con un viaggio reale). Tabella `ideas` separata
  dalle tappe, perché una tappa appartiene sempre a un giorno e ha orari e segmenti. Vista Idee su
  `/trips/:id/ideas` con i marker sulla mappa; `POST /api/ideas/{id}/schedule` la trasforma in
  tappa in coda al giorno scelto, `POST /api/stops/{id}/to-idea` fa il contrario (orari e segmenti
  si perdono). Nella pagina condivisa diventano «Per la prossima volta» (ricostruzioni) o «Altre
  idee» (itinerari).
- **Categoria Quartiere** (`neighborhood`) per zone girate a piedi più che singoli luoghi.
- **Vista Foto** su `/trips/:id/photos`; la tappa selezionata non è nell'URL (`?stop=`), solo nel
  contesto della pagina.

## Pagina condivisa

- Mostra per ogni tappa il lato principale del viaggio (effettivo per i viaggi ricostruiti,
  pianificato per gli altri), con ripiego sull'altro lato se il principale è vuoto: la stessa
  regola della timeline. Planned e actual restano separati nel database.
- Include solo le foto assegnate a una giornata, senza EXIF, coordinate o originali; anche
  `?size=original` restituisce la variante `display`.
- Risponde con `X-Robots-Tag: noindex` e la pagina aggiunge `<meta name="robots">`. Le foto
  pubbliche hanno cache di un'ora, così un link revocato smette presto di servirle.
- Il token è `secrets.token_urlsafe(24)` (192 bit). **Nuovo link** lo sostituisce, **Disattiva**
  lo cancella; in entrambi i casi il vecchio link risponde 404.
