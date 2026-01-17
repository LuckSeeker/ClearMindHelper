# API Endpoint Implementation Plan: PUT /api/thresholds/current

## 1. Przegląd punktu końcowego
Endpoint umożliwia użytkownikowi ręczne nadpisanie bieżącego progu BAC. Po otrzymaniu żądania z nową wartością progu, system tworzy nowy rekord progu z powodem 'manual_override', ustawia go jako bieżący, dezaktywuje poprzedni oraz rejestruje zdarzenie 'threshold_adjusted'.

## 2. Szczegóły żądania
- Metoda HTTP: PUT
- Struktura URL: `/api/thresholds/current`
- Nagłówki:
  - `Authorization: Bearer {access_token}` (wymagany)
- Parametry:
  - Wymagane: 
    - `threshold_bac` (decimal, większy od 0)
  - Opcjonalne: brak
- Request Body:
  ```json
  {
    "threshold_bac": 0.10
  }
  ```

## 3. Wykorzystywane typy

**Typy z `src/types.ts`:**
- `UpdateThresholdCommand` (request)
- `UserThresholdDTO` (response)
- `ThresholdReason` (enum)
- `APIError`, `ValidationWarningResponse` (error)

**Struktura typów:**
- **Request:** `UpdateThresholdCommand`
  - `threshold_bac: number`
- **Response:** `UserThresholdDTO`
  - `id: number`
  - `threshold_bac: number`
  - `is_current: boolean`
  - `reason: ThresholdReason` (manual_override)
  - `created_at: string`
- **Error:** `APIError`, `ValidationWarningResponse`

## 4. Szczegóły odpowiedzi
- **200 OK** (sukces):
  ```json
  {
    "id": 123,
    "threshold_bac": 0.10,
    "is_current": true,
    "reason": "manual_override",
    "created_at": "2026-01-17T12:00:00Z"
  }
  ```
- **400 Bad Request**: Nieprawidłowa wartość threshold_bac
- **401 Unauthorized**: Brak lub nieprawidłowy token
- **404 Not Found**: Brak profilu użytkownika
- **500 Internal Server Error**: Błąd serwera

## 5. Przepływ danych
1. Użytkownik wysyła żądanie PUT z nowym progiem BAC.
2. Middleware weryfikuje token i pobiera user_id.
3. Walidacja danych wejściowych (Zod).
4. Service (`threshold.service.ts`):
   - Tworzy nowy rekord w `UserThresholds` z `is_current=true`, `reason='manual_override'`.
   - Ustawia poprzedni rekord progu na `is_current=false`.
   - Loguje event w tabeli `Events` (`event_type='threshold_adjusted'`).
5. Zwraca nowy rekord progu jako DTO.

## 6. Względy bezpieczeństwa
- Wymagana autoryzacja (Bearer token, Supabase).
- Sprawdzenie uprawnień użytkownika (user_id z tokena).
- Ochrona przed SQL Injection (Supabase SDK).
- Walidacja zakresu threshold_bac.
- Ograniczenie do jednego aktywnego progu na użytkownika.

## 7. Obsługa błędów
- **400**: Walidacja threshold_bac (poza zakresem, brak wartości).
- **401**: Brak/nieprawidłowy token.
- **404**: Brak profilu użytkownika.
- **500**: Błąd serwera, logowanie w `lib/logger.ts`.

## 8. Rozważania dotyczące wydajności
- Operacje na progu i eventach w jednej transakcji (jeśli obsługiwane przez Supabase).
- Indeksy na `user_id`, `is_current` w `UserThresholds` dla szybkiego dostępu.
- Minimalizacja liczby zapytań (batch update).

## 9. Etapy wdrożenia
1. Utwórz/rozszerz Zod schema walidującą request body.
2. Dodaj handler PUT w `src/pages/api/thresholds/current.ts`.
3. Wykorzystaj middleware do weryfikacji tokena i pobrania user_id.
4. Dodaj metodę w `threshold.service.ts` do obsługi logiki biznesowej.
5. Zaimplementuj aktualizację poprzedniego progu (is_current=false).
6. Dodaj logikę rejestracji eventu 'threshold_adjusted' w tabeli `Events`.
7. Zwróć odpowiedni DTO lub obsłuż błąd zgodnie z kodem statusu.
8. Zaktualizuj dokumentację API.
