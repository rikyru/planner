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

Servizi:

| Servizio | Ruolo |
| --- | --- |
| `postgres` | PostgreSQL 16 + PostGIS, volume `pgdata` |
| `backend` | FastAPI su `:8000` (solo rete interna), foto in `./data` |
| `frontend` | nginx: serve la SPA React e fa da proxy per `/api` |

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

## Sicurezza e accesso

L'MVP **non ha login**: chiunque raggiunga l'app può modificare i viaggi. Tienila nella rete di
casa o dietro una VPN (es. Tailscale). Le pagine `/share/<token>` sono pensate per essere
pubbliche: se vuoi esporle su internet, pubblica dal reverse proxy solo `/share/`, `/assets/` e
`/api/share/`.

## Server: Mac mini 2015

L'immagine PostGIS ufficiale è x86 e funziona sul Mac mini (i5). Le versioni recenti di Docker
Desktop non supportano più macOS 12 Monterey, l'ultimo disponibile per quel modello. Opzioni:

1. installare Linux (es. Ubuntu Server LTS) sul Mac mini e usare Docker Engine (consigliato);
2. restare su macOS e usare [Colima](https://github.com/abiosoft/colima) come runtime Docker.

## Backup

- Database: `docker compose exec postgres pg_dump -U planner planner > backup.sql`
- Foto: copia della cartella `./data`

## Test

```bash
docker compose exec backend pytest
```
