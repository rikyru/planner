#!/usr/bin/env bash
# Installa o aggiorna Planner su un server che ospita già altri container Docker.
#
# Uso, dalla cartella del repository:  ./scripts/deploy.sh
#
# Tocca solo lo stack Compose "planner": non ferma, non rimuove e non riavvia altri container,
# non fa prune di immagini o volumi. Al primo avvio crea .env con una password casuale e porte
# libere; agli avvii successivi riusa .env così com'è.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT=planner
export COMPOSE_PROJECT_NAME=$PROJECT

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERRORE: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker non trovato"
docker compose version >/dev/null 2>&1 || die "serve Docker Compose v2 (comando 'docker compose')"
docker info >/dev/null 2>&1 || die "il demone Docker non risponde (permessi? prova con un utente nel gruppo docker)"

# Un altro stack Compose con lo stesso nome ma in un'altra cartella verrebbe sovrascritto.
other_dir=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" \
  --format '{{.Label "com.docker.compose.project.working_dir"}}' | sort -u | grep -vx "$PWD" || true)
[ -z "$other_dir" ] || die "esiste già uno stack Compose '$PROJECT' in $other_dir: non lo tocco"

port_busy() {
  local port=$1
  # Porte pubblicate da altri container in esecuzione e porte in ascolto sull'host.
  docker ps --format '{{.Label "com.docker.compose.project"}}|{{.Ports}}' | grep -v "^$PROJECT|" \
    | grep -Eq "[:|]$port->" && return 0
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && return 0
  return 1
}

free_port() {
  local port=$1
  while port_busy "$port"; do port=$((port + 1)); done
  echo "$port"
}

set_env() {
  local key=$1 value=$2
  if grep -q "^$key=" .env; then
    sed -i.bak "s|^$key=.*|$key=$value|" .env && rm -f .env.bak
  else
    echo "$key=$value" >> .env
  fi
}

if [ ! -f .env ]; then
  say "Primo avvio: creo .env"
  cp .env.example .env
  set_env POSTGRES_PASSWORD "$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
  app_port=$(free_port 8080)
  share_port=$(free_port $((app_port + 1)))
  set_env APP_PORT "$app_port"
  set_env SHARE_PORT "$share_port"
else
  say "Uso il .env esistente"
  # A stack fermo le porte salvate devono essere ancora libere.
  if [ -z "$(docker compose ps -q 2>/dev/null)" ]; then
    for key in APP_PORT SHARE_PORT; do
      port=$(grep "^$key=" .env | cut -d= -f2)
      [ -z "$port" ] || ! port_busy "$port" || die "$key=$port è già usata da un altro servizio: cambiala in .env"
    done
  fi
fi

mkdir -p data
app_port=$(grep '^APP_PORT=' .env | cut -d= -f2)
share_port=$(grep '^SHARE_PORT=' .env | cut -d= -f2)

say "Costruisco le immagini (la prima volta può richiedere parecchi minuti)"
docker compose build

say "Avvio lo stack $PROJECT"
docker compose up -d

say "Attendo che il backend sia pronto"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$app_port/api/health" >/dev/null 2>&1; then
    docker compose ps
    host=$(hostname -I 2>/dev/null | awk '{print $1}')
    say "Pronto: app su http://${host:-<server>}:$app_port, pagine condivise su porta $share_port"
    exit 0
  fi
  sleep 5
done
docker compose ps
docker compose logs --tail 50 backend
die "il backend non risponde dopo 5 minuti"
