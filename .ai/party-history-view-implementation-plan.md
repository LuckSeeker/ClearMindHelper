# Plan implementacji widoku Historia imprez

## 1. Przegląd
Widok „Historia imprez” umożliwia użytkownikowi przeglądanie wszystkich zakończonych i trwających imprez, analizę wzorców picia oraz podgląd szczegółów każdej imprezy (w tym napojów, BAC, alertów i snapshotu profilu). Celem jest zapewnienie czytelnej, dostępnej i responsywnej prezentacji historii oraz szczegółów imprez, z możliwością ręcznego odświeżania i paginacji.

## 2. Routing widoku
Ścieżka: `/party/history`
Widok powinien być dostępny pod powyższym adresem jako osobna strona.

## 3. Struktura komponentów
- **PartyHistoryPage** – główny kontener widoku historii imprez.
  - **PartyHistoryTable** – tabela z listą imprez (data, suma alkoholu, max BAC, blackout, podgląd napojów).
    - **DrinkPreviewList** – lista podglądu napojów (ikony/miniatury).
    - **Pagination** – komponent do zmiany strony.
  - **PartyDetailModal** (lub Panel) – modal/panel ze szczegółami wybranej imprezy (tabela napojów, snapshot profilu, BAC, alerty).
  - **RefreshButton** – przycisk ręcznego odświeżania danych.
  - **Alert/Toast** – komunikaty o błędach, braku danych itp.

## 4. Szczegóły komponentów
### PartyHistoryPage
- **Opis:** Kontener strony, zarządza stanem, pobiera dane, obsługuje paginację, odświeżanie, wybór imprezy.
- **Główne elementy:** PartyHistoryTable, PartyDetailModal, RefreshButton, Alert/Toast.
- **Interakcje:** Zmiana strony, odświeżanie, wybór imprezy, zamknięcie modala.
- **Walidacja:** Sprawdza obecność danych, obsługuje błędy API.
- **Typy:** PartyListResponseDTO, PartyListItemDTO, PartyDetailDTO.
- **Propsy:** Brak (strona).

### PartyHistoryTable
- **Opis:** Wyświetla tabelę imprez z kluczowymi danymi i podglądem napojów.
- **Główne elementy:** <table>, DrinkPreviewList, przyciski paginacji.
- **Interakcje:** Kliknięcie w wiersz – otwarcie szczegółów imprezy.
- **Walidacja:** Sprawdza, czy lista nie jest pusta.
- **Typy:** PartyListItemDTO, PartyHistoryTableRowVM.
- **Propsy:** parties: PartyListItemDTO[], onSelect: (partyId: number) => void, pagination, loading.

### DrinkPreviewList
- **Opis:** Wyświetla podgląd pierwszych 3 napojów w imprezie (ikony/miniatury/krótkie info).
- **Główne elementy:** <ul> lub <div> z ikonami/skrótami napojów.
- **Interakcje:** Brak (tylko podgląd).
- **Walidacja:** Brak.
- **Typy:** DrinkPreview[].
- **Propsy:** drinks: DrinkPreview[].

### PartyDetailModal (lub Panel)
- **Opis:** Modal lub panel boczny ze szczegółami wybranej imprezy: tabela napojów, snapshot profilu, BAC, alerty.
- **Główne elementy:** <dialog>/<aside>, tabela napojów, sekcja profilu, lista alertów.
- **Interakcje:** Zamknięcie modala, przewijanie.
- **Walidacja:** Sprawdza obecność szczegółów, obsługuje błędy ładowania.
- **Typy:** PartyDetailDTO, PartyDetailVM.
- **Propsy:** partyId: number, open: boolean, onClose: () => void.

### RefreshButton
- **Opis:** Przycisk do ręcznego odświeżania danych.
- **Główne elementy:** <button> z ikoną.
- **Interakcje:** Kliknięcie – ponowne pobranie danych.
- **Walidacja:** Brak.
- **Typy:** Brak.
- **Propsy:** onClick: () => void, loading: boolean.

### Pagination
- **Opis:** Komponent do zmiany strony w historii.
- **Główne elementy:** <nav> z przyciskami/stronicowaniem.
- **Interakcje:** Kliknięcie w numer strony/strzałki.
- **Walidacja:** Sprawdza zakres stron.
- **Typy:** { page: number, total_pages: number }
- **Propsy:** page, totalPages, onPageChange: (page: number) => void.

### Alert/Toast
- **Opis:** Komunikaty o błędach, braku danych, nieautoryzacji.
- **Główne elementy:** <div> lub toast z tekstem.
- **Interakcje:** Zamknięcie/auto-hide.
- **Walidacja:** Brak.
- **Typy:** { message: string, type: "error" | "info" }
- **Propsy:** message, type, onClose.

## 5. Typy
- **PartyListResponseDTO** – z types.ts, cała odpowiedź z API.
- **PartyListItemDTO** – pojedyncza impreza w liście.
- **DrinkPreview** – podgląd napoju (id, volume_ml, abv_percent, consumed_at).
- **PartyDetailDTO** – szczegóły imprezy (drinks, profile_snapshot, current_bac, active_alerts).
- **PartyHistoryTableRowVM** (ViewModel): { id, started_at, ended_at, status, bac_estimate_max, total_drinks_count, total_ml_consumed, blackout_marked, drinks_preview }
- **PartyDetailVM**: { drinks, profile_snapshot, bac_before, bac_after, alerts }
- **PaginationMeta**: { page, limit, total_count, total_pages }

## 6. Zarządzanie stanem
- **parties**: lista imprez (PartyListItemDTO[])
- **pagination**: { page, limit, total_count, total_pages }
- **loading**: boolean (czy trwa ładowanie)
- **error**: string | null (błąd API)
- **refreshing**: boolean (czy trwa odświeżanie)
- **selectedPartyId**: number | null (wybrana impreza)
- **selectedPartyDetail**: PartyDetailDTO | null (szczegóły imprezy)
- **showDetailModal**: boolean (czy modal otwarty)
- **Custom hooki:**
  - usePartyHistory – pobieranie, cache, paginacja, odświeżanie
  - usePartyDetail – pobieranie szczegółów imprezy

## 7. Integracja API
- **GET /api/parties** – pobiera listę imprez, obsługuje paginację, sortowanie, status.
  - Query params: page, limit, status, sort, order
  - Odpowiedź: PartyListResponseDTO
- **GET /api/parties/:id** (do szczegółów, jeśli istnieje)
  - Odpowiedź: PartyDetailDTO
- **Obsługa tokenu autoryzacji** – Authorization: Bearer {access_token}
- **Obsługa błędów 400/401/500** – wyświetlanie komunikatów

## 8. Interakcje użytkownika
- Kliknięcie w wiersz tabeli – otwiera szczegóły imprezy w modalu/panelu
- Kliknięcie RefreshButton – odświeża listę imprez
- Zmiana strony – pobiera kolejną stronę
- Zamknięcie modala – ukrywa szczegóły imprezy
- Obsługa błędów – wyświetla Alert/Toast

## 9. Warunki i walidacja
- Sprawdzenie obecności imprez (jeśli brak – komunikat)
- Walidacja parametrów paginacji (page >= 1, limit 1–100)
- Walidacja statusu, sortowania (wg API)
- Sprawdzenie autoryzacji (brak tokenu – przekierowanie/logowanie)
- Walidacja obecności szczegółów imprezy (jeśli brak – komunikat)

## 10. Obsługa błędów
- Brak imprez – wyświetlenie komunikatu „Brak zarejestrowanych imprez”
- Błąd API (400/401/500) – Alert/Toast z treścią błędu
- Błąd ładowania szczegółów imprezy – komunikat w modalu
- Błąd autoryzacji – przekierowanie do logowania lub wylogowanie
- Obsługa edge cases (np. pusta lista, brak napojów)

## 11. Kroki implementacji
1. Utwórz trasę `/party/history` w Astro i główny komponent PartyHistoryPage.
2. Zaimplementuj hook usePartyHistory do pobierania i buforowania listy imprez (z paginacją, obsługą błędów, loading, refreshing).
3. Zaimplementuj komponent PartyHistoryTable z obsługą kliknięcia w wiersz, paginacji i podglądu napojów (DrinkPreviewList).
4. Dodaj komponent RefreshButton do ręcznego odświeżania danych.
5. Zaimplementuj modal/panel PartyDetailModal z hookiem usePartyDetail do pobierania szczegółów imprezy.
6. Dodaj Alert/Toast do obsługi błędów i komunikatów.
7. Zapewnij responsywność i dostępność (a11y) – role, aria, focus, obsługa klawiatury.
8. Przetestuj warunki brzegowe: brak imprez, błędy API, brak szczegółów.
9. Zadbaj o zgodność z PRD i user stories (US-009).
