# API Endpoint Implementation Plan: GET /api/thresholds/current

## 1. Przegląd punktu końcowego

Endpoint `GET /api/thresholds/current` umożliwia użytkownikowi pobranie jego aktualnego progu BAC (Blood Alcohol Concentration). Próg ten jest używany przez system do generowania alertów i ostrzeżeń, gdy użytkownik zbliża się lub przekracza bezpieczny poziom zawartości alkoholu we krwi.

**Kluczowe funkcjonalności:**
- Zwraca aktywny próg użytkownika (gdzie `is_current = true`)
- Jeśli próg nie istnieje, automatycznie tworzy domyślny próg o wartości 1.0‰
- Wspiera US-010 (monitorowanie BAC) i US-014 (adaptacja progu)

**Wymagania biznesowe:**
- Każdy użytkownik musi mieć dokładnie jeden aktywny próg
- Domyślny próg wynosi 1.0‰ (powód: 'default')
- Tworzenie domyślnego progu loguje zdarzenie 'threshold_adjusted'

## 2. Szczegóły żądania

### Metoda HTTP
```
GET /api/thresholds/current
```

### Struktura URL
```
/api/thresholds/current
```

### Nagłówki
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Parametry

**Wymagane:**
- Brak parametrów ścieżki (path parameters)
- Brak parametrów zapytania (query parameters)
- Uwierzytelnienie: Token JWT w nagłówku Authorization

**Opcjonalne:**
- Brak

### Request Body
Brak - endpoint GET nie przyjmuje body

## 3. Wykorzystywane typy

### DTOs (Response)

**CurrentThresholdResponseDTO** (z `src/types.ts`):
```typescript
export interface CurrentThresholdResponseDTO {
  id: number;                          // ID progu
  user_id: string;                     // UUID użytkownika
  threshold_bac: number;               // Wartość progu BAC (decimal)
  reason: ThresholdReason;             // Powód ustawienia progu
  is_current: boolean;                 // Zawsze true dla tego endpointu
  trigger_party_id: number | null;     // ID imprezy wyzwalającej (jeśli dotyczy)
  created_at: string;                  // ISO 8601 timestamp utworzenia
}
```

**ThresholdReason** (enum z `src/types.ts`):
```typescript
export type ThresholdReason = "default" | "blackout_marked" | "manual_override";
```

### Entity Types

**UserThreshold** (z `src/types.ts`):
```typescript
export type UserThreshold = Tables<"userthresholds">;
// Pola: id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at
```

### Command Models
Brak - endpoint GET nie przyjmuje command modeli

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Nagłówki:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "id": 1,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "threshold_bac": 1.00,
  "is_current": true,
  "reason": "default",
  "trigger_party_id": null,
  "created_at": "2026-01-16T10:30:00.000Z"
}
```

### Error Responses

#### 401 Unauthorized
**Przyczyna:** Brak tokenu uwierzytelniającego lub token nieprawidłowy

**Body:**
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

#### 500 Internal Server Error
**Przyczyna:** Błąd bazy danych lub nieoczekiwany błąd aplikacji

**Body:**
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred"
}
```

**Uwaga:** Endpoint nie zwraca 404, ponieważ automatycznie tworzy domyślny próg, jeśli nie istnieje.

## 5. Przepływ danych

### Diagram przepływu

```
1. Żądanie HTTP GET /api/thresholds/current
   ↓
2. Middleware: Walidacja JWT token → user_id
   ↓
3. API Handler: src/pages/api/thresholds/current.ts
   ↓
4. Walidacja: Sprawdzenie Supabase client
   ↓
5. Walidacja: Pobranie user_id z uwierzytelnienia
   ↓
6. Service: threshold.service.ts → getCurrentThreshold(userId, supabase)
   ↓
7. Query: SELECT * FROM userthresholds WHERE user_id = $1 AND is_current = true
   ↓
8. Decyzja: Próg istnieje?
   ├─ TAK → Mapowanie do CurrentThresholdResponseDTO
   │         ↓
   │         Zwrócenie odpowiedzi 200 OK
   │
   └─ NIE → createDefaultThreshold(userId, supabase)
             ↓
             INSERT INTO userthresholds (user_id, threshold_bac, is_current, reason)
             VALUES ($1, 1.00, true, 'default')
             ↓
             logEvent(supabase, userId, 'threshold_adjusted')
             ↓
             Mapowanie do CurrentThresholdResponseDTO
             ↓
             Zwrócenie odpowiedzi 200 OK
```

### Interakcje z bazą danych

**Główne zapytanie:**
```sql
SELECT id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at
FROM userthresholds
WHERE user_id = $1 AND is_current = true
LIMIT 1;
```

**Zapytanie tworzące domyślny próg:**
```sql
INSERT INTO userthresholds (user_id, threshold_bac, is_current, reason)
VALUES ($1, 1.00, true, 'default')
RETURNING id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at;
```

**Event logging:**
```sql
INSERT INTO events (user_id, event_type, party_id)
VALUES ($1, 'threshold_adjusted', null);
```

### Transformacja danych

**Database Entity → DTO:**
```typescript
function mapToCurrentThresholdDTO(threshold: UserThreshold): CurrentThresholdResponseDTO {
  return {
    id: threshold.id,
    user_id: threshold.user_id,
    threshold_bac: threshold.threshold_bac,
    is_current: threshold.is_current,
    reason: threshold.reason,
    trigger_party_id: threshold.trigger_party_id,
    created_at: threshold.created_at, // Już w formacie ISO string z Supabase
  };
}
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- **Mechanizm:** JWT Bearer token w nagłówku Authorization
- **Implementacja:** Supabase Auth via middleware
- **Walidacja:** Wymagane w każdym żądaniu - token musi być prawidłowy i niewyga­słyAutoryzacja
- **Poziom:** Row Level Security (RLS) policies w Supabase
- **Polityka:** Użytkownik może odczytać tylko swoje progi
- **Implementacja:** RLS automatycznie filtruje wyniki po `user_id`

### Ochrona danych
- **PII (Personally Identifiable Information):** `user_id` (UUID)
- **Ekspozycja danych:** Tylko dane własne użytkownika, RLS zapewnia izolację
- **Logowanie:** Nie logować wrażliwych danych (tokeny, PII) w logach

### Walidacja danych wejściowych
- **Token JWT:** Walidowany przez middleware Supabase
- **user_id:** Wyodrębniony z zwalidowanego tokenu
- **Brak parametrów:** GET endpoint nie przyjmuje danych od użytkownika (poza tokenem)

### Ochrona przed atakami

**SQL Injection:**
- Zabezpieczenie: Supabase client używa przygotowanych zapytań (prepared statements)
- Ryzyko: Minimalne - brak bezpośredniego składania SQL

**CSRF (Cross-Site Request Forgery):**
- Zabezpieczenie: Bearer token w nagłówku (nie cookie)
- Ryzyko: Niskie - tokeny nie są automatycznie wysyłane przez przeglądarkę

**XSS (Cross-Site Scripting):**
- Zabezpieczenie: API zwraca JSON, frontend odpowiada za sanitization
- Ryzyko: Niskie - brak renderowania HTML po stronie backendu

**Rate Limiting:**
- Implementacja: TODO - rozważyć dodanie rate limiting w middleware
- Rekomendacja: 100 żądań/minutę na użytkownika

### Konfiguracja CORS
- Skonfigurować w Astro dla API endpoints
- Zezwolić tylko na zaufane domeny frontendowe

## 7. Obsługa błędów

### Hierarchia błędów (Early Returns Pattern)

```typescript
// 1. Walidacja Supabase client
if (!supabase) {
  return 500 Internal Server Error
}

// 2. Walidacja uwierzytelnienia
if (!userId) {
  return 401 Unauthorized
}

// 3. Query database
// (błędy RLS lub DB zwrócą 500 lub empty result)

// 4. Próg nie istnieje → stwórz domyślny
if (!threshold) {
  try {
    threshold = await createDefaultThreshold(userId, supabase);
  } catch (error) {
    return 500 Internal Server Error
  }
}

// 5. Happy path - zwróć próg
return 200 OK with threshold
```

### Szczegółowe scenariusze błędów

| Kod | Scenariusz | Przyczyna | Obsługa | Komunikat |
|-----|-----------|----------|---------|-----------|
| 401 | UNAUTHORIZED | Brak tokenu lub token nieprawidłowy | Zwróć error response | "Authentication required" |
| 401 | UNAUTHORIZED | Token wygasły | Zwróć error response | "Authentication required" |
| 403 | FORBIDDEN | RLS policy violation (teoretycznie niemożliwe) | Log error, zwróć 500 | "Access denied" |
| 500 | INTERNAL_SERVER_ERROR | Supabase client niedostępny | Log error, zwróć error response | "Database connection not available" |
| 500 | DATABASE_ERROR | Błąd SELECT query | Log error z detalami, zwróć generic error | "An unexpected error occurred" |
| 500 | DATABASE_ERROR | Błąd INSERT (tworzenie domyślnego progu) | Log error z detalami, zwróć generic error | "Failed to create default threshold" |
| 500 | EVENT_LOGGING_FAILED | Błąd logowania eventu (non-critical) | Log warning, nie przerywaj flow | (nie wpływa na response) |

### Logowanie błędów

**Format logów:**
```typescript
// Error log
logError("Failed to fetch current threshold", {
  userId,
  error: error.message,
  stack: error.stack,
});

// Warning log (non-critical)
logWarning("Event logging failed for default threshold creation", {
  userId,
  error: error.message,
});

// Info log (sukces)
logInfo("Default threshold created", {
  userId,
  thresholdId: threshold.id,
  thresholdBac: threshold.threshold_bac,
});
```

### Recovery Strategies

**Database connectivity issues:**
- Retry logic: Nie implementować na poziomie endpointu (zbyt wolne)
- Fallback: Zwrócić 500, klient powinien ponowić żądanie
- Monitoring: Alertować ops team o problemach z DB

**Default threshold creation fails:**
- Nie próbować ponownie automatycznie (może prowadzić do duplikatów)
- Zwrócić 500 z generic message
- User może spróbować ponownie (idempotentne)

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

**Główne zapytanie SELECT:**
```sql
-- Indeksy wykorzystywane:
-- 1. Index na (user_id, is_current) - zapewnia szybkie wyszukiwanie
-- 2. LIMIT 1 - zapobiega skanowaniu wielu wierszy

SELECT id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at
FROM userthresholds
WHERE user_id = $1 AND is_current = true
LIMIT 1;
```

**Wydajność:** O(1) lookup dzięki indeksowi

### Caching

**Client-side caching:**
- HTTP Cache-Control headers: `Cache-Control: private, max-age=300` (5 minut)
- Uzasadnienie: Próg zmienia się rzadko, cache redukuje obciążenie
- Uwaga: Cache musi być private (zawiera user_id)

**Server-side caching:**
- Nie wymagane dla tego endpointu
- Próg przechowywany w DB jest już zoptymalizowany (pojedynczy wiersz)

### Potencjalne wąskie gardła

**1. Database connection pool:**
- Problem: Wyczerpanie połączeń przy dużym ruchu
- Mitigation: Supabase zarządza poolem, monitorować użycie

**2. Cold starts (serverless):**
- Problem: Pierwsze żądanie może być wolne
- Mitigation: Keep-alive ping lub pre-warming

**3. RLS policy evaluation:**
- Problem: RLS może spowolnić query
- Mitigation: RLS policies są proste (WHERE user_id = auth.uid()), minimalne overhead

### Benchmarking

**Oczekiwane czasy odpowiedzi:**
- P50 (median): < 50ms
- P95: < 150ms
- P99: < 300ms

**Obciążenie:**
- Endpoint używany przy każdym dodaniu drinka (pośrednio)
- Bezpośrednie wywołania: rzadkie (głównie przy starcie sesji)
- Szacowane obciążenie: 10-50 żądań/minutę na użytkownika

### Monitoring metryk

**Key Performance Indicators (KPIs):**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Throughput (requests/second)
- Database query time
- Default threshold creation rate (powinno być rzadkie)

## 9. Etapy wdrożenia

### Krok 1: Utworzenie serwisu threshold.service.ts

**Lokalizacja:** `src/lib/services/threshold.service.ts`

**Funkcje do zaimplementowania:**

```typescript
/**
 * Retrieves the current active threshold for a user
 * @param userId - User's UUID
 * @param supabase - Supabase client instance
 * @returns Current threshold or null if not found
 */
export async function getCurrentThreshold(
  userId: string,
  supabase: SupabaseClient
): Promise<UserThreshold | null>

/**
 * Creates a default threshold for a user (1.0‰)
 * @param userId - User's UUID
 * @param supabase - Supabase client instance
 * @returns Newly created default threshold
 * @throws Error if creation fails
 */
export async function createDefaultThreshold(
  userId: string,
  supabase: SupabaseClient
): Promise<UserThreshold>
```

**Implementacja getCurrentThreshold:**
```typescript
const { data, error } = await supabase
  .from("userthresholds")
  .select("*")
  .eq("user_id", userId)
  .eq("is_current", true)
  .single();

if (error) {
  // Jeśli PGRST116 (not found), zwróć null
  if (error.code === "PGRST116") return null;
  throw error;
}

return data;
```

**Implementacja createDefaultThreshold:**
```typescript
const DEFAULT_THRESHOLD_BAC = 1.00;

const { data, error } = await supabase
  .from("userthresholds")
  .insert({
    user_id: userId,
    threshold_bac: DEFAULT_THRESHOLD_BAC,
    is_current: true,
    reason: "default",
    trigger_party_id: null,
  })
  .select()
  .single();

if (error) throw error;

// Log event (non-critical, don't throw on failure)
await logEvent(supabase, userId, "threshold_adjusted");

return data;
```

### Krok 2: Utworzenie API endpoint handler

**Lokalizacja:** `src/pages/api/thresholds/current.ts`

**Struktura pliku:**
```typescript
import type { APIRoute } from "astro";
import { getAuthenticatedUserId, validateSupabaseClient, createErrorResponse } from "../../../lib/api-helpers";
import { getCurrentThreshold, createDefaultThreshold } from "../../../lib/services/threshold.service";
import type { CurrentThresholdResponseDTO } from "../../../types";
import { logError, logInfo } from "../../../lib/logger";

// Disable prerendering - this is a server-side API route
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  // Implementation here
};
```

### Krok 3: Implementacja handlera GET

**Logika:**

```typescript
export const GET: APIRoute = async ({ locals }) => {
  // 1. Validate Supabase client
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // 2. Get authenticated user ID
  const userIdResult = getAuthenticatedUserId();
  if (!userIdResult.success) return userIdResult.response;
  const userId = userIdResult.value;

  try {
    // 3. Fetch current threshold
    let threshold = await getCurrentThreshold(userId, supabase);

    // 4. If not found, create default threshold
    if (!threshold) {
      logInfo("No threshold found for user, creating default", { userId });
      threshold = await createDefaultThreshold(userId, supabase);
    }

    // 5. Map to DTO
    const responseDTO: CurrentThresholdResponseDTO = {
      id: threshold.id,
      user_id: threshold.user_id,
      threshold_bac: threshold.threshold_bac,
      is_current: threshold.is_current,
      reason: threshold.reason,
      trigger_party_id: threshold.trigger_party_id,
      created_at: threshold.created_at,
    };

    // 6. Return success response
    return new Response(JSON.stringify(responseDTO), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300", // 5 minutes
      },
    });
  } catch (error) {
    logError("Failed to get current threshold", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
      500
    );
  }
};
```

### Krok 4: Walidacja polityk RLS w Supabase

**Sprawdzenie:**

1. Zalogować się jako użytkownik A
2. Wywołać GET /api/thresholds/current
3. Sprawdzić, czy zwraca tylko próg użytkownika A
4. Próba bezpośredniego zapytania SQL z innym user_id (powinno zwrócić pusty wynik)

**Polityka RLS do weryfikacji:**
```sql
-- Policy: Użytkownicy mogą odczytać tylko swoje progi
CREATE POLICY "Users can read their own thresholds"
ON userthresholds
FOR SELECT
USING (auth.uid() = user_id);
```

### Krok 5: Monitoring i logowanie

**Dodać:**

1. **Request logging:**
   - Log każdego żądania (userId, timestamp, response status)
   - Użyć `logInfo` dla sukcesu, `logError` dla błędów

2. **Metrics:**
   - Czas odpowiedzi endpointu
   - Liczba utworzonych domyślnych progów (anomalie mogą wskazywać problem)
   - Error rate (4xx, 5xx)

3. **Alerts:**
   - Alert gdy error rate > 5%
   - Alert gdy czas odpowiedzi P99 > 500ms
   - Alert gdy wiele domyślnych progów tworzonych jednocześnie (może wskazywać bug)

### Krok 6: Dokumentacja API

**Zaktualizować:**

1. **OpenAPI/Swagger specification:**
   - Dodać endpoint GET /api/thresholds/current
   - Udokumentować request/response schemas
   - Dodać przykłady

2. **README.md projektu:**
   - Dodać endpoint do listy dostępnych API
   - Udokumentować autentykację

3. **Inline documentation:**
   - JSDoc comments w threshold.service.ts
   - JSDoc comments w API handler

### Krok 7: Code review checklist

**Przed złożeniem PR sprawdzić:**

- [ ] Kod zgodny z guidelines projektu (`.ai/copilot-instructions.md`)
- [ ] Użyto TypeScript strict mode bez błędów
- [ ] Obsługa błędów zgodna z early returns pattern
- [ ] Logowanie błędów i info events
- [ ] RLS policies przetestowane
- [ ] Cache headers ustawione poprawnie
- [ ] Dokumentacja API zaktualizowana
- [ ] Brak hardcoded secrets lub credentials
- [ ] Event logging dla utworzenia domyślnego progu
- [ ] Kod sformatowany (prettier/eslint)

### Krok 10: Deployment

**Przed wdrożeniem na produkcję:**

1. **Sprawdzić środowisko:**
   - Zweryfikować zmienne środowiskowe (Supabase URL, keys)
   - Sprawdzić, czy RLS policies są aktywne

2. **Rollback plan:**
   - Przygotować plan wycofania zmian w razie problemów
   - Upewnić się, że poprzednia wersja jest dostępna

3. **Monitoring:**
   - Śledzić logi i metryki przez pierwsze 24h po wdrożeniu
   - Ustawić alerty na anomalie

---

## Appendix A: Przykładowe zapytania cURL

### Pobranie aktualnego progu (z istniejącym progiem)

```bash
curl -X GET https://your-domain.com/api/thresholds/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response (200 OK):**
```json
{
  "id": 5,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "threshold_bac": 1.00,
  "is_current": true,
  "reason": "default",
  "trigger_party_id": null,
  "created_at": "2026-01-16T10:30:00.000Z"
}
```

### Pobranie aktualnego progu (pierwszy raz - stworzenie domyślnego)

```bash
curl -X GET https://your-domain.com/api/thresholds/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "threshold_bac": 1.00,
  "is_current": true,
  "reason": "default",
  "trigger_party_id": null,
  "created_at": "2026-01-16T15:45:23.123Z"
}
```

### Błąd uwierzytelniania

```bash
curl -X GET https://your-domain.com/api/thresholds/current \
  -H "Content-Type: application/json"
```

**Response (401 Unauthorized):**
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

## Appendix B: Struktura plików po implementacji

```
src/
├── lib/
│   └── services/
│       ├── threshold.service.ts          # ← NOWY PLIK
│       ├── profile.service.ts            # istniejący
│       ├── party.service.ts              # istniejący
│       ├── drink.service.ts              # istniejący
│       ├── bac.service.ts                # istniejący
│       └── event.service.ts              # istniejący
├── pages/
│   └── api/
│       ├── thresholds/
│       │   └── current.ts                # ← NOWY PLIK
│       ├── parties.ts                    # istniejący
│       └── profile.ts                    # istniejący
└── types.ts                              # istniejący (użyty)
```

## Appendix C: Zależności zewnętrzne

**NPM Packages (już zainstalowane):**
- `@supabase/supabase-js` - klient Supabase
- `astro` - framework API
- `typescript` - typowanie

**Supabase Resources:**
- Tabela: `userthresholds`
- Tabela: `events`
- RLS Policies na `userthresholds`
- Index: `(user_id, is_current)` na `userthresholds`

**Brak dodatkowych zależności do instalacji.**
