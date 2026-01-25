# Plan implementacji widoku Globalne Powiadomienia i Alerty

## 1. Przegląd
Widok globalnych powiadomień i alertów odpowiada za informowanie użytkownika o krytycznych i kontekstowych zdarzeniach w aplikacji, takich jak alerty BAC (zbliżenie/przekroczenie progu), błędy API oraz ostrzeżenia walidacji. System powiadomień musi być widoczny na wszystkich widokach, umożliwiać szybkie reagowanie użytkownika, być czytelny, dostępny i zgodny z wymaganiami a11y.

## 2. Routing widoku
Komponent globalnych powiadomień jest osadzony na najwyższym poziomie layoutu aplikacji (`src/layouts/Layout.astro`), dzięki czemu jest widoczny na wszystkich podstronach i widokach.

## 3. Struktura komponentów
- **GlobalAlertsProvider** – kontekst i logika zarządzania powiadomieniami, otacza całą aplikację.
  - **ToastContainer** – wyświetla kolejkę toastów (info/warning/error).
  - **AlertModal** – modal dla krytycznych alertów (np. przekroczenie progu BAC).
  - **InlineError** – komponent do wyświetlania błędów w kontekście formularza (np. walidacja).

## 4. Szczegóły komponentów
### GlobalAlertsProvider
- **Opis:** Dostarcza kontekst i API do zarządzania powiadomieniami (dodawanie, usuwanie, deduplikacja, obsługa timeoutów).
- **Główne elementy:** React Context, useReducer/useState, children, ToastContainer, AlertModal.
- **Obsługiwane interakcje:** Dodanie/usunięcie powiadomienia, deduplikacja, autoClose, przekazanie alertów do dzieci.
- **Walidacja:** Deduplikacja alertów po id/alert_type, limit kolejki.
- **Typy:** `GlobalAlertViewModel`, `ToastViewModel`, `ModalAlertViewModel`.
- **Propsy:** children (ReactNode)

### ToastContainer
- **Opis:** Wyświetla toast/snackbar z powiadomieniami typu info/warning/error.
- **Główne elementy:** Lista toastów, animacje, przycisk zamknięcia, aria-live.
- **Obsługiwane interakcje:** Zamknięcie toastu (X), autoClose, kliknięcie w akcję.
- **Walidacja:** Maksymalna liczba toastów, autoClose po czasie.
- **Typy:** `ToastViewModel`
- **Propsy:** `toasts: ToastViewModel[]`, `onClose: (id) => void`

### AlertModal
- **Opis:** Modal dla krytycznych alertów (np. exceeded_threshold), blokuje interakcję do zamknięcia/potwierdzenia.
- **Główne elementy:** Tytuł, treść, akcje (przycisk zamknięcia/potwierdzenia), aria-modal, focus trap.
- **Obsługiwane interakcje:** Zamknięcie modal (X, przycisk), akcje naprawcze.
- **Walidacja:** Modal wyświetlany tylko dla alertów typu exceeded_threshold.
- **Typy:** `ModalAlertViewModel`
- **Propsy:** `alert: ModalAlertViewModel | null`, `onClose: () => void`

### InlineError
- **Opis:** Komponent do wyświetlania błędów w kontekście formularza (np. walidacja, błędy API).
- **Główne elementy:** Tekst błędu, ikona, aria-live.
- **Obsługiwane interakcje:** Zamknięcie błędu (opcjonalnie), automatyczne ukrycie po poprawie.
- **Walidacja:** Wyświetlany tylko przy błędach.
- **Typy:** `{ message: string }`
- **Propsy:** `message: string`

### useAlertsPolling (custom hook)
- **Opis:** Hook do cyklicznego pobierania aktywnych alertów z API dla danej imprezy.
- **Główne elementy:** useEffect, setInterval, fetch, obsługa błędów.
- **Obsługiwane interakcje:** Automatyczne odświeżanie alertów, aktualizacja stanu globalnego.
- **Walidacja:** Polling nie częściej niż co 30s, deduplikacja alertów.
- **Typy:** `AlertDTO`, `PartyAlertsResponseDTO`
- **Propsy:** `partyId: number`

### useGlobalAlerts (custom hook)
- **Opis:** Hook do interakcji z kontekstem powiadomień (dodawanie/usuwanie alertów, toastów, modali).
- **Główne elementy:** useContext(GlobalAlertsContext)
- **Obsługiwane interakcje:** Dodanie/usunięcie powiadomienia, zamknięcie modal/toast.
- **Walidacja:** Brak
- **Typy:** `GlobalAlertViewModel`, `ToastViewModel`, `ModalAlertViewModel`

## 5. Typy
### AlertDTO (z types.ts)
- id: number
- alert_type: "approaching_threshold" | "exceeded_threshold"
- is_active: boolean
- bac_at_alert: number
- triggered_at: string
- last_alert_sent_at: string

### PartyAlertsResponseDTO
- party_id: number
- active_alerts: AlertDTO[]

### GlobalAlertViewModel (nowy)
- id: number | string
- type: "info" | "warning" | "error"
- message: string
- alertType?: "approaching_threshold" | "exceeded_threshold"
- triggeredAt?: string
- lastAlertSentAt?: string
- actions?: { label: string; onClick: () => void }[]
- autoClose?: boolean
- severity?: "info" | "warning" | "error"

### ToastViewModel (nowy)
- id: number | string
- message: string
- type: "info" | "warning" | "error"
- autoClose?: boolean

### ModalAlertViewModel (nowy)
- id: number | string
- title: string
- message: string
- actions?: { label: string; onClick: () => void }[]

## 6. Zarządzanie stanem
- Stan powiadomień przechowywany w kontekście (GlobalAlertsProvider) jako lista alertów, toastów i aktualny modal.
- useReducer lub useState do zarządzania kolejką powiadomień.
- useAlertsPolling aktualizuje stan na podstawie odpowiedzi z API.
- Komponenty potomne korzystają z hooka useGlobalAlerts do interakcji (dodawanie/usuwanie).
- ModalAlert wyświetlany tylko dla alertów exceeded_threshold, toast dla approaching_threshold i błędów API.

## 7. Integracja API
- Wywołanie: `GET /api/parties/:partyId/alerts`
- Odpowiedź: `PartyAlertsResponseDTO` (party_id, active_alerts: AlertDTO[])
- Polling co 30s (lub na zmianę partyId), deduplikacja alertów po id/alert_type.
- Obsługa błędów (401/403/404) – wyświetlenie toastu error.
- Aktualizacja stanu globalnego na podstawie odpowiedzi.

## 8. Interakcje użytkownika
- Użytkownik widzi toast przy zbliżeniu do progu (approaching_threshold) – pojedynczy, natychmiastowy.
- Użytkownik widzi modal alertu po przekroczeniu progu (exceeded_threshold) – powtarzany co 5 min, dopóki alert aktywny.
- Użytkownik może zamknąć toast/modal (X lub przycisk).
- Użytkownik może wykonać akcję naprawczą (np. przejście do profilu).
- Użytkownik widzi błędy API/ostrzegawcze jako toast lub inline.

## 9. Warunki i walidacja
- Wyświetlanie tylko aktywnych alertów (`is_active: true`).
- Deduplikacja alertów po id/alert_type (nie wyświetlać powtórnie tego samego alertu).
- Modal tylko dla exceeded_threshold, toast dla approaching_threshold.
- AutoClose toastów po określonym czasie (np. 5s).
- Modal blokuje interakcję do zamknięcia/potwierdzenia.
- Obsługa błędów API – toast error, przekierowanie/logowanie przy 401/403.

## 10. Obsługa błędów
- Brak połączenia z API – toast error.
- 401/403/404 – toast error, opcjonalnie przekierowanie/logowanie.
- Duplikaty alertów – deduplikacja po id/alert_type.
- Zbyt częste powiadomienia – throttling po stronie frontu.
- Błędy walidacji – inline error lub toast.

## 11. Kroki implementacji
1. Utwórz typy ViewModel (`GlobalAlertViewModel`, `ToastViewModel`, `ModalAlertViewModel`) w `src/types.ts` lub osobnym pliku.
2. Zaimplementuj `GlobalAlertsProvider` z kontekstem, reducerem i API do zarządzania powiadomieniami.
3. Dodaj `ToastContainer` i `AlertModal` jako dzieci providera.
4. Zaimplementuj hook `useAlertsPolling` do pobierania alertów z API (polling co 30s).
5. Zaimplementuj hook `useGlobalAlerts` do interakcji z kontekstem powiadomień.
6. Dodaj obsługę deduplikacji alertów po id/alert_type.
7. Zaimplementuj logikę wyświetlania toastów/modalu na podstawie typu alertu.
8. Dodaj obsługę błędów API (toast/error inline).
9. Zapewnij a11y: aria-live, role="alert", focus trap w modalach.
10. Przetestuj powtarzalność alertów (exceeded_threshold co 5 min), autoClose toastów, zamykanie modal/toast.
11. Dodaj komponent `InlineError` do obsługi błędów walidacji w formularzach.
12. Zintegruj providera w głównym layoutcie aplikacji.
