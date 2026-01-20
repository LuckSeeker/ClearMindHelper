# Architektura UI dla ClearMindHelper

## 1. Przegląd struktury UI

ClearMindHelper to aplikacja webowa typu mobile-first, której interfejs użytkownika został zaprojektowany wokół trzech głównych sekcji dostępnych po zalogowaniu: Aktywna impreza, Historia imprez oraz Profil użytkownika. Przed zalogowaniem użytkownik widzi wyłącznie ekran logowania/rejestracji. Nawigacja po aplikacji odbywa się za pomocą dolnego paska nawigacyjnego (na mobile) lub bocznego (na desktopie). Kluczowe interakcje są realizowane przez modale, panele boczne i czytelne formularze. System powiadomień toast/snackbar zapewnia natychmiastową informację zwrotną, a krytyczne alerty są prezentowane globalnie. Do błędów dla uproszczenia wykorzystaj metodę inline. Dostęp do wszystkich widoków poza logowaniem/rejestracją wymaga autoryzacji.

## 2. Lista widoków

### 1. Logowanie / Rejestracja
- Ścieżka: `/login`, `/register`
- Cel: Umożliwienie użytkownikowi utworzenia konta i zalogowania się.
- Kluczowe informacje: Formularz e-mail/hasło, komunikaty o błędach, link do rejestracji/logowania.
- Kluczowe komponenty: Formularz logowania, formularz rejestracji, przyciski akcji, komunikaty błędów.
- UX/a11y/bezpieczeństwo: Walidacja pól, czytelne komunikaty, ochrona przed brute-force, automatyczne przekierowanie po utracie sesji.

### 2. Aktywna impreza
- Ścieżka: `/party`
- Cel: Rozpoczynanie imprezy, zarządzanie trwającą imprezą, dodawanie napojów, podgląd BAC, zamykanie imprezy, oznaczanie blackout.
- Kluczowe informacje: Lista napojów, aktualny BAC, alerty, snapshot profilu, status imprezy, przyciski akcji (dodaj napój, zamknij imprezę, oznacz blackout).
- Kluczowe komponenty: Tabela napojów, formularz dodawania/edycji napoju (modal), wskaźnik BAC, alerty, modale ostrzeżeń, przyciski akcji.
- UX/a11y/bezpieczeństwo: Blokada edycji po zamknięciu imprezy, ostrzeżenia przy nierealistycznych wartościach, powiadomienia toast, dostępność dla klawiatury i screen readerów (w późniejszych wersjach).
- przed rozpoczęciem tylko przycisk, który umożliwia rozpoczęcie imprezy.

### 3. Historia imprez
- Ścieżka: `/party/history`
- Cel: Przeglądanie poprzednich imprez, analiza wzorców picia, podgląd szczegółów imprezy.
- Kluczowe informacje: Lista imprez (data, suma alkoholu, max BAC, blackout), szczegóły imprezy (tabela napojów, snapshot profilu, BAC przed/po, alerty).
- Kluczowe komponenty: Tabela historii, panel szczegółów imprezy (modal/panel), przycisk odświeżania.
- UX/a11y/bezpieczeństwo: Buforowanie danych, ręczne odświeżanie, czytelność tabel, dostępność na mobile.

### 4. Profil użytkownika
- Ścieżka: `/profile`
- Cel: Uzupełnienie i edycja danych profilowych, zmiana progu BAC, podgląd historii progów.
- Kluczowe informacje: Formularz profilu (wzrost, waga, płeć), aktualny próg BAC, historia progów, komunikaty walidacyjne.
- Kluczowe komponenty: Formularz profilu, modal zmiany progu (z potwierdzeniem), tabela historii progów.
- UX/a11y/bezpieczeństwo: Walidacja zakresów, blokada rozpoczęcia imprezy przy niekompletnym profilu, jasne komunikaty, ochrona danych.

### 5. Globalne powiadomienia i alerty
- Ścieżka: (globalny komponent)
- Cel: Informowanie użytkownika o krytycznych i kontekstowych zdarzeniach (alerty BAC, błędy API, ostrzeżenia).
- Kluczowe informacje: Treść powiadomienia, typ (info/warning/error), akcje naprawcze.
- Kluczowe komponenty: Toast/snackbar, modal alertu, dla błędów inliny.
- UX/a11y/bezpieczeństwo: Widoczność na wszystkich widokach, czytelność, możliwość zamknięcia, wsparcie dla screen readerów (w późniejszych wersjach).

## 3. Mapa podróży użytkownika

1. Użytkownik otwiera aplikację i widzi ekran logowania/rejestracji.
2. Po zalogowaniu trafia na domyślny widok (Aktywna impreza, Historia i profil dostępne w panelu).
3. Jeśli profil nie jest kompletny, próba rozpoczęcia imprezy przekierowuje do widoku profilu z komunikatem.
4. W trakcie imprezy użytkownik dodaje napoje, widzi aktualizowany BAC i alerty.
5. Może edytować ostatni napój, zamknąć imprezę i oznaczyć blackout po jej zakończeniu (od razu po zakończeniu wyświetla się okienko z pytaniem czy był blackout).
6. Po zamknięciu imprezy dostępna jest tylko historia i podgląd szczegółów.
7. W każdej chwili może przejść do historii imprez lub profilu przez nawigację.
8. Zmiana progu BAC wymaga potwierdzenia w modalu.
9. Krytyczne alerty (np. przekroczenie progu, bliskość do progu) pojawiają się globalnie, inne kontekstowo.
10. Utrata sesji skutkuje automatycznym przekierowaniem na logowanie.

## 4. Układ i struktura nawigacji

- Dolna nawigacja (mobile) lub boczna (desktop):
  - Aktywna impreza
  - Historia imprez
  - Profil
- Logowanie/rejestracja dostępne tylko poza sesją.
- Przejścia między widokami bez przeładowania strony (SPA), z zachowaniem stanu.
- Przycisk odświeżania w sekcjach z buforowanymi danymi.
- Globalny kontekst autoryzacji, automatyczne przekierowanie po utracie sesji.

## 5. Kluczowe komponenty

- Formularz logowania/rejestracji
- Formularz profilu użytkownika
- Tabela napojów (z edycją ostatniego wpisu)
- Tabela historii imprez
- Wskaźnik BAC (aktualny/max)
- Komponent alertów i powiadomień (toast/snackbar, modal, lub inline dla błędów)
- Modal zmiany progu BAC z potwierdzeniem
- Panel szczegółów imprezy
- Dolna/boczna nawigacja
- Przycisk odświeżania
- Globalny kontekst autoryzacji i obsługi błędów
