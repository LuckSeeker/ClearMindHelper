# API Endpoint Implementation Plan: Log Event (`POST /api/events`)

## 1. Przegląd punktu końcowego
Punkt końcowy służy do rejestrowania zdarzeń telemetrycznych (analityka, auditing) w systemie. Jest wykorzystywany wyłącznie wewnętrznie przez backend, nie jest eksponowany bezpośrednio do frontendu. Każde wywołanie zapisuje minimalny zestaw danych o zdarzeniu, automatycznie przypisując je do zalogowanego użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: **POST**
- Struktura URL: `/api/events`
- Nagłówki:
  - `Authorization: Bearer {access_token}` (wymagany, JWT Supabase)
- Request Body (JSON):
  - Wymagane:
    - `event_type`: string (dozwolone wartości: drink_added, drink_edited, party_started, party_closed, blackout_marked, threshold_adjusted, fast_consumption_warning)
  - Opcjonalne:
    - `party_id`: bigint (jeśli zdarzenie dotyczy imprezy)

## 3. Wykorzystywane typy
**DTOs i typy:**
  - `LogEventCommand` *(do utworzenia, jeśli nie istnieje w types.ts)*
  - `EventDTO` *(zdefiniowany w types.ts)*
  - `APIError` *(zdefiniowany w types.ts)*
**ENUMs:**
  - `EventType` *(zdefiniowany w types.ts)*

## 4. Szczegóły odpowiedzi
- Sukces (201 Created):
  ```json
  {
    "id": "bigint",
    "event_type": "string",
    "created_at": "timestamp"
  }
  ```
- Błędy:
  - 400 Bad Request: Nieprawidłowy event_type, party_id nie należy do użytkownika
  - 401 Unauthorized: Brak lub nieprawidłowy token
  - 404 Not Found: party_id nie istnieje (jeśli podany)
  - 500 Internal Server Error: Błąd serwera

## 5. Przepływ danych
1. Backend odbiera żądanie POST z JWT w nagłówku.
2. Waliduje JWT i pobiera user_id z kontekstu autoryzacji (Supabase).
3. Waliduje event_type względem dozwolonych wartości ENUM.
4. Jeśli podano party_id:
   - Sprawdza, czy impreza istnieje i należy do użytkownika.
5. Tworzy nowy rekord w tabeli Events:
   - `user_id`: z JWT
   - `party_id`: z request body (lub null)
   - `event_type`: z request body
   - `created_at`: timestamp
6. Zwraca EventDTO z danymi nowego zdarzenia.

## 6. Względy bezpieczeństwa
- Wymagana autoryzacja JWT (Supabase Auth).
- RLS na tabeli Events (user_id = auth.uid()).
- party_id musi należeć do użytkownika (weryfikacja przed zapisem).
- Brak możliwości logowania eventów dla innych użytkowników.
- Brak event_data JSONB – minimalizacja ryzyka wycieku danych.

## 7. Obsługa błędów
- 400: Nieprawidłowy event_type, party_id nie należy do użytkownika.
- 401: Brak lub nieprawidłowy token.
- 404: party_id nie istnieje (jeśli podany).
- 500: Błąd serwera (np. problem z bazą).
- Błędy zwracane w formacie APIError.

## 8. Rozważania dotyczące wydajności
- Minimalna telemetria – brak event_data JSONB, tylko kluczowe dane.
- party_id nullable – nie wymaga dodatkowych JOINów przy braku powiązania.
- Wstawianie do tabeli Events nie powinno generować istotnych opóźnień.
- RLS i walidacja party_id mogą wymagać dodatkowego zapytania, ale nie są krytyczne wydajnościowo.

## 9. Etapy wdrożenia
1. Utwórz/zweryfikuj typy DTO i Command Modele (`LogEventCommand`, `EventDTO`, `EventType`).
2. Dodaj/zweryfikuj walidację wejścia (Zod schema dla event_type, party_id).
3. Wyodrębnij logikę rejestracji zdarzenia do serwisu (`event.service.ts`).
4. Zaimplementuj endpoint w pliku `src/pages/api/events.ts`:
   - Obsługa metody POST
   - Walidacja JWT i pobieranie user_id z kontekstu
   - Walidacja event_type i party_id
   - Zapis do bazy (Supabase, tabela Events)
   - Zwracanie EventDTO lub APIError
5. Przetestuj scenariusze sukcesu i błędów (400, 401, 404, 500).
6. Zweryfikuj zgodność z RLS i politykami bezpieczeństwa.
7. Przeprowadź code review pod kątem zgodności z zasadami implementacji i czystego kodu.
8. Zaktualizuj dokumentację API i README.

