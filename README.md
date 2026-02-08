# Hardware Registry

Monorepo aplikacji do ewidencji sprzętu sieciowego, IoT i infrastruktury.

## Struktura repo

- `backend/` - FastAPI API
- `frontend/` - React + Vite (PWA)
- `deploy/` - dokumentacja wdrożeniowa
- `docs/` - dokumentacja użytkownika

## Uruchomienie lokalne (dev)

Wymagania: Docker + Docker Compose.

```bash
cp .env.example .env
cp compose.example.yml compose.yml
docker compose -f compose.yml --env-file .env up -d --build
```

Sprawdzenie:

```bash
curl -sSf http://localhost:8381/api/health
curl -I http://localhost:8380
```

## Uruchomienie produkcyjne (Traefik)

Konfiguracja dla domeny `sprzed.sh.info.pl` jest przygotowana w szablonach:

- `.env.prod.example`
- `compose.prod.example.yml`

Przygotowanie plików runtime (lokalnie, poza gitem):

```bash
cp .env.prod.example .env.prod
cp compose.prod.example.yml compose.prod.yml
```

Start:

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d --build
```

Szczegóły Traefik: `deploy/traefik.md`.

## Jak korzystać z aplikacji

Instrukcja użytkownika jest w osobnym pliku:

- `docs/USAGE.md`

## Backup / restore Postgres

Backup:

```bash
docker compose -f compose.yml --env-file .env exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup.sql
```

Restore:

```bash
cat backup.sql | docker compose -f compose.yml --env-file .env exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```
