<architecture_analysis>
1. **Wszystkie komponenty związane z autentykacją:**
   - Strony Astro: `/login.astro`, `/register.astro`
   - Layout: `LoginRegisterLayout.tsx`
   - Komponenty React:
     - `AuthForm.client.tsx` (eksportuje `AuthForm.tsx`)
     - `AuthForm.tsx` (główny formularz logowania/rejestracji)
     - `EmailInput.tsx`, `PasswordInput.tsx` (pola formularza z walidacją)
     - `ErrorMessage.tsx` (wyświetlanie błędów)
     - `SubmitButton.tsx` (przycisk z obsługą ładowania)
     - `SwitchAuthLink.tsx` (przełączanie trybu logowanie/rejestracja)
     - `GlobalAlertsProvider.tsx` (globalny kontekst alertów)
     - Hook: `useAuthForm.ts` (logika formularza, walidacja, obsługa stanu)
   - Komponenty profilowe (po rejestracji): `ProfileForm.tsx`, `ProfilePage.tsx`

2. **Główne strony i odpowiadające komponenty:**
   - `/login.astro` i `/register.astro`:
     - Używają `LoginRegisterLayout`
     - Renderują `AuthForm.client` (w trybie login lub register)
     - Komponenty podrzędne: `EmailInput`, `PasswordInput`, `ErrorMessage`, `SubmitButton`, `SwitchAuthLink`
   - Po zalogowaniu: przekierowanie do `/` lub `/profile.astro` (gdzie używany jest `ProfilePage` i `ProfileForm`)

3. **Przepływ danych:**
   - Użytkownik wprowadza dane w `AuthForm` → walidacja przez `useAuthForm` → wysyłka do endpointu `/api/login` lub `/api/register`
   - Błędy walidacji wyświetlane inline (`ErrorMessage`)
   - Po sukcesie: przekierowanie do strony głównej/profilu
   - Globalne alerty obsługiwane przez `GlobalAlertsProvider`
   - Po rejestracji/logowaniu użytkownik uzupełnia profil (`ProfileForm`)

4. **Opis funkcjonalności komponentów:**
   - `AuthForm`: główny formularz logowania/rejestracji, obsługuje walidację, wysyłkę, przekierowania
   - `EmailInput`, `PasswordInput`: kontrolki z walidacją i obsługą błędów
   - `ErrorMessage`: wyświetlanie komunikatów błędów (inline/globalnie)
   - `SubmitButton`: przycisk z obsługą stanu ładowania
   - `SwitchAuthLink`: link do przełączania trybu logowanie/rejestracja
   - `LoginRegisterLayout`: layout dla stron autentykacji (logo, tło, sekcja formularza)
   - `GlobalAlertsProvider`: kontekst i UI do globalnych alertów (np. błąd logowania)
   - `useAuthForm`: hook do obsługi stanu formularza, walidacji, błędów
   - `ProfileForm`, `ProfilePage`: formularz i strona do uzupełniania profilu po rejestracji

**Dodatkowe zależności:**
- Komponenty korzystają z Tailwind, Shadcn/ui, React.
- Przepływ: Strona Astro → Layout → Komponent React (AuthForm) → Komponenty podrzędne → API/backend.
- Alerty i błędy obsługiwane zarówno lokalnie (inline), jak i globalnie (GlobalAlertsProvider).
</architecture_analysis>

<mermaid_diagram>
```mermaid
flowchart TD
  subgraph "Strony Astro"
    LoginPage["/login.astro"]
    RegisterPage["/register.astro"]
  end

  subgraph "Layouty"
    LoginRegisterLayout["LoginRegisterLayout.tsx"]
  end

  subgraph "Komponenty React (autentykacja)"
    AuthFormClient["AuthForm.client.tsx"]
    AuthForm["AuthForm.tsx"]
    EmailInput["EmailInput.tsx"]
    PasswordInput["PasswordInput.tsx"]
    ErrorMessage["ErrorMessage.tsx"]
    SubmitButton["SubmitButton.tsx"]
    SwitchAuthLink["SwitchAuthLink.tsx"]
    useAuthForm["useAuthForm.ts"]
  end

  subgraph "Globalne alerty"
    GlobalAlertsProvider["GlobalAlertsProvider.tsx"]
  end

  subgraph "Profil użytkownika"
    ProfilePage["ProfilePage.tsx"]
    ProfileForm["ProfileForm.tsx"]
  end

  %% Połączenia stron i layoutu
  LoginPage --> LoginRegisterLayout
  RegisterPage --> LoginRegisterLayout

  %% Layout renderuje AuthForm.client
  LoginRegisterLayout --> AuthFormClient

  %% AuthForm.client eksportuje AuthForm
  AuthFormClient --> AuthForm

  %% AuthForm używa komponentów podrzędnych
  AuthForm --> EmailInput
  AuthForm --> PasswordInput
  AuthForm --> ErrorMessage
  AuthForm --> SubmitButton
  AuthForm --> SwitchAuthLink
  AuthForm --> useAuthForm

  %% Globalne alerty dostępne w całej aplikacji
  LoginRegisterLayout --> GlobalAlertsProvider
  GlobalAlertsProvider --- AuthForm
  GlobalAlertsProvider --- ProfilePage

  %% Po udanej rejestracji/logowaniu przekierowanie do profilu
  AuthForm -- "po sukcesie" --> ProfilePage
  ProfilePage --> ProfileForm

  %% Przepływ danych
  EmailInput -- "dane użytkownika" --> useAuthForm
  PasswordInput -- "dane użytkownika" --> useAuthForm
  AuthForm -- "błędy walidacji" --> ErrorMessage
  AuthForm -- "wysyłka do API (/api/login, /api/register)" --> Backend["Supabase API"]

  %% Alerty globalne
  AuthForm -- "błąd globalny" --> GlobalAlertsProvider
  ProfileForm -- "błąd globalny" --> GlobalAlertsProvider

  %% Zależności profilowe
  ProfilePage -- "dane profilu" --> ProfileForm

  %% Stylizacja
  classDef astro fill:#e0e7ff,stroke:#3730a3,stroke-width:2px;
  classDef layout fill:#f1f5f9,stroke:#0ea5e9,stroke-width:2px;
  classDef react fill:#fef9c3,stroke:#f59e42,stroke-width:2px;
  classDef alert fill:#fee2e2,stroke:#dc2626,stroke-width:2px;
  classDef profile fill:#d1fae5,stroke:#059669,stroke-width:2px;

  class LoginPage,RegisterPage astro;
  class LoginRegisterLayout layout;
  class AuthFormClient,AuthForm,EmailInput,PasswordInput,ErrorMessage,SubmitButton,SwitchAuthLink,useAuthForm react;
  class GlobalAlertsProvider alert;
  class ProfilePage,ProfileForm profile;
```
</mermaid_diagram>
