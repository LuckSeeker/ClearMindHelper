<analiza_projektu>

**1. Kluczowe komponenty projektu:**
*   **Moduł Uwierzytelniania (Auth):** Oparty na Supabase Auth, obejmuje rejestrację, logowanie, wylogowanie, reset hasła oraz middleware chroniący trasy (`src/middleware/index.ts`).
*   **Moduł Profilu Użytkownika:** Przechowuje dane fizyczne (waga, wzrost, płeć) niezbędne do obliczeń. Implementuje logikę "snapshotów" profilu przy starcie imprezy, aby zmiany w trakcie nie psuły obliczeń historycznych.
*   **Silnik Obliczeniowy BAC (Core):** `src/lib/services/bac.service.ts` oraz `drink.service.ts`. Implementuje algorytm Widmarka, uwzględnia metabolizm w czasie, stałe fizyczne (gęstość etanolu) i współczynniki płci.
*   **Zarządzanie Imprezą (Party Lifecycle):** Rozpoczynanie, trwanie (status 'ongoing'), zamykanie ('closed') oraz historia imprez.
*   **Zarządzanie Napojami (Drinks):** Dodawanie, edycja (tylko ostatniego napoju - kluczowa reguła biznesowa), walidacja (objętość, szybkość spożycia).
*   **System Alertów i Progów (Thresholds):** Dynamiczne monitorowanie BAC, alerty "zbliżania się" i "przekroczenia", obsługa "Blackoutu" (automatyczne podnoszenie progu po oznaczeniu urwania filmu).
*   **UI/UX:** Aplikacja hybrydowa Astro (SSG/SSR) z komponentami React (interaktywność). Wykorzystuje Tailwind CSS oraz komponenty UI (`src/components/ui`).

**2. Specyfika stosu technologicznego i implikacje dla testów:**
*   **Astro + React:** Aplikacja korzysta z architektury "Islands". Należy testować, czy komponenty React poprawnie się hydrują i czy stan jest zachowany między przejściami stron (chociaż Astro to głównie MPA).
*   **Supabase (PostgreSQL):** Testy integracyjne muszą uwzględniać RLS (Row Level Security) - czy użytkownik A nie widzi danych użytkownika B.
*   **Server-Side Rendering (SSR):** Część logiki dzieje się na serwerze (API routes), a część na kliencie. Należy weryfikować nagłówki cache i obsługę ciasteczek (sesji).
*   **TypeScript & Zod:** Silne typowanie i walidacja schematów (`src/lib/validation`) redukują ryzyko błędów typów, więc testy powinny skupić się na logice biznesowej i przypadkach brzegowych walidacji, a nie na trywialnych błędach wejścia.

**3. Priorytety testowe:**
1.  **Krytyczny:** Poprawność obliczeń BAC (algorytm Widmarka). Błąd tutaj dyskwalifikuje aplikację jako narzędzie "Health & Safety".
2.  **Krytyczny:** Bezpieczeństwo danych (izolacja użytkowników - RLS) i poprawność przypisywania danych do sesji.
3.  **Wysoki:** Logika snapshotów profilu (zmiana wagi w profilu nie może zmieniać BAC trwającej/zakończonej imprezy).
4.  **Wysoki:** System alertów (użytkownik musi dostać powiadomienie przed przekroczeniem progu).
5.  **Średni:** Interfejs użytkownika, walidacja formularzy (UX), historia.

**4. Obszary ryzyka:**
*   **Strefy czasowe:** `consumed_at` jest kluczowe dla obliczeń spadku alkoholu. Różnice między czasem serwera a czasem lokalnym użytkownika mogą prowadzić do błędnych wyników.
*   **Edycja historyczna:** Edycja ostatniego drinka wpływa na bieżące BAC i alerty. Ryzyko niespójności danych po edycji.
*   **Wyścigi (Race Conditions):** Szybkie dodawanie napojów w `drink.service.ts` i przeliczanie sekwencji (`order_sequence`).
*   **Zaokrąglenia:** Matematyka zmiennoprzecinkowa przy obliczaniu promili może prowadzić do drobnych, ale istotnych różnic w alertach (np. 0.799 vs 0.8).

</analiza_projektu>

# Plan Testów Projektu ClearMindHelper

## 1. Wprowadzenie
ClearMindHelper to aplikacja internetowa typu Health & Safety, służąca do monitorowania spożycia alkoholu i szacowania stężenia alkoholu we krwi (BAC). Ze względu na charakter aplikacji (wpływ na decyzje zdrowotne użytkownika), najwyższym priorytetem jest dokładność obliczeń matematycznych oraz niezawodność systemu alertów. Niniejszy plan testów definiuje strategię zapewnienia jakości dla wersji opartej na stacku Astro, React, TypeScript i Supabase.

## 2. Zakres Testów
### 2.1. Elementy podlegające testom (In-Scope)
*   **Logika biznesowa:** Algorytm obliczania BAC, mechanizm metabolizmu alkoholu w czasie.
*   **Zarządzanie kontem:** Rejestracja, logowanie, edycja profilu fizycznego (waga, wzrost, płeć).
*   **Cykl życia imprezy:** Start, dodawanie napojów, edycja napojów, zamykanie imprezy, oznaczanie "Blackoutu".
*   **API:** Wszystkie endpointy w katalogu `src/pages/api`.
*   **Baza danych:** Spójność danych, poprawność relacji i zabezpieczenia RLS (Row Level Security).
*   **Interfejs użytkownika:** Komponenty React, modale, formularze, responsywność.

### 2.2. Elementy wyłączone z testów (Out-of-Scope)
*   Testy obciążeniowe (na obecnym etapie rozwoju).
*   Testy bezpieczeństwa infrastruktury Supabase (polegamy na dostawcy).
*   Natywne funkcje mobilne (testujemy tylko jako PWA/Web App).

## 3. Typy Testów

| Typ Testu | Cel | Główne Obszary |
| :--- | :--- | :--- |
| **Testy Jednostkowe (Unit)** | Weryfikacja izolowanych funkcji i logiki. | `bac.service.ts`, `drink.validation.ts`, utility functions. |
| **Testy Integracyjne (API)** | Weryfikacja komunikacji backend-baza danych. | Endpointy `/api/parties`, `/api/profile`, obsługa sesji. |
| **Testy E2E (End-to-End)** | Weryfikacja pełnych ścieżek użytkownika. | Rejestracja -> Start Imprezy -> Dodanie Drinka -> Alert -> Zamknięcie. |
| **Testy Bezpieczeństwa** | Weryfikacja dostępu do danych. | Sprawdzenie czy User A nie widzi imprez Usera B (Supabase RLS). |
| **Testy UI/UX** | Weryfikacja użyteczności i błędów wizualnych. | Modale, responsywność tabel, formatowanie dat. |

## 4. Scenariusze Testowe

### 4.1. Core Logic - Obliczanie BAC (Priorytet: Krytyczny)
*   **TC_BAC_001:** Weryfikacja obliczeń dla standardowego mężczyzny (80kg, 180cm, 1 piwo 500ml 5%). Wynik musi być zgodny z wzorcem Widmarka.
*   **TC_BAC_002:** Weryfikacja obliczeń dla standardowej kobiety (60kg, 165cm, 1 wino 150ml 12%).
*   **TC_BAC_003:** Test metabolizmu w czasie (spadek BAC po 1h, 3h, 6h).
*   **TC_BAC_004:** Weryfikacja wpływu "Snapshotu profilu".
    *   *Kroki:* Użytkownik ma 80kg -> Start imprezy -> Użytkownik zmienia wagę na 100kg w profilu -> Dodanie drinka.
    *   *Oczekiwany rezultat:* BAC obliczane dla 80kg (z momentu startu imprezy).
*   **TC_BAC_005:** Dodanie drinka z czasem przeszłym (`consumed_at` < `now`). Przeliczenie, czy system od razu uwzględnia metabolizm, który nastąpił od czasu spożycia.

### 4.2. Zarządzanie Imprezą i Napojami
*   **TC_PARTY_001:** Próba rozpoczęcia nowej imprezy, gdy inna ma status `ongoing`. (Oczekiwany błąd 409/Conflict).
*   **TC_PARTY_002:** Zamknięcie imprezy z datą wsteczną. Walidacja `ended_at` vs `started_at`.
*   **TC_DRINK_001:** Dodanie napoju z nierealistyczną objętością (>2000ml). Weryfikacja pojawienia się `WarningModal` i możliwość potwierdzenia mimo ostrzeżenia.
*   **TC_DRINK_002:** Edycja napoju.
    *   *Warunek:* Próba edycji przedostatniego napoju.
    *   *Oczekiwany rezultat:* Blokada/Błąd (zgodnie z logiką `NOT_LAST_DRINK`).
*   **TC_DRINK_003:** Edycja ostatniego napoju i weryfikacja przeliczenia alertów (np. zmiana 5% na 40% powinna wyzwolić alert).

### 4.3. Alerty i Progi (Thresholds)
*   **TC_ALERT_001:** Osiągnięcie poziomu "Approaching" (domyślnie 90% progu). Weryfikacja czy pojawia się wpis w tabeli `alerts` i toast na UI.
*   **TC_ALERT_002:** Przekroczenie progu (Exceeded). Weryfikacja czy modal ostrzegawczy blokuje interfejs/pojawia się.
*   **TC_BLACKOUT_001:** Flow "Blackout".
    *   *Kroki:* Zakończenie imprezy z wysokim BAC -> Wybranie opcji "Oznacz Blackout".
    *   *Oczekiwany rezultat:* Utworzenie nowego progu w `userthresholds` równego osiągniętemu max BAC (ale nie mniej niż `BLACKOUT_MIN_THRESHOLD_BAC`).

### 4.4. Bezpieczeństwo i Walidacja
*   **TC_SEC_001:** Próba pobrania szczegółów imprezy innego użytkownika przez API (podmiana ID w URL). Oczekiwany 404 lub 403.
*   **TC_VAL_001:** Wprowadzenie ujemnych wartości wagi/wzrostu lub objętości alkoholu. (Zod schema validation).

## 5. Środowisko Testowe
*   **Backend:** Dedykowana instancja projektu Supabase (Staging). Baza danych z seedowanymi danymi testowymi.
*   **Frontend:** Lokalnie uruchomiony serwer deweloperski (`npm run dev`) lub build produkcyjny (`npm run preview`).
*   **Przeglądarki:**
    *   Google Chrome (najnowsza)
    *   Mozilla Firefox
    *   Safari (iOS simulation) - sprawdzenie inputów `type="datetime-local"`.

## 6. Narzędzia do Testowania
*   **Vitest / Jest:** Do testów jednostkowych funkcji obliczających BAC (`src/lib/services/bac.service.ts`).
*   **Playwright:** Do testów E2E (scenariusze krytyczne: start imprezy -> picie -> koniec).
*   **Postman / Bruno:** Do testowania endpointów API i weryfikacji kodów błędów HTTP.
*   **Supabase Dashboard:** Do manualnej weryfikacji stanu bazy danych i triggerów.

## 7. Harmonogram Testów
1.  **Faza 1: Testy Jednostkowe (Unit):** Skupienie na `bac.service.ts` i `drink.service.ts`. Weryfikacja matematyki. (Czas: 1-2 dni).
2.  **Faza 2: Testy Integracyjne API:** Weryfikacja walidacji Zod i komunikacji z bazą. (Czas: 1-2 dni).
3.  **Faza 3: Testy UI i E2E:** Implementacja scenariuszy w Playwright, testy manualne interfejsu. (Czas: 2-3 dni).
4.  **Faza 4: Bugfix i Retesty:** Naprawa znalezionych błędów.

## 8. Kryteria Akceptacji (Exit Criteria)
*   100% zaliczonych testów jednostkowych dla algorytmu BAC.
*   Brak błędów krytycznych (Critical) i wysokich (High) uniemożliwiających ukończenie cyklu imprezy.
*   Poprawne działanie RLS (brak wycieku danych między użytkownikami).
*   Poprawne działanie na urządzeniach mobilnych (responsywność).

## 9. Role i Odpowiedzialności
*   **QA Engineer:** Tworzenie scenariuszy, automatyzacja testów E2E, testy manualne, zgłaszanie błędów.
*   **Developer:** Pisanie testów jednostkowych, naprawa błędów, utrzymanie środowiska stagingowego.
*   **Product Owner:** Akceptacja kryteriów biznesowych (np. czy komunikaty ostrzegawcze są wystarczająco jasne).

## 10. Procedury Raportowania Błędów
Zgłoszenia błędów powinny trafiać do systemu śledzenia (np. Jira/GitHub Issues) i zawierać:
1.  **Tytuł:** Zwięzły opis problemu.
2.  **Priorytet:** (Krytyczny, Wysoki, Średni, Niski).
3.  **Kroki do reprodukcji:** Dokładna ścieżka.
4.  **Dane testowe:** Użyte parametry profilu, dodane napoje.
5.  **Oczekiwany rezultat:** Co powinno się stać.
6.  **Rzeczywisty rezultat:** Co się stało (wraz z logami z konsoli/serwera).
7.  **Środowisko:** Przeglądarka, wersja OS.