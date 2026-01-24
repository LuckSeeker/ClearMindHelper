# Plan implementacji widoku Aktywna Impreza

## 1. Przegląd
Widok „Aktywna Impreza” umożliwia użytkownikowi rozpoczęcie nowej imprezy, zarządzanie jej przebiegiem, dodawanie i edycję napojów, podgląd aktualnego poziomu BAC, obsługę alertów, zamknięcie imprezy oraz oznaczenie urwania filmu (blackout). Widok zapewnia natychmiastową informację zwrotną, walidację wartości, blokadę edycji po zamknięciu oraz dostępność kluczowych akcji w jednym miejscu.

## 2. Routing widoku
Ścieżka: `/party`

## 3. Struktura komponentów
```
PartyView
├── PartyStartButton
├── PartyHeader
│   ├── BACIndicator
│   └── AlertsPanel
├── DrinksTable
│   └── AddEditDrinkModal
├── ClosePartyButton
├── BlackoutButton
├── WarningModal
└── Toast
```

## 4. Szczegóły komponentów

### PartyView
- **Opis:** Główny kontener widoku imprezy. Zarządza stanem, pobiera dane, renderuje podkomponenty zależnie od statusu imprezy.
- **Główne elementy:** PartyStartButton, PartyHeader, DrinksTable, ClosePartyButton, BlackoutButton, WarningModal, Toast.
- **Obsługiwane interakcje:** Inicjacja imprezy, obsługa mutacji, zarządzanie modalami, polling BAC/alertów.
- **Walidacja:** Sprawdza, czy istnieje aktywna impreza, kontroluje dostępność akcji.
- **Typy:** PartyViewModel, PartyDetailDTO, APIError, DrinkValidationWarning.
- **Propsy:** Brak (główny widok).

### PartyStartButton
- **Opis:** Przycisk do rozpoczęcia nowej imprezy, widoczny tylko gdy nie ma aktywnej imprezy.
- **Główne elementy:** Button, opcjonalnie modal potwierdzenia.
- **Interakcje:** Kliknięcie wywołuje POST /api/parties.
- **Walidacja:** Sprawdza kompletność profilu, blokuje przy aktywnej imprezie.
- **Typy:** Brak własnych, używa callbacków.
- **Propsy:** onStart (callback).

### PartyHeader
- **Opis:** Wyświetla status imprezy, snapshot profilu, aktualny BAC, aktywne alerty.
- **Główne elementy:** BACIndicator, AlertsPanel, dane profilu, status.
- **Interakcje:** Brak bezpośrednich, tylko prezentacja.
- **Walidacja:** Brak.
- **Typy:** PartyDetailDTO, CurrentBACResponseDTO, AlertDTO[].
- **Propsy:** party, currentBAC, alerts.

### BACIndicator
- **Opis:** Graficzny i liczbowy wskaźnik aktualnego BAC, status progowy.
- **Główne elementy:** Progress bar, liczba, kolorowanie wg statusu.
- **Interakcje:** Brak.
- **Walidacja:** Kolor/status na podstawie threshold_status.
- **Typy:** CurrentBACResponseDTO.
- **Propsy:** currentBAC.

### AlertsPanel
- **Opis:** Lista aktywnych alertów (np. zbliżenie/przekroczenie progu).
- **Główne elementy:** Lista alertów, ikony, opisy.
- **Interakcje:** Brak.
- **Walidacja:** Wyświetla tylko aktywne alerty.
- **Typy:** AlertDTO[].
- **Propsy:** alerts.

### DrinksTable
- **Opis:** Tabela napojów z danymi, BAC przy każdym wpisie, akcja edycji ostatniego napoju.
- **Główne elementy:** Tabela, wiersze napojów, przycisk „Edytuj” przy ostatnim napoju, przycisk „Dodaj napój”.
- **Interakcje:** Otwieranie AddEditDrinkModal, wywołanie edycji.
- **Walidacja:** Edycja tylko ostatniego napoju, tylko gdy impreza otwarta.
- **Typy:** DrinkDTO[], PartyDetailDTO.
- **Propsy:** drinks, party, onAdd, onEdit.

### AddEditDrinkModal
- **Opis:** Modal do dodawania/edycji napoju. Obsługuje walidację, ostrzeżenia, potwierdzenia.
- **Główne elementy:** Formularz (volume_ml, abv_percent), walidacja, przyciski „Zapisz”, „Anuluj”.
- **Interakcje:** Submit (POST/PUT), obsługa ostrzeżeń (422), zamknięcie.
- **Walidacja:** volume_ml (0 < x ≤ 5000), abv_percent (0.1–100), consumed_at w zakresie imprezy.
- **Typy:** AddDrinkFormModel, DrinkValidationWarning.
- **Propsy:** open, onClose, onSubmit, initialValues, isEditing, warning.

### ClosePartyButton
- **Opis:** Przycisk do zamknięcia imprezy, widoczny tylko gdy impreza otwarta.
- **Główne elementy:** Button, modal potwierdzenia.
- **Interakcje:** Kliknięcie wywołuje PATCH /api/parties/:id/close.
- **Walidacja:** Dostępny tylko przy statusie 'ongoing'.
- **Typy:** Brak własnych.
- **Propsy:** party, onClose.

### BlackoutModal
- **Opis:** Modal automatycznie wyświetlany użytkownikowi natychmiast po zamknięciu imprezy z pytaniem „Czy podczas tej imprezy wystąpił blackout?”
- **Główne elementy:** Modal z pytaniem, przyciski „Tak”/„Nie”, opcjonalnie opis wpływu tej decyzji.
- **Interakcje:** Wybór „Tak” wywołuje PATCH /api/parties/:id/blackout, „Nie” zamyka modal bez akcji.
- **Walidacja:** Wyświetlany tylko po zamknięciu imprezy, jeśli nie oznaczono jeszcze blackout.
- **Typy:** Brak własnych.
- **Propsy:** party, open, onConfirm, onCancel.

### WarningModal
- **Opis:** Modal ostrzeżenia przy nierealistycznych wartościach lub szybkim spożyciu.
- **Główne elementy:** Treść ostrzeżenia, przyciski „Potwierdź”, „Popraw”.
- **Interakcje:** Potwierdzenie wywołuje ponowny submit z flagą, poprawka zamyka modal.
- **Walidacja:** Wyświetlany tylko przy DrinkValidationWarning.requires_confirmation.
- **Typy:** DrinkValidationWarning.
- **Propsy:** warning, onConfirm, onCancel.

### Toast
- **Opis:** Komponent powiadomień toast dla sukcesów, błędów, alertów.
- **Główne elementy:** Treść, ikona, kolor.
- **Interakcje:** Automatyczne zamykanie, ręczne zamknięcie.
- **Walidacja:** Brak.
- **Typy:** string (wiadomość), typ powiadomienia.
- **Propsy:** open, message, type, onClose.


## 5. Typy
**Uwaga:** W pierwszej kolejności należy wykorzystywać typy zdefiniowane w pliku `src/types.ts` (np. PartyDetailDTO, DrinkDTO, CurrentBACResponseDTO, UserThresholdDTO, APIError, DrinkValidationWarning). Nowe typy (np. modele widoku, typy pomocnicze do formularzy) należy tworzyć tylko wtedy, gdy nie istnieje odpowiedni typ w types.ts lub gdy wymagane są dodatkowe pola specyficzne dla UI.

- **PartyViewModel** *(nowy typ widoku)*: party: PartyDetailDTO | null, drinks: DrinkDTO[], currentBAC: CurrentBACResponseDTO | null, alerts: AlertDTO[], threshold: UserThresholdDTO | null, status: 'idle'|'loading'|'error'|'success', error: APIError|null, warning: DrinkValidationWarning|null, showAddEditModal: boolean, showWarningModal: boolean, showToast: boolean, toastMessage: string.
- **AddDrinkFormModel** *(nowy typ pomocniczy do formularza)*: volume_ml: number, abv_percent: number, consumed_at: string, errors: Record<string, string>, isEditing: boolean, drinkId?: number.
- **AlertViewModel** *(opcjonalny typ pomocniczy do prezentacji alertów)*: alert_type: string, bac_at_alert: number, triggered_at: string, is_active: boolean.
- **Pozostałe:** PartyDetailDTO, DrinkDTO, CurrentBACResponseDTO, UserThresholdDTO, APIError, DrinkValidationWarning *(wszystkie z pliku types.ts)*.

## 6. Zarządzanie stanem
- Główny stan zarządzany w PartyView (useState/useReducer).
- Custom hooki:
  - useParty: pobieranie, mutacje, polling, synchronizacja stanu imprezy.
  - useDrinks: obsługa napojów, mutacje, walidacja, optimistic update.
  - useBAC: polling aktualnego BAC.
  - useAlerts: polling alertów.
  - useWarning: obsługa ostrzeżeń (422).
  - useToast: powiadomienia.
- Stan lokalny dla modali, formularzy, ostrzeżeń.

## 7. Integracja API
- **Start imprezy:** POST /api/parties (body: { started_at? }) → PartyDTO
- **Pobierz szczegóły imprezy:** GET /api/parties/:id → PartyDetailDTO
- **Dodaj napój:** POST /api/parties/:id/drinks (body: AddDrinkCommand) → AddDrinkResponseDTO lub 422 z DrinkValidationWarning
- **Edytuj napój:** PUT /api/parties/:id/drinks/:drinkId (body: UpdateDrinkCommand) → UpdateDrinkResponseDTO lub 422
- **Zamknij imprezę:** PATCH /api/parties/:id/close (body: ClosePartyCommand) → ClosePartyResponseDTO
- **Oznacz blackout:** PATCH /api/parties/:id/blackout (body: { blackout_marked: true }) → MarkBlackoutResponseDTO
- **Pobierz BAC:** GET /api/parties/:id/bac/current → CurrentBACResponseDTO
- **Pobierz alerty:** GET /api/parties/:id/alerts → PartyAlertsResponseDTO
- **Obsługa błędów:** APIError, walidacja, statusy HTTP.

## 8. Interakcje użytkownika
- Rozpoczęcie imprezy → PartyStartButton → POST /api/parties → przejście do widoku imprezy.
- Dodanie napoju → DrinksTable/AddEditDrinkModal → POST /api/parties/:id/drinks → aktualizacja tabeli, BAC, alertów.
- Edycja ostatniego napoju → DrinksTable/AddEditDrinkModal → PUT /api/parties/:id/drinks/:drinkId.
- Zamknięcie imprezy → ClosePartyButton → PATCH /api/parties/:id/close → blokada edycji.
- Oznaczenie blackout → BlackoutButton → PATCH /api/parties/:id/blackout.
- Ostrzeżenie (nierealistyczne wartości/szybkie spożycie) → WarningModal → potwierdzenie lub poprawka.
- Powiadomienia toast przy sukcesie/błędzie/alertach.

## 9. Warunki i walidacja
- **Start imprezy:** Brak aktywnej imprezy, profil kompletny.
- **Dodanie napoju:** volume_ml (0 < x ≤ 5000), abv_percent (0.1–100), consumed_at w zakresie imprezy.
- **Edycja napoju:** Tylko ostatni napój, impreza otwarta.
- **Zamknięcie imprezy:** Status 'ongoing'.
- **Blackout:** Status 'closed', blackout_marked = false.
- **Ostrzeżenia:** Wartości przekraczające progi (np. >2000ml, szybkie spożycie) → WarningModal, requires_confirmation.
- **Alerty:** Wyświetlane tylko aktywne.
- **Blokada edycji:** Po zamknięciu imprezy.

## 10. Obsługa błędów
- **Błędy API:** Wyświetlanie toast/error, obsługa statusów (400, 401, 403, 404, 409, 422, 500).
- **Walidacja formularzy:** Inline errors, blokada submit.
- **Ostrzeżenia (422):** WarningModal z możliwością potwierdzenia lub poprawki.
- **Brak uprawnień:** Przekierowanie lub komunikat.
- **Błędy sieci:** Toast z informacją o problemie.
- **Race conditions:** Blokada przycisków podczas mutacji, synchronizacja stanu po sukcesie.

## 11. Kroki implementacji
1. Utwórz strukturę folderów i plików dla widoku `/party` oraz komponentów.
2. Zaimplementuj PartyView z obsługą stanu i integracją hooków.
3. Dodaj PartyStartButton z obsługą POST /api/parties i walidacją.
4. Zaimplementuj PartyHeader z BACIndicator i AlertsPanel.
5. Stwórz DrinksTable z obsługą AddEditDrinkModal i edycji ostatniego napoju.
6. Dodaj AddEditDrinkModal z walidacją, obsługą ostrzeżeń (422) i potwierdzeń.
7. Dodaj ClosePartyButton i obsługę PATCH /api/parties/:id/close.
8. Dodaj BlackoutButton i obsługę PATCH /api/parties/:id/blackout.
9. Zaimplementuj WarningModal do obsługi ostrzeżeń.
10. Dodaj Toast do obsługi powiadomień.
11. Zaimplementuj custom hooki: useParty, useDrinks, useBAC, useAlerts, useWarning, useToast.
12. Dodaj polling BAC i alertów (np. co 10s).
13. Przetestuj warunki brzegowe, walidację, obsługę błędów i UX.
14. Zadbaj o dostępność (a11y) i responsywność.
15. Przeprowadź code review i testy manualne.
