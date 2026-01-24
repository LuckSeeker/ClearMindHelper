# Plan implementacji widoku logowanie-rejestracja

## 1. Przegląd
Widok logowania i rejestracji umożliwia użytkownikom utworzenie nowego konta oraz zalogowanie się do aplikacji ClearMindHelper. Zapewnia bezpieczną autentykację, walidację danych wejściowych oraz czytelne komunikaty o błędach. Po zalogowaniu lub rejestracji użytkownik uzyskuje dostęp do funkcji aplikacji, a jego sesja jest utrzymywana.

## 2. Routing widoku
- `/login` — widok logowania
- `/register` — widok rejestracji

## 3. Struktura komponentów
- LoginRegisterLayout (layout wspólny)
  - AuthForm (formularz logowania lub rejestracji)
    - EmailInput
    - PasswordInput
    - ErrorMessage
    - SubmitButton
    - SwitchAuthLink (przełącznik login/rejestracja)

## 4. Szczegóły komponentów
### LoginRegisterLayout
- Opis: Layout otaczający formularz, zapewnia spójny wygląd, tytuł, logo, sekcję na komunikaty globalne.
- Główne elementy: <main>, <section>, logo, children
- Obsługiwane interakcje: brak (tylko prezentacja)
- Obsługiwana walidacja: brak
- Typy: React.PropsWithChildren
- Propsy: children

### AuthForm
- Opis: Główny formularz logowania lub rejestracji, obsługuje walidację, wysyłkę do API, wyświetlanie błędów.
- Główne elementy: <form>, EmailInput, PasswordInput, ErrorMessage, SubmitButton, SwitchAuthLink
- Obsługiwane interakcje: submit, input change, switch trybu
- Obsługiwana walidacja: email (format, wymagane), hasło (min. 8 znaków, wymagane)
- Typy: AuthFormViewModel, APIError
- Propsy: mode ("login" | "register")

### EmailInput
- Opis: Pole do wprowadzania adresu e-mail, z walidacją i obsługą błędów.
- Główne elementy: <input type="email">, <label>, <span> (błąd)
- Obsługiwane interakcje: onChange, onBlur
- Obsługiwana walidacja: email (format, wymagane)
- Typy: string, ValidationError
- Propsy: value, onChange, error

### PasswordInput
- Opis: Pole do wprowadzania hasła, z walidacją i obsługą błędów.
- Główne elementy: <input type="password">, <label>, <span> (błąd)
- Obsługiwane interakcje: onChange, onBlur
- Obsługiwana walidacja: hasło (min. 8 znaków, wymagane)
- Typy: string, ValidationError
- Propsy: value, onChange, error

### ErrorMessage
- Opis: Komponent wyświetlający komunikaty o błędach globalnych (np. błąd API, nieprawidłowe dane).
- Główne elementy: <div>, <span>
- Obsługiwane interakcje: brak
- Obsługiwana walidacja: brak
- Typy: string
- Propsy: message

### SubmitButton
- Opis: Przycisk wysyłający formularz, obsługuje loading state.
- Główne elementy: <button>
- Obsługiwane interakcje: onClick
- Obsługiwana walidacja: blokada przy niepoprawnych danych lub loadingu
- Typy: boolean
- Propsy: disabled, loading

### SwitchAuthLink
- Opis: Link umożliwiający przełączenie między logowaniem a rejestracją.
- Główne elementy: <a>
- Obsługiwane interakcje: onClick
- Obsługiwana walidacja: brak
- Typy: brak
- Propsy: mode

## 5. Typy
- AuthFormViewModel: { email: string; password: string; errors: { email?: string; password?: string }; loading: boolean; apiError?: string }
- APIError: { code: string; message: string; details?: Record<string, unknown> }
- ValidationError: { field: string; message: string }

## 6. Zarządzanie stanem
Stan formularza zarządzany lokalnie w komponencie AuthForm (useState/useReducer). Stan loading, wartości pól, błędy walidacji i błędy API. Możliwy custom hook useAuthForm do obsługi logiki formularza i integracji z API.

## 7. Integracja API
- POST `/api/register` — rejestracja użytkownika (body: { email, password })
  - Odpowiedź: sukces (sesja, przekierowanie), błąd (APIError)
- POST `/api/login` — logowanie użytkownika (body: { email, password })
  - Odpowiedź: sukces (sesja, przekierowanie), błąd (APIError)
- Typy żądań/odpowiedzi: Request: { email: string; password: string }, Response: { session: SessionDTO } lub APIError

## 8. Interakcje użytkownika
- Wypełnienie pól e-mail/hasło → walidacja na bieżąco
- Kliknięcie „Zarejestruj się”/„Zaloguj się” → wysyłka do API
- Błąd walidacji → wyświetlenie komunikatu pod polem
- Błąd API → wyświetlenie komunikatu globalnego
- Przełączenie trybu → zmiana widoku
- Po sukcesie → przekierowanie do głównego widoku aplikacji

## 9. Warunki i walidacja
- E-mail: wymagany, poprawny format (RFC 5322)
- Hasło: wymagane, min. 8 znaków
- Blokada submit przy błędach lub loadingu
- Obsługa błędów 401/409 (np. użytkownik istnieje, nieprawidłowe dane)

## 10. Obsługa błędów
- Walidacja frontendowa i backendowa
- Wyświetlanie błędów pod polami i globalnie
- Obsługa błędów sieciowych, rate limiting, brute-force (np. blokada po X próbach)
- Przekierowanie po utracie sesji

## 11. Kroki implementacji
1. Utwórz layout LoginRegisterLayout
2. Utwórz komponent AuthForm z obsługą trybu login/register
3. Dodaj komponenty EmailInput, PasswordInput, ErrorMessage, SubmitButton, SwitchAuthLink
4. Zaimplementuj walidację pól i obsługę błędów
5. Zaimplementuj integrację z API (fetch/axios, obsługa loadingu, błędów)
6. Dodaj przekierowanie po sukcesie
7. Dodaj testy walidacji i obsługi błędów
8. Zadbaj o dostępność (aria, role, focus management)
9. Dodaj stylowanie z użyciem Tailwind i Shadcn/ui
10. Przetestuj scenariusze edge-case (utrata sesji, brute-force, błędy sieci)
