# Hardware Registry - instrukcja użytkownika

## 1. Pierwsze uruchomienie

1. Wejdź na UI (`http://localhost:8380` albo domena produkcyjna).
2. Jeśli baza jest pusta, pojawi się ekran **Utwórz admina**.
3. Ustaw konto administratora (hasło: min. 12 znaków + duża/mała/cyfra/znak specjalny).

## 2. Układ aplikacji

Po zalogowaniu aplikacja działa w układzie menu z osobnymi podstronami:

- **Rooty**: rooty i przestrzenie
- **Sieciowe**:
  - VLAN - przegląd
  - VLAN - dodawanie
  - Wi-Fi - przegląd
  - Wi-Fi - dodawanie
- **Urządzenia**:
  - Urządzenia - przegląd
  - Urządzenia - dodawanie
- **Topologia**:
  - generowanie PNG na żądanie
- **Użytkownicy** (tylko ADMIN):
  - przegląd i edycja
  - dodawanie

## 3. Rooty i przestrzenie (ADMIN)

W podstronie **Rooty i przestrzenie** możesz:

- dodać nowy root,
- usunąć root (kasuje też dane podrzędne roota),
- dodawać przestrzenie w drzewie lokalizacji.

## 4. VLAN

Dla VLAN zapisujesz:

- VLAN ID,
- nazwę,
- maskę,
- zakres IP start/end,
- notatki.

## 5. Wi-Fi

- Wi-Fi zawsze jest przypisane do przestrzeni i VLAN.
- Lista nie zwraca haseł plaintext.
- „Pokaż” odsłania hasło na 30 sekund.

## 6. Urządzenia

Dodajesz urządzenia z przypisaniem do przestrzeni.

Jeśli urządzenie jest odbiornikiem/koordynatorem, możesz zaznaczyć capability:

- Wi-Fi
- Ethernet
- Zigbee
- Matter over Thread
- Bluetooth
- BLE

## 7. Topologia PNG

Podstrona topologii generuje statyczny obraz PNG na żądanie dla aktywnego roota.

## 8. Użytkownicy i rooty (ADMIN)

Admin może:

- tworzyć użytkowników,
- edytować rolę, aktywność i przypisanie rootów,
- ustawiać nowe hasło użytkownika (z wymuszeniem zmiany przy logowaniu).

Zasada RBAC:

- **ADMIN**: pełny CRUD
- **USER**: odczyt tylko dla przypisanych rootów
