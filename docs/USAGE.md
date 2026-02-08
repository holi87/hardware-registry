# Hardware Registry - instrukcja użytkownika

## 1. Pierwsze uruchomienie

1. Wejdź na UI (`http://localhost:8380` lub domena produkcyjna).
2. Jeśli system jest pusty, zobaczysz ekran tworzenia pierwszego administratora.
3. Utwórz konto admina (hasło musi spełniać politykę bezpieczeństwa).

## 2. Logowanie i role

- `ADMIN`:
  - pełna administracja (lokacje, VLAN, Wi-Fi, urządzenia, połączenia, sekrety)
- `USER`:
  - odczyt danych z przypisanych rootów
  - może odsłaniać hasła Wi-Fi tylko dla swoich rootów

Po pierwszym logowaniu może być wymaganie zmiany hasła (`must_change_password`).

## 3. Praca na drzewie lokalizacji

1. Wybierz root (jeśli masz dostęp do wielu).
2. Użyj breadcrumbów i kafli, aby przechodzić po przestrzeniach.
3. Licznik na kaflu pokazuje liczbę urządzeń w danej przestrzeni.

## 4. VLAN

W sekcji VLAN możesz:

- przeglądać VLAN dla bieżącego roota
- dodać nowy VLAN (ADMIN)

## 5. Wi-Fi

W sekcji Wi-Fi możesz:

- filtrować sieci po przestrzeni
- dodać sieć Wi-Fi (ADMIN)
- odsłonić hasło przyciskiem „Pokaż hasło”
- przypisać VLAN (wymagany)

Zasady haseł Wi-Fi:

- lista Wi-Fi nie zwraca haseł plaintext
- odsłonięte hasło automatycznie maskuje się po 30 sekundach
- przy zmianie widoku hasła są maskowane natychmiast

## 6. Urządzenia i interfejsy

1. Wybierz przestrzeń.
2. Dodaj urządzenie przez wizard (ADMIN).
3. Jeśli urządzenie pełni rolę odbiornika/koordynatora, zaznacz to i wybierz technologie (checkboxy).
4. Otwórz szczegóły urządzenia.
5. Dodaj interfejsy (ADMIN).

## 7. Połączenia

W wizardze połączeń wybierasz:

- FROM: urządzenie + interfejs
- TO: urządzenie + interfejs
- technologię połączenia

Obsługiwane technologie:

- ETHERNET
- FIBER
- WIFI
- ZIGBEE
- MATTER_OVER_THREAD
- BLUETOOTH
- BLE
- SERIAL
- OTHER

Dla `ETHERNET` wymagany jest VLAN.

Dla technologii bezprzewodowych wymagających bramki odbiorczej trzeba wskazać odbiornik/koordynator:

- `ZIGBEE` -> odbiornik z capability `supports_zigbee`
- `MATTER_OVER_THREAD` -> odbiornik z capability `supports_matter_thread`
- `BLUETOOTH` -> odbiornik z capability `supports_bluetooth`
- `BLE` -> odbiornik z capability `supports_ble`

## 8. Graf topologii

Widok grafu pozwala:

- filtrować po technologii, przestrzeni i typie urządzenia
- wyszukiwać urządzenie i centruje widok na znalezionym węźle

## 9. Sekrety (ADMIN)

W szczegółach urządzenia sekcja Secrets umożliwia:

- zapis nowego sekretu (hasło/token/API key)
- odsłonięcie wartości tylko przez endpoint reveal

## 10. Szybkie akcje mobilne

Na urządzeniach mobilnych dostępny jest przycisk `+` (sticky FAB), który otwiera szybkie akcje administracyjne.
