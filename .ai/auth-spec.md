# Specyfikacja architektury modułu rejestracji, logowania i odzyskiwania hasła

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### Struktura i podział odpowiedzialności

#### Strony Astro
- `/login.astro` — strona logowania (widok formularza logowania, obsługa przekierowań po zalogowaniu, renderowanie komunikatów globalnych)
- `/register.astro` — strona rejestracji (widok formularza rejestracji, obsługa przekierowań po rejestracji, renderowanie komunikatów globalnych)
- `/reset-password.astro` — strona odzyskiwania hasła (widok formularza do podania e-maila, obsługa komunikatów)
- `/` oraz inne strony — warstwa ochrony: przekierowanie na `/login` jeśli użytkownik nie jest zalogowany (middleware lub logika SSR)

#### Komponenty React (client-side)
- `AuthForm.client.tsx` — uniwersalny formularz obsługujący tryby: logowanie, rejestracja, reset hasła (przełączane przez props lub routing)
- `EmailInput.tsx`, `PasswordInput.tsx` — kontrolki z walidacją inline (format e-mail, długość hasła, wymagane pola)
- `InlineError.tsx`, `ErrorMessage.tsx` — wyświetlanie błędów walidacji i komunikatów backendu
- `SubmitButton.tsx` — obsługa stanu ładowania, blokada przy wysyłce
- `SwitchAuthLink.tsx` — linki do przełączania trybów (np. „Nie masz konta? Zarejestruj się”)
- `GlobalAlertsProvider.tsx` — kontekst do wyświetlania globalnych alertów (np. sukces rejestracji, błąd logowania)

#### Layouty
- `LoginRegisterLayout.tsx` — dedykowany layout dla stron auth (prosty, bez nawigacji aplikacji, z logo i tłem)
- `Layout.astro` — główny layout aplikacji, renderuje nawigację i treść tylko dla zalogowanych

### Walidacja i obsługa błędów
- Walidacja po stronie klienta: format e-mail, długość hasła, wymagane pola
- Walidacja po stronie backendu: powtórzenie walidacji, obsługa błędów Supabase (np. user already exists, invalid credentials)
- Komunikaty błędów: wyświetlane inline pod polami oraz globalnie (np. alert na górze formularza)
- Scenariusze: nieprawidłowe dane, próba rejestracji istniejącego konta, błędny e-mail do resetu, zablokowane konto, błąd sieci

### Przypadki użycia
- Rejestracja: e-mail + hasło, walidacja, obsługa błędów, przekierowanie do profilu po sukcesie
- Logowanie: e-mail + hasło, walidacja, obsługa błędów, przekierowanie do strony głównej po sukcesie
- Odzyskiwanie hasła: e-mail, walidacja, obsługa błędów, komunikat o wysłaniu maila
- Wylogowanie: przycisk w menu użytkownika, czyszczenie sesji, przekierowanie na `/login`

## 2. LOGIKA BACKENDOWA

### Endpointy API
- `/api/auth/register` — POST, rejestracja użytkownika (wywołuje Supabase Auth, tworzy rekord profilu z pustymi polami)
- `/api/auth/login` — POST, logowanie użytkownika (Supabase Auth, zwraca sesję/token)
- `/api/auth/logout` — POST, wylogowanie (inwalidacja sesji po stronie Supabase)
- `/api/auth/reset-password` — POST, wysyłka maila resetującego (Supabase Auth)

### Modele danych
- Użytkownik: zarządzany przez Supabase Auth (e-mail, hash hasła, id)
- Profil: tabela powiązana z user_id, pola: wzrost, waga, płeć (inicjalnie puste)

### Walidacja i obsługa wyjątków
- Walidacja wejścia: Zod (na endpointach API)
- Obsługa błędów: mapowanie kodów Supabase na komunikaty dla UI, logowanie błędów krytycznych
- Odpowiedzi API: JSON z polem `success`, `error`, ewentualnie `data`

### Renderowanie server-side
- SSR: sprawdzanie sesji użytkownika (cookie/token) na każdej stronie wymagającej autoryzacji
- Middleware: przekierowanie na `/login` jeśli brak sesji

## 3. SYSTEM AUTENTYKACJI

### Supabase Auth
- Rejestracja: `supabase.auth.signUp({ email, password })`
- Logowanie: `supabase.auth.signInWithPassword({ email, password })`
- Wylogowanie: `supabase.auth.signOut()`
- Reset hasła: `supabase.auth.resetPasswordForEmail(email)`
- Obsługa sesji: przechowywanie tokenu w cookie HTTP-only, odświeżanie sesji po stronie klienta i serwera
- Integracja z Astro: korzystanie z SupabaseClient z `context.locals` w endpointach, nie importować bezpośrednio
- Ochrona endpointów: sprawdzanie sesji/tokenu na backendzie, middleware Astro

### Bezpieczeństwo
- Hasła przechowywane jako hash (Supabase, domyślnie bcrypt)
- Brak 2FA i weryfikacji wieku (zgodnie z PRD)
- Ochrona endpointów i stron przez middleware

---

**Podsumowanie:**
Architektura zakłada rozdział odpowiedzialności: strony Astro odpowiadają za routing i SSR, React za interaktywność i walidację formularzy. Backend oparty o Supabase Auth, z dedykowanymi endpointami API i walidacją Zod. Sesje zarządzane przez Supabase, ochrona stron przez middleware. Komunikaty błędów i sukcesów obsługiwane zarówno inline, jak i globalnie. Całość zgodna z wymaganiami US-001 i US-002 oraz stackiem technologicznym.
