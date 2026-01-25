# Dokument wymagań produktu (PRD) - ClearMindHelper

## 1. Przegląd produktu

ClearMindHelper to webowa aplikacja pozwalająca użytkownikom śledzić spożycie alkoholu podczas imprez, oszacować poziom alkoholu we krwi (BAC) i otrzymywać alerty, gdy zbliżają się do indywidualnego progu ryzyka urwania filmu. MVP obejmuje rejestrację konta, profil użytkownika, rejestrację napojów (ml + % ABV), szacowanie BAC według wzoru Widmarka, historię imprez oraz system progów i powiadomień. Domyślny próg urwania filmu to 1.6‰; progi będą adaptowane później na podstawie historii użytkownika.

## 2. Problem użytkownika

Użytkownicy często nie są pewni, ile alkoholu mogą wypić, zanim stracą kontrolę i doznać urwania filmu. Brak prostego, szybkiego i wiarygodnego narzędzia do śledzenia spożycia na bieżąco oraz ostrzegania przed zbliżającym się krytycznym poziomem prowadzi do ryzykownych decyzji. ClearMindHelper redukuje to ryzyko przez bieżące śledzenie spożycia oraz powiadamianie użytkownika przed i po przekroczeniu progu ryzyka.

## 3. Wymagania funkcjonalne

- Rejestracja i logowanie
  - Konto obowiązkowe: e-mail + hasło (bez 2FA, bez weryfikacji wieku).

- Profil użytkownika
  - Pola wymagane: wzrost, waga, płeć.
  - Historia picia powiązana z kontem (wszystkie imprezy i wpisy napojów).

- Rozpoczęcie i zarządzanie imprezą
  - Możliwość rozpoczęcia nowej sesji (imprezy).
  - Podczas trwania imprezy dodawanie napojów: formularz z polami "ilość (ml)" i "% ABV".
  - Edycja: użytkownik może edytować tylko ostatni wpis podczas trwania imprezy; po zamknięciu imprezy edycja zablokowana.

- Obliczanie BAC
  - Wersja MVP: implementacja wzoru Widmarka.
  - Aktualizacja szacowanego BAC natychmiast po każdym wpisie.

- Progi i alerty
  - Domyślny próg urwania filmu: 1.6‰; mechanizm adaptacji później.
  - Alert przy zbliżeniu do progu: pojedyncza wibracja/powiadomienie.
  - Po przekroczeniu progu: wibracja + komunikat ostrzegawczy co 5 minut.

- Walidacja wejścia
  - Natychmiastowe ostrzeżenia przy nierealistycznych ilościach lub zbyt szybkiej konsumpcji (np. > 2000 ml jednocześnie, lub > X ml w krótkim czasie — parametry konfigurowalne).

- Historia imprez i analityka
  - Zapis każdego wpisu napoju, edycji, zamknięcia imprezy i oznaczenia urwania filmu.
  - Telemetria zdarzeń do analizy (anonimizacja do ewentualnej agregacji).

## 4. Granice produktu (co NIE wchodzi w zakres MVP)

- Brak funkcji alarmowania przed możliwym kacem następnego dnia.
- Brak aplikacji mobilnej natywnej — tylko web.
- Brak uwzględnienia dodatkowych czynników (jedzenie, inne płyny) w obliczeniach MVP.
- Brak integracji z urządzeniami (zegarki, alkomaty) w MVP.
- Brak opcji oznaczania kaca po imprezie.
- Brak weryfikacji wieku i brak ścieżek specjalnych dla niepełnoletnich.

## 5. Historyjki użytkowników

Wszystkie historyjki zawierają testowalne kryteria akceptacji. ID są unikalne i uporządkowane.

- US-001
  - Tytuł: Rejestracja konta
  - Opis: Jako nowy użytkownik chcę utworzyć konto (e-mail + hasło), aby zapisywać profile i historię imprez.
  - Kryteria akceptacji:
    - Formularz rejestracji akceptuje e-mail i hasło.
    - Po rejestracji użytkownik otrzymuje sesję zalogowaną.
    - Konto zapisane w bazie z wymaganymi polami profilu pustymi.

- US-002
  - Tytuł: Logowanie
  - Opis: Jako zarejestrowany użytkownik chcę się logować e-mailem i hasłem.
  - Kryteria akceptacji:
    - Logowanie zwraca token sesji lub stan zalogowanego użytkownika.
    - Nieprawidłowe dane powodują jednoznaczny błąd (401).

- US-003
  - Tytuł: Uzupełnienie profilu użytkownika
  - Opis: Jako zalogowany użytkownik chcę uzupełnić wzrost, wagę, i płeć, aby obliczenia BAC były spersonalizowane.
  - Kryteria akceptacji:
    - Formularz profilu wymaga pól: wzrost (cm), waga (kg), płeć.
    - Dane walidowane są pod kątem sensownych zakresów (np. waga 30–300 kg).
    - Zmiany zapisywane i wykorzystywane w obliczeniach BAC natychmiast.

- US-004
  - Tytuł: Rozpoczęcie imprezy
  - Opis: Jako użytkownik chcę rozpocząć nową sesję imprezową, aby rejestrować napoje w kontekście tej imprezy.
  - Kryteria akceptacji:
    - Użytkownik może utworzyć nową imprezę z timestampem rozpoczęcia.
    - Nowa impreza pojawia się w historii jako "trwająca".

- US-005
  - Tytuł: Dodawanie napoju (podstawowy przypadek)
  - Opis: Jako użytkownik w trakcie imprezy chcę dodać napój podając ilość w ml i % ABV, aby system zaktualizował szacowany BAC.
  - Kryteria akceptacji:
    - Formularz przyjmuje pola: ilość_ml (liczba >0), abv_percent (0.1–100).
    - Po zatwierdzeniu wpis jest zapisany z timestampem i powiązany z bieżącą imprezą.
    - System natychmiast przelicza i wyświetla zaktualizowany BAC.

- US-006
  - Tytuł: Edycja ostatniego wpisu podczas imprezy
  - Opis: Jako użytkownik chcę edytować ostatni wpis napoju jeśli popełnię błąd, aby korektować obliczenia BAC.
  - Kryteria akceptacji:
    - Edycja ostatniego wpisu dostępna tylko gdy impreza jest otwarta.
    - Po edycji BAC aktualizowany natychmiast.
    - Historia zapisuje informację o edycji (kto, kiedy, stare vs nowe).

- US-007
  - Tytuł: Zamykanie imprezy
  - Opis: Jako użytkownik chcę zamknąć imprezę, aby zablokować dalsze edycje i zapisać wynik sesji.
  - Kryteria akceptacji:
    - Użytkownik może zakończyć imprezę, co ustawia timestamp zakończenia.
    - Po zamknięciu ostatni wpis nie podlega edycji.

- US-008
  - Tytuł: Oznaczenie urwania filmu po imprezie
  - Opis: Jako użytkownik chcę zaznaczyć, czy impreza skończyła się urwaniem filmu, aby dane mogły kalibrować progowy model ryzyka.
  - Kryteria akceptacji:
    - Opcja dostępna tylko po zamknięciu imprezy.
    - Zaznaczenie zapisuje boolean i timestamp.

- US-009
  - Tytuł: Wyświetlanie historii imprez
  - Opis: Jako użytkownik chcę przeglądać swoje poprzednie imprezy i wpisy, aby analizować wzorce picia.
  - Kryteria akceptacji:
    - Lista imprez zawiera datę, sumaryczną ilość alkoholu, maksymalne BAC i informację o urwaniu filmu.
    - Możliwość podejrzenia szczegółowej listy wpisów dla każdej imprezy.

- US-010
  - Tytuł: Powiadomienia o zbliżeniu do progu
  - Opis: Jako użytkownik chcę otrzymać alert (wibracja/powiadomienie) gdy mój BAC zbliża się do progu, aby móc zwolnić tempo.
  - Kryteria akceptacji:
    - System wysyła pojedyncze powiadomienie przy osiągnięciu progu ostrzegawczego (np. 90–95% progu).
    - Powiadomienie jest natychmiastowe i widoczne w interfejsie.

- US-011
  - Tytuł: Alert po przekroczeniu progu
  - Opis: Jako użytkownik chcę otrzymać powtarzające się powiadomienia co 5 minut po przekroczeniu progu, aby utrzymać świadomość ryzyka.
  - Kryteria akceptacji:
    - Po przekroczeniu progu powiadomienia powtarzają się co 5 minut.

- US-012
  - Tytuł: Walidacja nierealistycznych wartości
  - Opis: Jako użytkownik chcę, aby system ostrzegał przy wprowadzaniu nierealistycznych ilości lub zbyt szybkiej konsumpcji.
  - Kryteria akceptacji:
    - W przypadku wpisu przekraczającego progi walidacji UI wyświetla ostrzeżenie i potwierdzenie i pozwala poprawić wpisaną wartość.
    - System nie blokuje zapisu, ale wymaga dodatkowego potwierdzenia od użytkownika.

- US-013
  - Tytuł: Telemetria i zdarzenia analityczne
  - Opis: Jako product manager chcę mieć zapis zdarzeń (dodanie, edycja, zamknięcie, oznaczenie urwania filmu), aby mierzyć skuteczność produktu.
  - Kryteria akceptacji:
    - Każde zdarzenie logowane z minimalnymi danymi (user_id, event_type, timestamp, party_id).
    - Dane do analityki są anonimowe lub agregowane zgodnie z polityką prywatności.

- US-014
  - Tytuł: Konfigurowalny próg użytkownika
  - Opis: System na podstawie historii picia powinien dopasowywać próg użytkownika
  - Kryteria akceptacji:
    - po zaznaczeniu urwania się filmu po imprezie próg powinien być zaktualizowany bazując na ilości i szybkości wypitego alkoholu
    - Zmiana progu wpływa na logikę alertów natychmiast.

- US-015
  - Tytuł: Bezpieczne uwierzytelnianie (autoryzacja dostępu)
  - Opis: Jako użytkownik chcę bezpiecznie logować się na konto, aby moje dane były chronione.
  - Kryteria akceptacji:
    - Hasła przechowywane w bazie w postaci hash (np. bcrypt).
    - Endpointy chronione za pomocą mechanizmu sesji/tokenu.

- US-016
  - Tytuł: Obsługa skrajnych scenariuszy: szybkie spożycie
  - Opis: Jako użytkownik, który szybko pije duże ilości, chcę otrzymać natychmiastowe ostrzeżenie i wskazanie, że spożycie jest niebezpieczne.
  - Kryteria akceptacji:
    - System wykrywa spożycie przekraczające konfigurację szybkości (np. > X ml w Y minut) i wyświetla jasne ostrzeżenie.
    - Zdarzenie logowane jako "szybkie_spozycie".

- US-017
  - Tytuł: Zmiana ABV przy dodawaniu napoju
  - Opis: Jako użytkownik chcę móc zmienić domyślną zawartość alkoholu (ABV) dla wpisu napoju.
  - Kryteria akceptacji:
    - Pole ABV akceptuje wartości w zakresie 0.1–100.
    - Wartość ABV użyta do obliczeń i zapisana w historii wpisu.

- US-018
  - Tytuł: Dane profilowe wymagane do obliczeń
  - Opis: Jako użytkownik chcę, aby aplikacja wymagała minimalnego zestawu danych profilowych przed obliczeniem BAC.
  - Kryteria akceptacji:
    - Jeśli brak wymaganych pól profilu, system blokuje rozpoczęcie imprezy i prosi o uzupełnienie.
    - UI jasno informuje, które pola brakują.

- US-019
  - Tytuł: Ręczna zmiana progu użytkownika
  - Opis: Użytkownik powinien manualnie go móć zmienić próg
  - Kryteria akceptacji:
    - Zmiana progu wpływa na logikę alertów natychmiast.
    - Umożliwienie ręcznej zmiany progu przez użytkownika.

## 6. Metryki sukcesu

- Produktowe
  - Cel: 51% użytkowników raportuje spadek częstotliwości urwań filmu w porównaniu do okresu poprzedniego (mierzone co miesiąc).
  - Wskaźnik krótkoterminowy: spadek odsetka zgłoszonych urwań o ≥10% m/m przy próbie ≥10 aktywnych użytkowników miesięcznie.

- Techniczne
  - Dokładność szacowania BAC: cel 0.1‰ (zapisać jako cel rozwojowy wymagający walidacji z alkomatem).
  - Czas reakcji alertów: < 2 sekundy od wpisu napoju do wyświetlenia zaktualizowanego BAC i ewentualnego alertu.

## Checklista weryfikacyjna (po opracowaniu PRD)

- Każda historyjka użytkownika jest testowalna i ma jasne kryteria akceptacji: tak (US-001..US-018).
- Kryteria akceptacji są konkretne i mierzalne: tak.
- Uwierzytelnianie i autoryzacja uwzględnione: tak (US-001, US-002, US-015).
- Pokryto scenariusze podstawowe, alternatywne i skrajne: tak (edycja, szybkie spożycie, nierealne wartości).

---

Notatki implementacyjne i operacyjne

- Algorytm BAC: Widmark w MVP. Później ewentualne ulepszenia.
- Prywatność: minimalne dane do analityki; zapisywać flagę wyrażenia zgody na analizę agregowaną.
- Powiadomienia: na webzie przez powiadomienia przeglądarkowe + sygnał w UI; mobilne wibracje za pomocą PWA/Browser API w późniejszych iteracjach.
