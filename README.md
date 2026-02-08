# Hardware Registry

Monorepo aplikacji do ewidencji sprzętu sieciowego, IoT i infrastruktury.

## Struktura

- `backend/` - FastAPI API
- `frontend/` - React + Vite (PWA-ready)
- `deploy/` - notatki dot. Traefik i security

## Szybki start (lokalnie)

```bash
cp .env.example .env
cp compose.example.yml compose.yml
docker compose -f compose.yml --env-file .env up -d --build
```

## Sprawdzenie działania

```bash
curl -sSf http://localhost:8381/api/health
curl -I http://localhost:8380
```

## Uwagi bezpieczeństwa

- Nie commituj plików `.env`, `compose.yml`, `compose.override.yml`.
- Trzymaj sekrety poza repo.
