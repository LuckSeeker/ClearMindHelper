# Plan implementacji widoku Profil użytkownika

## 1. Przegląd
Widok profilu użytkownika umożliwia uzupełnienie i edycję danych profilowych (wzrost, waga, płeć), ręczną zmianę progu BAC oraz podgląd historii progów. Celem widoku jest zapewnienie użytkownikowi możliwości personalizacji parametrów niezbędnych do obliczeń BAC oraz zarządzania własnym progiem ryzyka.

## 2. Routing widoku
Ścieżka: `/profile`
Widok powinien być dostępny wyłącznie dla zalogowanego użytkownika.

## 3. Struktura komponentów
- **ProfilePage** (kontener widoku)
  - **ProfileForm** (formularz edycji profilu)
  - **ThresholdCard** (aktualny próg BAC, przycisk zmiany)
    - **ThresholdChangeModal** (modal do zmiany progu)
  - **ThresholdHistoryTable** (tabela historii progów)

## 4. Szczegóły komponentów
### ProfilePage
- Opis: Główny kontener widoku, zarządza stanem profilu, progu i historii, integruje API, obsługuje komunikaty i błędy.
- Główne elementy: sekcja formularza, sekcja progu, sekcja historii, komunikaty globalne.
- Obsługiwane interakcje: inicjalizacja fetchu, refetch po zmianach, przekazywanie stanu do dzieci.
- Walidacja: sprawdzenie is_complete, blokada akcji przy niekompletnym profilu.
- Typy: ProfileFormViewModel, ThresholdChangeViewModel, ThresholdHistoryItem.
- Prospy: brak (root widoku).

### ProfileForm
- Opis: Formularz edycji/uzupełnienia profilu użytkownika (wzrost, waga, płeć).
- Główne elementy: inputy typu number (wzrost, waga), select (płeć), przycisk zapisu, komunikaty walidacyjne.
- Obsługiwane interakcje: zmiana wartości pól, submit, obsługa błędów, loading.
- Walidacja: height_cm (50-250), weight_kg (30-300), gender (M/F), wszystkie wymagane.
- Typy: UserProfileDTO, UpdateUserProfileCommand, ProfileFormViewModel.
- Prospy: profile (UserProfileDTO), onSubmit, isSubmitting, errors.

### ThresholdCard
- Opis: Wyświetla aktualny próg BAC, powód, datę ustawienia, przycisk do zmiany progu.
- Główne elementy: tekst z aktualnym progiem, przycisk "Zmień próg".
- Obsługiwane interakcje: otwarcie modala zmiany progu.
- Walidacja: brak (tylko wyświetlanie).
- Typy: UserThresholdDTO/CurrentThresholdResponseDTO.
- Prospy: threshold, onChangeClick.

### ThresholdChangeModal
- Opis: Modal umożliwiający ręczną zmianę progu BAC, z walidacją i potwierdzeniem.
- Główne elementy: input number (threshold_bac), przycisk potwierdzenia, anulowania, komunikaty walidacyjne.
- Obsługiwane interakcje: zmiana wartości, submit, zamknięcie, loading, obsługa błędów.
- Walidacja: threshold_bac (0.08–1.60), wymagane potwierdzenie.
- Typy: UpdateThresholdCommand, ThresholdChangeViewModel.
- Prospy: isOpen, onClose, onSubmit, isSubmitting, error, currentValue.

### ThresholdHistoryTable
- Opis: Tabela historii progów użytkownika (wartość, powód, data, powiązana impreza).
- Główne elementy: tabela, wiersze historii, paginacja (jeśli dużo rekordów).
- Obsługiwane interakcje: brak (tylko wyświetlanie).
- Walidacja: brak.
- Typy: ThresholdHistoryItem.
- Prospy: items (ThresholdHistoryItem[]), isLoading, error.

## 5. Typy
- **UserProfileDTO**: id, user_id, height_cm, weight_kg, gender, created_at, updated_at, is_complete
- **UpdateUserProfileCommand**: height_cm, weight_kg, gender
- **UserThresholdDTO/CurrentThresholdResponseDTO**: id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at
- **UpdateThresholdCommand**: threshold_bac
- **ThresholdHistoryItem**: id, threshold_bac, reason, created_at, trigger_party_id
- **ProfileFormViewModel**: height_cm, weight_kg, gender, errors (Record<string, string>), isSubmitting, isComplete
- **ThresholdChangeViewModel**: threshold_bac, isOpen, isSubmitting, error

## 6. Zarządzanie stanem
- Stan profilu, progu i historii pobierany przez customowe hooki (np. useProfile, useThreshold, useThresholdHistory).
- Stan formularza zarządzany lokalnie w ProfileForm (useForm).
- Stan modala zmiany progu zarządzany w ProfilePage (useModal).
- Po każdej udanej zmianie (profil/prog) refetch odpowiednich danych.
- Globalny stan błędów i loadingów przekazywany do dzieci.

## 7. Integracja API
- **GET /api/profile** – pobranie danych profilu (UserProfileDTO)
- **PUT /api/profile** – aktualizacja profilu (UpdateUserProfileCommand → UserProfileDTO)
- **GET /api/thresholds/current** – pobranie aktualnego progu (CurrentThresholdResponseDTO)
- **PUT /api/thresholds/current** – zmiana progu (UpdateThresholdCommand → CurrentThresholdResponseDTO)
- **GET /api/thresholds/history** – pobranie historii progów (ThresholdHistoryItem[])
- Wszystkie wywołania z nagłówkiem Authorization: Bearer {access_token}
- Obsługa statusów 400/401/404/500 – odpowiednie komunikaty w UI

## 8. Interakcje użytkownika
- Uzupełnienie/edycja profilu i zapis (ProfileForm)
- Otwieranie modala zmiany progu (ThresholdCard)
- Zmiana i potwierdzenie nowego progu (ThresholdChangeModal)
- Przegląd historii progów (ThresholdHistoryTable)
- Wyświetlanie komunikatów walidacyjnych i błędów
- Blokada akcji (np. rozpoczęcia imprezy) przy niekompletnym profilu

## 9. Warunki i walidacja
- **ProfileForm**: height_cm (50–250), weight_kg (30–300), gender (M/F), wszystkie wymagane – walidacja po stronie klienta i serwera.
- **ThresholdChangeModal**: threshold_bac (0.08–1.60), wymagane potwierdzenie – walidacja po stronie klienta i serwera.
- **ProfilePage**: blokada akcji przy is_complete === false.

## 10. Obsługa błędów
- 400/422: wyświetlenie komunikatu pod polem (walidacja)
- 401: przekierowanie do logowania lub komunikat o braku autoryzacji
- 404: wyświetlenie formularza do utworzenia profilu
- 500: globalny komunikat o błędzie
- Obsługa loadingów i stanów pośrednich (spinner, skeleton)

## 11. Kroki implementacji
1. Utwórz routing `/profile` w Astro.
2. Zaimplementuj ProfilePage jako kontener widoku.
3. Stwórz hooki do pobierania i aktualizacji profilu oraz progu (useProfile, useThreshold).
4. Zaimplementuj ProfileForm z walidacją i obsługą błędów.
5. Zaimplementuj ThresholdCard z wyświetlaniem aktualnego progu i przyciskiem zmiany.
6. Stwórz ThresholdChangeModal z walidacją, obsługą submit i loadingiem.
7. Zaimplementuj ThresholdHistoryTable do wyświetlania historii progów.
8. Zintegruj obsługę komunikatów walidacyjnych i błędów w UI.
9. Dodaj blokadę akcji przy niekompletnym profilu.
10. Przetestuj wszystkie ścieżki, w tym obsługę błędów i edge-case’ów.
