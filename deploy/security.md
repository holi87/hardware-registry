# Security notes

## Sekrety i hasła

- Brak sekretów w repo: `compose.yml`, `.env`, klucze i backupy nie trafiają do gita.
- Wi-Fi oraz sekrety urządzeń są zapisywane tylko w formie zaszyfrowanej (`APP_ENCRYPTION_KEY`).
- API listujące Wi-Fi/Secrets nie zwraca plaintext. Odczyt plaintext wyłącznie przez endpointy `reveal`.
- Dostęp do `/api/secrets*` ma tylko rola `ADMIN`.
- Użytkownik `USER` może odsłonić hasło Wi-Fi tylko dla przypisanych rootów (`user_roots`).

## Reset admina

- Endpoint: `POST /api/admin/reset-password`
- Wymaga:
  - zalogowanego `ADMIN`
  - nagłówka `X-Admin-Reset-Key` zgodnego z `ADMIN_RESET_KEY` z `.env`
- Efekt:
  - generowane jest jednorazowe hasło zgodne z polityką
  - konto admina dostaje flagę `must_change_password=true`
- Po użyciu resetu admin loguje się hasłem tymczasowym i **musi** wykonać:
  - `POST /api/auth/change-password`

## Dobre praktyki operacyjne

- Rotuj `JWT_SECRET`, `APP_ENCRYPTION_KEY`, `ADMIN_RESET_KEY`.
- Ogranicz dostęp do portu API wyłącznie przez reverse proxy/VPN.
- Backupy Postgresa szyfruj i trzymaj poza hostem aplikacji.
