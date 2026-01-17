# API Endpoint Implementation Plan: GET /api/parties/:partyId/alerts

## 1. Przegląd punktu końcowego
Endpoint służy do pobierania aktywnych alertów (`is_active = true`) dla wybranej imprezy (`partyId`) należącej do zalogowanego użytkownika. Umożliwia frontendowi cykliczne odpytywanie o aktualne alerty związane z przekroczeniem lub zbliżaniem się do progu BAC podczas trwania imprezy.

## 2. Szczegóły żądania
- **Metoda HTTP:** GET
- **Struktura URL:** `/api/parties/:partyId/alerts`
- **Parametry:**
  - **Wymagane:**
    - `partyId` (path, bigint) – identyfikator imprezy
    - `Authorization: Bearer {access_token}` (header) – token JWT użytkownika
  - **Opcjonalne:** brak
- **Request Body:** brak

## 3. Wykorzystywane typy
Wszystkie poniższe typy należy importować z pliku `src/types.ts`:

- **DTOs:**
  - `PartyAlertsResponseDTO` (zawiera: `party_id: bigint`, `alerts: AlertDTO[]`)
  - `AlertDTO` (zawiera: `id`, `alert_type`, `is_active`, `bac_at_alert`, `triggered_at`, `last_alert_sent_at`)
- **Enumy:**
  - `AlertType` (`approaching_threshold`, `exceeded_threshold`)

## 4. Szczegóły odpowiedzi
- **Sukces (200 OK):**
  ```json
  {
    "party_id": "bigint",
    "alerts": [
      {
        "id": "bigint",
        "alert_type": "approaching_threshold | exceeded_threshold",
        "is_active": true,
        "bac_at_alert": "decimal",
        "triggered_at": "timestamp",
        "last_alert_sent_at": "timestamp"
      }
    ]
  }
  ```
- **Błędy:**
  - 401 Unauthorized – brak lub nieprawidłowy token
  - 403 Forbidden – impreza nie należy do użytkownika
  - 404 Not Found – impreza nie istnieje
  - 500 Internal Server Error – błąd serwera

## 5. Przepływ danych
1. **Autoryzacja:** Pobranie i weryfikacja tokena JWT (Supabase Auth).
2. **Walidacja partyId:** Sprawdzenie, czy partyId jest liczbą całkowitą >0.
3. **Pobranie imprezy:** Zapytanie do tabeli `Parties` po partyId i userId (z tokena).
   - Jeśli impreza nie istnieje → 404.
   - Jeśli impreza nie należy do użytkownika → 403.
4. **Pobranie alertów:** Zapytanie do tabeli `Alerts` po partyId, userId i `is_active = true`.
5. **Mapowanie do DTO:** Przekształcenie wyników do `AlertDTO[]`.
6. **Zwrócenie odpowiedzi:** Zwrócenie obiektu `PartyAlertsResponseDTO` z kodem 200.
7. **Obsługa błędów:** Zwrócenie odpowiednich kodów i komunikatów w przypadku błędów.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie:** Wymagany ważny token JWT (Supabase Auth).
- **Autoryzacja:** Sprawdzenie, czy partyId należy do użytkownika (userId z tokena = userId imprezy).
- **RLS:** Dodatkowe zabezpieczenie na poziomie bazy (Supabase RLS).
- **Walidacja danych wejściowych:** partyId musi być poprawnym bigintem.
- **Brak ujawniania cudzych danych:** Zwracane są tylko alerty powiązane z partyId i userId.
- **Brak SQL Injection:** Użycie query buildera Supabase.

## 7. Obsługa błędów
- **401 Unauthorized:** Brak lub nieprawidłowy token JWT.
- **403 Forbidden:** Użytkownik próbuje uzyskać dostęp do imprezy, która nie należy do niego.
- **404 Not Found:** Impreza o podanym partyId nie istnieje.
- **500 Internal Server Error:** Błąd serwera, np. błąd bazy danych.
- **Logowanie błędów:** Błędy serwera logowane przez `lib/logger.ts` (bez ujawniania szczegółów klientowi).

## 8. Rozważania dotyczące wydajności
- **Indeksy:** party_id, user_id oraz is_active w tabeli `Alerts` powinny być zaindeksowane.
- **Limitowanie:** Zazwyczaj liczba aktywnych alertów na imprezę jest niska (1-2), więc nie ma potrzeby paginacji.
- **Optymalizacja zapytań:** Pobieranie tylko wymaganych pól.
- **Bez zbędnych joinów:** partyId i userId są denormalizowane w tabeli Alerts.

## 9. Etapy wdrożenia
1. **Analiza i przygotowanie DTO:** Zweryfikuj i ewentualnie rozszerz typy `AlertDTO` i `PartyAlertsResponseDTO` w `src/types.ts`.
2. **Implementacja serwisu:** Dodaj/uzupełnij funkcję w `src/lib/services/alert.service.ts` do pobierania aktywnych alertów po partyId i userId.
3. **Walidacja wejścia:** Zaimplementuj walidację partyId (bigint, >0) oraz autoryzację użytkownika.
4. **Implementacja endpointu:** Utwórz plik `src/pages/api/parties/[id]/alerts.ts` (lub odpowiedni) i zaimplementuj handler GET.
5. **Obsługa błędów:** Zaimplementuj obsługę błędów zgodnie z sekcją 7.
6. **Weryfikacja RLS:** Upewnij się, że polityki RLS w Supabase nie pozwalają na dostęp do cudzych alertów.
7. **Code review i refaktoryzacja:** Przegląd kodu pod kątem bezpieczeństwa, wydajności i zgodności z konwencjami projektu.
8. **Dokumentacja:** Uzupełnij dokumentację endpointu i typów.
