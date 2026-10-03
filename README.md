# Planner

Webapp self-hosted per **pianificare**, **vivere** e **ricostruire** itinerari di viaggio, con una
pagina di condivisione in stile travel journal. Gira interamente in locale (server domestico/NAS)
con Docker Compose.

Il documento di progettazione è in [`docs/design.md`](docs/design.md).

## Avvio rapido

```bash
cp .env.example .env        # imposta almeno POSTGRES_PASSWORD
docker compose up -d
```

L'app è su `http://<server>:8080` (porta `APP_PORT`). Al primo avvio il backend applica le
migrazioni Alembic.

Viaggio demo (7 giorni a New York, in modalità ricostruzione):

```bash
docker compose exec backend python -m seed.load            # lo crea se manca
docker compose exec backend python -m seed.load --replace  # lo ricrea da zero
```

Servizi:

| Servizio | Ruolo |
| --- | --- |
| `postgres` | PostgreSQL 16 + PostGIS, volume `pgdata` |
| `backend` | FastAPI su `:8000` (solo rete interna), foto in `./data` |
| `frontend` | nginx: app completa su `APP_PORT` (8080), solo diari condivisi su `SHARE_PORT` (8081) |

## Sviluppo

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Frontend Vite con hot reload: http://localhost:5173
- Backend con `--reload`: http://localhost:8000/api/docs
- PostgreSQL esposto su `localhost:5432`

Senza Docker per il backend (Python 3.12):

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL=postgresql+psycopg://planner:<password>@localhost:5432/planner DATA_DIR=../data
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend: `cd frontend && npm install && npm run dev` (proxy `/api` verso `localhost:8000`).

## Configurazione

Tutto passa da `.env` (vedi `.env.example`); nessuna credenziale è scritta nel codice.

- **Mappa**: `MAP_STYLE_URL` è uno style JSON MapLibre. Default OpenFreeMap (gratuito, senza
  chiave). Il frontend lo legge a runtime da `/api/config`, quindi cambiarlo non richiede rebuild.
- **Geocoding**: `GEOCODER=photon` (default, adatto alla ricerca mentre si digita) oppure
  `nominatim`. Con Nominatim imposta `GEOCODER_USER_AGENT` con un tuo contatto, come richiesto
  dalla loro policy.

## Foto

- Upload multiplo da timeline, scheda tappa o vista **Foto** (JPEG, HEIC, PNG, WebP; max 60 MB
  a file). Gli originali restano intatti in `data/photos/<viaggio>/originals/`; il backend genera
  due varianti WebP ruotate e senza metadati (`thumbs/` 480 px, `display/` 1920 px).
- Dagli EXIF vengono letti data/ora di scatto e posizione GPS. I doppioni (stesso file nello stesso
  viaggio) vengono riconosciuti e non duplicati.
- L'associazione a giorno e tappa è manuale. Il pulsante **Assegna per data di scatto** mette le
  foto senza giorno nella giornata della loro data, senza toccare quelle già associate.
- La copertina si sceglie dalla foto aperta; senza scelta si usa la prima foto scattata.

## Condivisione

Da **Condividi** (nella scheda del viaggio o nella pagina del viaggio) si crea un link
`/share/<token>` con un token casuale non indovinabile. La pagina è un diario in sola lettura:
giornate, tappe, mappa e foto assegnate a una giornata. Non espone EXIF, coordinate delle foto né
file originali, e chiede ai motori di ricerca di non indicizzarla. **Nuovo link** invalida quello
precedente, **Disattiva** lo revoca.

## Sicurezza e accesso

L'MVP **non ha login**: chiunque raggiunga la porta dell'app (`APP_PORT`) può modificare i
viaggi. Tienila nella rete di casa o dietro una VPN (es. Tailscale).

Per far vedere un diario a chi è fuori casa, esponi **solo** `SHARE_PORT` (8081), per esempio con
un reverse proxy, Cloudflare Tunnel o Tailscale Funnel, e imposta `PUBLIC_BASE_URL` con
l'indirizzo pubblico, così i link copiati puntano lì. Su quella porta esistono solo
`/share/<token>`, le relative API in sola lettura e i file statici: l'editor e le API di modifica
rispondono 404.

## Server: Mac mini 2015

L'immagine PostGIS ufficiale è x86 e funziona sul Mac mini (i5). Le versioni recenti di Docker
Desktop non supportano più macOS 12 Monterey, l'ultimo disponibile per quel modello. Opzioni:

1. installare Linux (es. Ubuntu Server LTS) sul Mac mini e usare Docker Engine (consigliato);
2. restare su macOS e usare [Colima](https://github.com/abiosoft/colima) come runtime Docker.

## Backup

- Database: `docker compose exec postgres pg_dump -U planner planner > backup.sql`
- Foto: copia della cartella `./data` (originali e varianti; le varianti si rigenerano da sole se
  mancano)

## Test

```bash
docker compose exec backend pytest
```

I test girano su un database `planner_test` creato al volo sullo stesso PostgreSQL (con le
migrazioni Alembic) e coprono viaggi e giorni, tappe e riordino, foto (EXIF, miniature,
associazione) e link di condivisione.

Frontend: `cd frontend && npm run typecheck && npm run lint`. Dopo aver cambiato le API,
`npm run gen:api` rigenera i tipi TypeScript dallo schema OpenAPI del backend in esecuzione.
