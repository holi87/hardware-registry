# Traefik (prod)

Docelowa domena: `sprzet.sh.info.pl`

Założenia:

- tylko router `web` (bez `websecure`)
- bez TLS
- tylko usługa `web` wystawiona do Traefika
- sieć Traefika: `proxy` (external)

## Pliki

- szablon: `compose.prod.example.yml`
- szablon env: `.env.prod.example`
- pliki runtime (lokalnie, poza gitem): `compose.prod.yml`, `.env.prod`

## Szybkie przygotowanie

```bash
cp .env.prod.example .env.prod
cp compose.prod.example.yml compose.prod.yml
```

## Uruchomienie

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d --build
```

W `compose.prod.yml` Traefik używa etykiet:

- `traefik.http.routers.hardware-registry.rule=Host(\`sprzet.sh.info.pl\`)`
- `traefik.http.routers.hardware-registry.entrypoints=web`
- `traefik.http.services.hardware-registry.loadbalancer.server.port=8080`
