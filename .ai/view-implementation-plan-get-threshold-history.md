# API Endpoint Implementation Plan: GET /api/thresholds/history

## 1. Przegląd punktu końcowego
Endpoint umożliwia autoryzowanemu użytkownikowi pobranie historii zmian progów BAC (UserThresholds) wraz z informacją o powodzie zmiany i powiązanej imprezie. Wynik jest paginowany i posortowany malejąco po dacie utworzenia.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/api/thresholds/history`
- Parametry:
  - Wymagane:
    - Nagłówek: `Authorization: Bearer {access_token}`
  - Opcjonalne (query):
    - `page` (integer, domyślnie 1, >=1)
    - `limit` (integer, domyślnie 20, max 100, >=1)
- Request Body: brak

## 3. Wykorzystywane typy
Wszystkie poniższe typy pochodzą z pliku `src/types.ts`:
- `UserThresholdDTO` – pojedynczy rekord progu
- `ThresholdHistoryResponseDTO` – odpowiedź endpointu (lista + paginacja)
- `PaginationMeta` – metadane paginacji
- `APIError` – odpowiedzi błędów
- `ThresholdHistoryQueryParams` – typ do walidacji query params

## 4. Szczegóły odpowiedzi
- 200 OK – Sukces, zwraca:
  ```json
  {
    "data": [
      {
        "id": "bigint",
        "threshold_bac": "decimal",
        "is_current": "boolean",
        "reason": "string",
        "trigger_party_id": "bigint | null",
        "created_at": "timestamp"
      }
    ],
    "pagination": {
      "page": "integer",
      "limit": "integer",
      "total_count": "integer",
      "total_pages": "integer"
    }
  }
  ```
- 401 Unauthorized – Brak lub nieprawidłowy token
- 400 Bad Request – Nieprawidłowe parametry query
- 500 Internal Server Error – Błąd serwera/bazy danych

## 5. Przepływ danych
1. Autoryzacja: Weryfikacja tokena JWT (Supabase Auth) i pobranie user_id z kontekstu.
2. Walidacja parametrów query (`page`, `limit`) przez Zod (`ThresholdHistoryQueryParams`).
3. Wywołanie serwisu (np. `threshold.service.ts`): pobranie UserThresholds dla user_id, sortowanie po `created_at` DESC, paginacja.
4. Zmapowanie wyników do DTO i przygotowanie metadanych paginacji.
5. Zwrócenie odpowiedzi 200 z danymi i paginacją.
6. Obsługa błędów: odpowiednie kody i komunikaty.

## 6. Względy bezpieczeństwa
- Wymagany ważny token JWT (Supabase Auth).
- RLS w tabeli UserThresholds – użytkownik widzi tylko swoje rekordy.
- Walidacja wejścia: ograniczenie `limit` (max 100), `page` >= 1.
- user_id pobierany z tokena, nie z query.
- Brak podatności na body injection (brak body).

## 7. Obsługa błędów
- 401 Unauthorized: Brak/nieprawidłowy token – zwróć `APIError`.
- 400 Bad Request: Nieprawidłowe parametry query – walidacja Zod, zwróć `APIError`.
- 500 Internal Server Error: Błąd bazy lub nieoczekiwany wyjątek – loguj przez logger, zwróć generyczny komunikat.
- Brak danych: Zwróć pustą listę, nie błąd.

## 8. Rozważania dotyczące wydajności
- Paginacja: limit max 100 rekordów na żądanie.
- Indeksowanie: kolumny `user_id` i `created_at` powinny być zaindeksowane (standard w Supabase).
- Pobieraj tylko wymagane kolumny.
- Brak joinów – proste zapytanie po user_id.

## 9. Etapy wdrożenia
1. Dodaj walidację query params (Zod) w pliku endpointu.
2. Zaimplementuj/uzupełnij funkcję w serwisie `threshold.service.ts` do pobierania historii progów z paginacją.
3. W endpointcie:
   - Pobierz user_id z kontekstu (autoryzacja Supabase).
   - Zweryfikuj i sparsuj parametry query.
   - Wywołaj serwis z user_id, page, limit.
   - Zmapuj wynik do DTO.
   - Zwróć odpowiedź 200 z danymi i paginacją.
4. Obsłuż błędy:
   - Brak tokena → 401
   - Nieprawidłowe parametry → 400
   - Błąd serwera → 500 (loguj przez logger)
5. Zweryfikuj RLS w tabeli UserThresholds (tylko własne rekordy).
6. Zaktualizuj dokumentację API, jeśli to konieczne.
