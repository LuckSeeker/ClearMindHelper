# API Endpoint Implementation Plan: GET Current BAC

## 1. Przegląd punktu końcowego

Endpoint `GET /api/parties/:partyId/bac/current` oblicza i zwraca aktualne szacowane stężenie alkoholu we krwi (BAC) dla trwającej imprezy. Jest to endpoint read-only, który wykonuje kalkulacje w czasie rzeczywistym na podstawie ostatniego zapisanego obliczenia BAC, stosując algorytm Widmarka do modelowania metabolizmu alkoholu w czasie. Endpoint służy do realizacji user stories US-010 (wyświetlanie aktualnego BAC) i US-011 (porównanie z progiem osobistym).

**Kluczowe cechy:**
- Real-time calculation (nie zapisuje wyniku do bazy)
- Stosuje time-based decay na podstawie algorytmu Widmarka
- Porównuje aktualny BAC z personalnym progiem użytkownika
- Oblicza szacowany czas do pełnego wytrzeźwienia
- Wymaga aktywnej sesji (ongoing party) z przynajmniej jednym napojem

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/parties/:partyId/bac/current
```

### Parametry

**Wymagane:**
- **Path parameter:**
  - `partyId` (bigint) - Identyfikator imprezy, dla której obliczane jest BAC

- **Headers:**
  - `Authorization: Bearer {access_token}` - Token uwierzytelniający użytkownika Supabase

**Opcjonalne:**
- Brak

### Request Body
Brak (GET request)

### Przykład żądania
```http
GET /api/parties/123/bac/current HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

> **WAŻNE:** Zgodnie z zasadami projektowymi, `src/types.ts` jest źródłem prawdy dla wszystkich typów DTO i Command Models. 
> 
> **Hierarchia użycia typów:**
> 1. **NAJPIERW** - sprawdź i użyj istniejących typów z `src/types.ts`
> 2. **NASTĘPNIE** - zmodyfikuj istniejące typy jeśli specyfikacja API wymaga zmian
> 3. **TYLKO W OSTATECZNOŚCI** - utwórz nowe typy jeśli absolutnie brakuje w types.ts

### Istniejące typy (wymagające modyfikacji)

**CurrentBACResponseDTO** - już istnieje w `src/types.ts`, wymaga aktualizacji aby dopasować do specyfikacji:

```typescript
// Obecna wersja w types.ts:
export interface CurrentBACResponseDTO {
  party_id: number;
  current_bac: number;
  threshold_bac: number;
  time_since_last_drink_minutes: number;
  is_approaching_threshold: boolean;
  is_over_threshold: boolean;
  estimated_time_to_sober_minutes: number | null;
}

// Wymagana wersja zgodna ze specyfikacją:
export interface CurrentBACResponseDTO {
  party_id: number;
  current_bac: number;
  calculated_at: string; // ISO 8601 timestamp
  time_since_last_drink_minutes: number;
  time_since_first_drink_minutes: number;
  current_threshold: number;
  threshold_status: 'safe' | 'approaching' | 'exceeded';
  estimated_time_to_sober_minutes: number | null;
}
```

### Nowe typy pomocnicze (tylko dla service layer)

> **Uwaga:** Te typy są używane TYLKO wewnętrznie w `bac.service.ts` i **NIE** powinny być dodawane do `src/types.ts`, 
> ponieważ nie są częścią publicznego API.

```typescript
// Wewnętrzny typ do obliczeń BAC (nie eksportowany, tylko dla service)
interface BACDecayCalculation {
  original_bac: number;
  time_elapsed_minutes: number;
  metabolized_alcohol_g: number;
  current_bac: number;
}

// Typ dla threshold status determination (nie eksportowany, tylko dla service)
type ThresholdStatus = 'safe' | 'approaching' | 'exceeded';

// Stałe dla algorytmu (w service file)
const WIDMARK_CONSTANTS = {
  MALE_R: 0.68,    // Współczynnik dystrybucji wody dla mężczyzn
  FEMALE_R: 0.55,  // Współczynnik dystrybucji wody dla kobiet
  METABOLISM_RATE_PER_HOUR: 0.15, // g/kg/h (standardowa stawka metabolizmu)
  APPROACHING_THRESHOLD_MARGIN: 0.10 // Próg "approaching" = threshold - 0.10‰
};
```

### Typy z bazy danych (już istniejące w `src/types.ts`)

> **Te typy już istnieją** - używaj ich bezpośrednio bez modyfikacji:

- `PartyDTO` - do weryfikacji statusu i ownership
- `BACCalculationDTO` - ostatnie obliczenie BAC jako punkt startowy
- `DrinkDTO` - do określenia czasu od pierwszego napoju
- `CurrentThresholdResponseDTO` - aktualny próg użytkownika
- `ProfileSnapshot` - dane użytkownika do obliczeń
- `PartyStatus` - enum ('ongoing' | 'closed')
- `Gender` - enum ('M' | 'F')

### Podsumowanie podejścia do typów

**✅ DO:**
- Sprawdź `src/types.ts` PRZED utworzeniem nowego typu
- Użyj istniejących typów Entity i DTO
- Zmodyfikuj istniejące DTO jeśli specyfikacja się zmienia
- Dokumentuj zmiany w istniejących typach

**❌ NIE RÓB:**
- Nie twórz duplikatów typów, które już istnieją
- Nie dodawaj wewnętrznych typów service do `src/types.ts`
- Nie modyfikuj Entity typów (te pochodzą z database.types.ts)
- Nie twórz nowych typów bez sprawdzenia czy już istnieją

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "party_id": 123,
  "current_bac": 0.58,
  "calculated_at": "2026-01-15T20:45:30.123Z",
  "time_since_last_drink_minutes": 23,
  "time_since_first_drink_minutes": 145,
  "current_threshold": 0.65,
  "threshold_status": "safe",
  "estimated_time_to_sober_minutes": 232
}
```

**Pola odpowiedzi:**
- `party_id` (number) - ID imprezy
- `current_bac` (number) - Aktualne BAC w promilach (‰) po zastosowaniu time decay
- `calculated_at` (string) - ISO 8601 timestamp momentu obliczenia
- `time_since_last_drink_minutes` (number) - Minuty od ostatniego napoju
- `time_since_first_drink_minutes` (number) - Minuty od pierwszego napoju w sesji
- `current_threshold` (number) - Aktualny osobisty próg użytkownika w ‰
- `threshold_status` (string) - Status względem progu: "safe" | "approaching" | "exceeded"
- `estimated_time_to_sober_minutes` (number | null) - Szacowany czas do BAC = 0.00‰, null jeśli już trzeźwy

### Error Responses

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**Przyczyny:**
- Brak header Authorization
- Invalid/expired token
- Token nie może być zweryfikowany przez Supabase

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have access to this party"
  }
}
```

**Przyczyny:**
- Party należy do innego użytkownika

**Uwaga bezpieczeństwa:** W produkcji rozważyć zwracanie 404 zamiast 403 aby unikać user enumeration (nie ujawniać czy party istnieje).

#### 404 Not Found

```json
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```

```json
{
  "error": {
    "code": "NO_DRINKS_YET",
    "message": "This party has no drinks recorded yet"
  }
}
```

```json
{
  "error": {
    "code": "PARTY_CLOSED",
    "message": "Cannot calculate current BAC for a closed party"
  }
}
```

**Przyczyny:**
- Party o podanym ID nie istnieje
- Party nie ma jeszcze żadnych napojów
- Party jest w statusie 'closed' (nie 'ongoing')

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred while calculating BAC"
  }
}
```

**Przyczyny:**
- Database connection error
- Błąd w obliczeniach matematycznych
- Missing profile snapshot data
- Nieoczekiwany błąd aplikacji

## 5. Przepływ danych

### High-level flow diagram

```
Client Request
    ↓
[Middleware: Auth validation] → 401 if invalid token
    ↓
[Route Handler: /api/parties/[id]/bac/current.ts]
    ↓
[Validate partyId parameter] → 400 if invalid
    ↓
[BAC Service: getCurrentBAC(partyId, userId)]
    ↓
┌─────────────────────────────────────────────┐
│ 1. Fetch Party by ID                        │ → 404 if not found
│    - Verify ownership (user_id match)       │ → 403 if not owner
│    - Verify status = 'ongoing'              │ → 404 if closed
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 2. Fetch Latest BACCalculation for party    │ → 404 if no drinks
│    - Order by drink.consumed_at DESC        │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 3. Fetch First Drink in party               │
│    - Order by consumed_at ASC LIMIT 1       │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 4. Fetch Current User Threshold             │
│    - WHERE user_id AND is_current = true    │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 5. Calculate Current BAC with Time Decay    │
│    - Time elapsed since last calculation    │
│    - Apply Widmark metabolism rate          │
│    - Metabolized = rate * weight * time     │
│    - New BAC = old BAC - metabolized        │
│    - Floor at 0.00 (never negative)         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 6. Determine Threshold Status               │
│    - "exceeded": BAC >= threshold           │
│    - "approaching": BAC >= threshold - 0.10 │
│    - "safe": BAC < threshold - 0.10         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 7. Calculate Time to Sober                  │
│    - If BAC > 0: minutes = BAC / rate * 60  │
│    - If BAC = 0: null                       │
└─────────────────────────────────────────────┘
    ↓
[Format Response: CurrentBACResponseDTO]
    ↓
[Return 200 OK with JSON]
```

### Szczegółowy przepływ w service layer

**Funkcja: `getCurrentBAC(partyId: number, userId: string): Promise<CurrentBACResponseDTO>`**

1. **Fetch party with ownership verification:**
   ```typescript
   const { data: party, error } = await supabase
     .from('parties')
     .select('*')
     .eq('id', partyId)
     .eq('user_id', userId)
     .single();
   
   if (error || !party) throw NotFoundError;
   if (party.status !== 'ongoing') throw PartyClosedError;
   ```

2. **Fetch latest BAC calculation:**
   ```typescript
   const { data: latestBAC } = await supabase
     .from('baccalculations')
     .select('*, drinks!inner(consumed_at)')
     .eq('party_id', partyId)
     .order('drinks(consumed_at)', { ascending: false })
     .limit(1)
     .single();
   
   if (!latestBAC) throw NoDrinksYetError;
   ```

3. **Fetch first drink for time_since_first_drink:**
   ```typescript
   const { data: firstDrink } = await supabase
     .from('drinks')
     .select('consumed_at')
     .eq('party_id', partyId)
     .order('consumed_at', { ascending: true })
     .limit(1)
     .single();
   ```

4. **Fetch current threshold:**
   ```typescript
   const { data: threshold } = await supabase
     .from('userthresholds')
     .select('threshold_bac')
     .eq('user_id', userId)
     .eq('is_current', true)
     .single();
   
   const currentThreshold = threshold?.threshold_bac ?? 0.20; // default: legal limit in Poland
   ```

5. **Calculate time-based BAC decay:**
   ```typescript
   const now = new Date();
   const lastCalcTime = new Date(latestBAC.calculation_timestamp);
   const timeElapsedMinutes = differenceInMinutes(now, lastCalcTime);
   
   const profile = latestBAC.user_profile_snapshot;
   const rValue = profile.gender === 'M' ? 0.68 : 0.55;
   const metabolismRate = 0.15; // g/kg/h
   
   const metabolizedPerMinute = (metabolismRate * profile.weight_kg) / 60;
   const totalMetabolized = metabolizedPerMinute * timeElapsedMinutes;
   
   // Convert to BAC decrease (Widmark formula inverse)
   const bacDecrease = totalMetabolized / (profile.weight_kg * rValue * 10);
   
   const currentBAC = Math.max(0, latestBAC.calculated_bac - bacDecrease);
   ```

6. **Determine threshold status:**
   ```typescript
   let thresholdStatus: ThresholdStatus;
   if (currentBAC >= currentThreshold) {
     thresholdStatus = 'exceeded';
   } else if (currentBAC >= currentThreshold - 0.10) {
     thresholdStatus = 'approaching';
   } else {
     thresholdStatus = 'safe';
   }
   ```

7. **Calculate estimated time to sober:**
   ```typescript
   let estimatedTimeToSober: number | null = null;
   if (currentBAC > 0) {
     const bacRemaining = currentBAC;
     const hoursToSober = bacRemaining / (metabolismRate / 10);
     estimatedTimeToSober = Math.ceil(hoursToSober * 60);
   }
   ```

8. **Return formatted response:**
   ```typescript
   return {
     party_id: partyId,
     current_bac: Number(currentBAC.toFixed(2)),
     calculated_at: now.toISOString(),
     time_since_last_drink_minutes: timeElapsedMinutes,
     time_since_first_drink_minutes: differenceInMinutes(now, firstDrink.consumed_at),
     current_threshold: currentThreshold,
     threshold_status: thresholdStatus,
     estimated_time_to_sober_minutes: estimatedTimeToSober
   };
   ```

## 6. Względy bezpieczeństwa

### 1. Autentykacja i autoryzacja

**Middleware authentication:**
- Endpoint wymaga valid Supabase access token w header Authorization
- Middleware waliduje token przed dotarciem do route handler
- Invalid/expired token → 401 Unauthorized

**Authorization w service layer:**
- Weryfikacja ownership poprzez `.eq('user_id', userId)` w query
- RLS policies w Supabase jako druga warstwa obrony
- Nie pozwalać na dostęp do parties innych użytkowników

**Security through obscurity:**
- Rozważyć zwracanie 404 zamiast 403 gdy party należy do innego usera
- Unikać ujawniania informacji czy party istnieje (user enumeration)

### 2. Walidacja danych wejściowych

**Path parameter validation:**
```typescript
import { z } from 'zod';

const PartyIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});
```

- Walidować że partyId jest valid number
- Reject non-numeric values → 400 Bad Request
- Prevent SQL injection (choć Supabase SDK chroni)

### 3. RLS Policies w Supabase

Upewnić się że następujące policies są aktywne:

```sql
-- Parties: user może SELECT tylko swoje parties
CREATE POLICY "Users can view own parties"
  ON parties FOR SELECT
  USING (auth.uid() = user_id);

-- BACCalculations: user może SELECT tylko swoje calculations
CREATE POLICY "Users can view own BAC calculations"
  ON baccalculations FOR SELECT
  USING (auth.uid() = user_id);

-- Drinks: user może SELECT tylko swoje drinks
CREATE POLICY "Users can view own drinks"
  ON drinks FOR SELECT
  USING (auth.uid() = user_id);

-- UserThresholds: user może SELECT tylko swoje thresholds
CREATE POLICY "Users can view own thresholds"
  ON userthresholds FOR SELECT
  USING (auth.uid() = user_id);
```

### 4. Rate limiting

**Rozważyć implementację rate limiting:**
- Endpoint może być często wywoływany (real-time updates w UI)
- Limit: np. 60 requests/minute per user
- Implementacja przez Astro middleware lub edge functions
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 5. Data exposure

**Nie ujawniać wrażliwych danych:**
- Nie zwracać user_id w response (tylko party_id)
- Nie ujawniać internal algorithm details w error messages
- Nie logować sensitive data (weight, gender) w plain text

### 6. HTTPS Only

- Endpoint MUSI być dostępny tylko przez HTTPS
- Access token w header jest wrażliwy
- Ustawić Strict-Transport-Security header

## 7. Obsługa błędów

### Error handling strategy

**Hierarchia błędów:**
1. Authentication errors (401) - najwyższy priorytet
2. Authorization errors (403) - weryfikacja ownership
3. Validation errors (400) - invalid input
4. Business logic errors (404) - resource not found, invalid state
5. Server errors (500) - unexpected failures

### Implementacja error handling

**Custom error classes:**

```typescript
// src/lib/errors.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Missing or invalid authentication token') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends APIError {
  constructor(message = "You don't have access to this party") {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends APIError {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}

export class PartyNotFoundError extends NotFoundError {
  constructor() {
    super('PARTY_NOT_FOUND', 'Party not found');
  }
}

export class NoDrinksYetError extends NotFoundError {
  constructor() {
    super('NO_DRINKS_YET', 'This party has no drinks recorded yet');
  }
}

export class PartyClosedError extends NotFoundError {
  constructor() {
    super('PARTY_CLOSED', 'Cannot calculate current BAC for a closed party');
  }
}

export class InternalServerError extends APIError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
```

**Error handler w route:**

```typescript
// src/pages/api/parties/[id]/bac/current.ts
import type { APIRoute } from 'astro';
import { APIError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async (context) => {
  try {
    // ... business logic
  } catch (error) {
    if (error instanceof APIError) {
      return new Response(
        JSON.stringify({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details && { details: error.details })
          }
        }),
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Unexpected error - log and return 500
    logger.error('Unexpected error in GET /api/parties/:id/bac/current', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      partyId: context.params.id
    });

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while calculating BAC'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
```

### Specific error scenarios

| Scenario | Status | Error Code | Message | Details |
|----------|--------|------------|---------|---------|
| Missing auth token | 401 | UNAUTHORIZED | Missing or invalid authentication token | - |
| Invalid/expired token | 401 | UNAUTHORIZED | Missing or invalid authentication token | - |
| Party belongs to another user | 403 | FORBIDDEN | You don't have access to this party | - |
| Party doesn't exist | 404 | PARTY_NOT_FOUND | Party not found | - |
| Party has no drinks | 404 | NO_DRINKS_YET | This party has no drinks recorded yet | - |
| Party is closed | 404 | PARTY_CLOSED | Cannot calculate current BAC for a closed party | - |
| Invalid partyId format | 400 | INVALID_PARAMETER | Invalid party ID format | { parameter: 'id' } |
| Database connection error | 500 | INTERNAL_SERVER_ERROR | An unexpected error occurred while calculating BAC | - |
| Missing profile snapshot | 500 | INTERNAL_SERVER_ERROR | An unexpected error occurred while calculating BAC | - |
| Math calculation error | 500 | INTERNAL_SERVER_ERROR | An unexpected error occurred while calculating BAC | - |

### Logging strategy

**Levels:**
- `ERROR` - wszystkie 500 errors, unexpected exceptions
- `WARN` - business logic errors (404, 403)
- `INFO` - successful requests (w dev/staging)
- `DEBUG` - detailed calculation steps (tylko dev)

**Co logować:**
```typescript
// Success
logger.info('BAC calculated successfully', {
  partyId,
  userId,
  currentBAC,
  thresholdStatus
});

// Business errors (404, 403)
logger.warn('Party not found', { partyId, userId });

// Server errors
logger.error('Failed to calculate BAC', {
  error: error.message,
  stack: error.stack,
  partyId,
  userId
});
```

## 8. Rozważania dotyczące wydajności

### 1. Query optimization

**Problem:** Endpoint wykonuje multiple database queries
- Fetch party (1 query)
- Fetch latest BAC calculation (1 query with join)
- Fetch first drink (1 query)
- Fetch current threshold (1 query)

**Optymalizacja:**
- Rozważyć batch queries jeśli Supabase API to wspiera
- Cache threshold per user (redis/in-memory) jeśli nie zmienia się często
- Use database indexes na często używanych kolumnach

**Indexes to ensure:**
```sql
CREATE INDEX idx_parties_user_id_status ON parties(user_id, status);
CREATE INDEX idx_baccalculations_party_id ON baccalculations(party_id);
CREATE INDEX idx_drinks_party_consumed ON drinks(party_id, consumed_at);
CREATE INDEX idx_userthresholds_user_current ON userthresholds(user_id, is_current);
```

### 2. Calculation complexity

**Problem:** Obliczenia Widmarka są lekkie, ale mogą być powtarzane często

**Optymalizacja:**
- Calculations są O(1) - arithmetic operations only
- No loops or recursive operations
- JavaScript native Date operations są zoptymalizowane

**Potential bottleneck:** Date parsing/formatting
- Użyć native Date gdzie możliwe zamiast heavy libraries
- Cache parsed dates jeśli używane wielokrotnie

### 3. Response size

**Response size:** ~200-300 bytes JSON
- Bardzo mały response - brak problemów z bandwidth
- No pagination needed (single object response)

### 4. Real-time updates

**Problem:** UI może polling ten endpoint co kilka sekund

**Rozważania:**
- Rate limiting (60 req/min per user)
- Client-side caching z TTL (np. 5 seconds)
- Rozważyć WebSocket connection dla real-time updates (future enhancement)
- HTTP ETag/Last-Modified headers dla conditional requests

**Implementacja client-side caching:**
```typescript
// Frontend suggestion
const BAC_CACHE_TTL = 5000; // 5 seconds
let cachedBAC = null;
let cacheTimestamp = 0;

function getCurrentBAC(partyId) {
  const now = Date.now();
  if (cachedBAC && now - cacheTimestamp < BAC_CACHE_TTL) {
    return Promise.resolve(cachedBAC);
  }
  
  return fetch(`/api/parties/${partyId}/bac/current`)
    .then(res => res.json())
    .then(data => {
      cachedBAC = data;
      cacheTimestamp = now;
      return data;
    });
}
```

### 5. Database connection pooling

**Supabase SDK handles connection pooling automatically**
- No need for manual pool management
- Max connections configured in Supabase project settings

### 6. Monitoring

**Metrics to track:**
- Request latency (p50, p95, p99)
- Error rate (per error type)
- Request rate (per user, per party)
- Database query time
- Calculation time

**Tools:**
- Supabase Analytics for DB performance
- Application-level logging with timing
- APM tool (np. Sentry) dla error tracking

### 7. Caching strategy (future enhancement)

**Nie implementować w v1, ale rozważyć w przyszłości:**

```typescript
// Redis cache example (pseudo-code)
const cacheKey = `bac:${partyId}:${Math.floor(Date.now() / 60000)}`; // 1-min buckets
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await calculateCurrentBAC(partyId, userId);
await redis.setex(cacheKey, 60, JSON.stringify(result)); // 60s TTL

return result;
```

**Considerations:**
- Cache invalidation przy dodaniu nowego drinka
- TTL based on expected usage patterns
- Memory vs. DB trade-off

### 8. Scalability

**Current design is horizontally scalable:**
- Stateless endpoint (no session state)
- Database handles concurrency
- Can deploy multiple instances behind load balancer

**Bottleneck będzie w database:**
- Supabase plan limits
- Rozważyć upgrade planu przy high traffic
- Monitor connection pool usage

## 9. Etapy wdrożenia

### Krok 1: Aktualizacja typów i walidacji

> **KLUCZOWA ZASADA:** Zawsze najpierw sprawdź `src/types.ts` i używaj istniejących typów!

**1.1. Zweryfikuj istniejące typy w src/types.ts**

Przed jakimikolwiek zmianami, sprawdź plik `src/types.ts` i zidentyfikuj:
- ✅ `CurrentBACResponseDTO` - już istnieje, wymaga modyfikacji
- ✅ `PartyDTO`, `BACCalculationDTO`, `DrinkDTO` - już istnieją, użyj bez zmian
- ✅ `ProfileSnapshot` - już istnieje, użyj bez zmian
- ✅ `PartyStatus`, `Gender` - enums już istnieją

**1.2. Zaktualizuj CurrentBACResponseDTO w src/types.ts**

Zmodyfikuj istniejący typ aby dopasować do specyfikacji API:

```typescript
export interface CurrentBACResponseDTO {
  party_id: number;
  current_bac: number;
  calculated_at: string; // ISO 8601 timestamp - DODANE
  time_since_last_drink_minutes: number;
  time_since_first_drink_minutes: number; // DODANE
  current_threshold: number; // ZMIENIONE z threshold_bac
  threshold_status: 'safe' | 'approaching' | 'exceeded'; // ZMIENIONE z is_approaching/is_over
  estimated_time_to_sober_minutes: number | null;
}
```

**1.3. Utwórz schemat walidacji w src/lib/validation/bac.validation.ts**

> **Uwaga:** Sprawdź najpierw czy podobne schematy nie istnieją w innych plikach walidacji!

```typescript
import { z } from 'zod';

export const PartyIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Party ID must be a valid number').transform(Number)
});

export type PartyIdParam = z.infer<typeof PartyIdParamSchema>;
```

**Czas:** 15 minut

---

### Krok 2: Utwórz custom error classes

**2.1. Dodaj error classes do src/lib/errors.ts (jeśli nie istnieje, utwórz)**

```typescript
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Missing or invalid authentication token') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends APIError {
  constructor(message = "You don't have access to this party") {
    super(403, 'FORBIDDEN', message);
  }
}

export class PartyNotFoundError extends APIError {
  constructor() {
    super(404, 'PARTY_NOT_FOUND', 'Party not found');
  }
}

export class NoDrinksYetError extends APIError {
  constructor() {
    super(404, 'NO_DRINKS_YET', 'This party has no drinks recorded yet');
  }
}

export class PartyClosedError extends APIError {
  constructor() {
    super(404, 'PARTY_CLOSED', 'Cannot calculate current BAC for a closed party');
  }
}

export class InternalServerError extends APIError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
```

**Czas:** 20 minut

---

### Krok 3: Utwórz BAC service

**3.1. Utwórz src/lib/services/bac.service.ts**

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { CurrentBACResponseDTO } from '@/types';
import {
  PartyNotFoundError,
  ForbiddenError,
  PartyClosedError,
  NoDrinksYetError,
  InternalServerError
} from '@/lib/errors';
import { logger } from '@/lib/logger';

// Stałe algorytmu Widmarka
const WIDMARK_CONSTANTS = {
  MALE_R: 0.68,
  FEMALE_R: 0.55,
  METABOLISM_RATE_G_KG_H: 0.15
} as const;

const THRESHOLD_MARGIN = 0.10; // ‰ margin for "approaching" status

/**
 * Oblicza current BAC dla ongoing party z time-based decay
 */
export async function getCurrentBAC(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<CurrentBACResponseDTO> {
  try {
    // 1. Fetch party with ownership verification
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('id, user_id, status, profile_snapshot')
      .eq('id', partyId)
      .single();

    if (partyError || !party) {
      throw new PartyNotFoundError();
    }

    // Check ownership
    if (party.user_id !== userId) {
      // Return 404 instead of 403 for security (no user enumeration)
      throw new PartyNotFoundError();
    }

    // Check status
    if (party.status !== 'ongoing') {
      throw new PartyClosedError();
    }

    // 2. Fetch latest BAC calculation
    const { data: latestBAC, error: bacError } = await supabase
      .from('baccalculations')
      .select(`
        calculated_bac,
        calculation_timestamp,
        user_profile_snapshot,
        drinks!inner(consumed_at)
      `)
      .eq('party_id', partyId)
      .order('drinks(consumed_at)', { ascending: false })
      .limit(1)
      .single();

    if (bacError || !latestBAC) {
      throw new NoDrinksYetError();
    }

    // 3. Fetch first drink for time_since_first_drink
    const { data: firstDrink, error: firstDrinkError } = await supabase
      .from('drinks')
      .select('consumed_at')
      .eq('party_id', partyId)
      .order('consumed_at', { ascending: true })
      .limit(1)
      .single();

    if (firstDrinkError || !firstDrink) {
      throw new InternalServerError('Failed to fetch first drink');
    }

    // 4. Fetch current threshold
    const { data: threshold } = await supabase
      .from('userthresholds')
      .select('threshold_bac')
      .eq('user_id', userId)
      .eq('is_current', true)
      .maybeSingle();

    const currentThreshold = threshold?.threshold_bac ?? 0.20; // default: legal limit in Poland

    // 5. Calculate current BAC with time decay
    const now = new Date();
    const lastCalcTime = new Date(latestBAC.calculation_timestamp);
    const lastDrinkTime = new Date(latestBAC.drinks.consumed_at);
    const firstDrinkTime = new Date(firstDrink.consumed_at);

    const timeElapsedMinutes = Math.floor((now.getTime() - lastCalcTime.getTime()) / 60000);
    const timeSinceLastDrinkMinutes = Math.floor((now.getTime() - lastDrinkTime.getTime()) / 60000);
    const timeSinceFirstDrinkMinutes = Math.floor((now.getTime() - firstDrinkTime.getTime()) / 60000);

    const currentBAC = calculateBACWithDecay(
      latestBAC.calculated_bac,
      timeElapsedMinutes,
      latestBAC.user_profile_snapshot
    );

    // 6. Determine threshold status
    const thresholdStatus = determineThresholdStatus(currentBAC, currentThreshold);

    // 7. Calculate estimated time to sober
    const estimatedTimeToSober = calculateTimeToSober(
      currentBAC,
      latestBAC.user_profile_snapshot
    );

    return {
      party_id: partyId,
      current_bac: Number(currentBAC.toFixed(2)),
      calculated_at: now.toISOString(),
      time_since_last_drink_minutes: timeSinceLastDrinkMinutes,
      time_since_first_drink_minutes: timeSinceFirstDrinkMinutes,
      current_threshold: currentThreshold,
      threshold_status: thresholdStatus,
      estimated_time_to_sober_minutes: estimatedTimeToSober
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    logger.error('Unexpected error in getCurrentBAC', {
      error: error instanceof Error ? error.message : String(error),
      partyId,
      userId
    });

    throw new InternalServerError('An unexpected error occurred while calculating BAC');
  }
}

/**
 * Oblicza current BAC stosując Widmark time-based decay
 */
function calculateBACWithDecay(
  originalBAC: number,
  timeElapsedMinutes: number,
  profileSnapshot: { weight_kg: number; gender: 'M' | 'F' }
): number {
  const { weight_kg, gender } = profileSnapshot;
  const rValue = gender === 'M' ? WIDMARK_CONSTANTS.MALE_R : WIDMARK_CONSTANTS.FEMALE_R;

  // Metabolism rate: g/kg/hour → g/minute
  const metabolismRatePerMinute = (WIDMARK_CONSTANTS.METABOLISM_RATE_G_KG_H * weight_kg) / 60;

  // Total grams metabolized
  const totalMetabolizedGrams = metabolismRatePerMinute * timeElapsedMinutes;

  // Convert to BAC decrease using Widmark formula inverse
  // BAC (‰) = (alcohol_g / (weight_kg * r)) * 10
  // Therefore: BAC_decrease = (metabolized_g / (weight_kg * r)) * 10
  const bacDecrease = (totalMetabolizedGrams / (weight_kg * rValue)) * 10;

  // New BAC, floor at 0
  const newBAC = Math.max(0, originalBAC - bacDecrease);

  return newBAC;
}

/**
 * Określa threshold status na podstawie current BAC i threshold
 */
function determineThresholdStatus(
  currentBAC: number,
  threshold: number
): 'safe' | 'approaching' | 'exceeded' {
  if (currentBAC >= threshold) {
    return 'exceeded';
  }

  if (currentBAC >= threshold - THRESHOLD_MARGIN) {
    return 'approaching';
  }

  return 'safe';
}

/**
 * Oblicza szacowany czas do pełnego wytrzeźwienia (BAC = 0)
 */
function calculateTimeToSober(
  currentBAC: number,
  profileSnapshot: { weight_kg: number; gender: 'M' | 'F' }
): number | null {
  if (currentBAC <= 0) {
    return null;
  }

  const { weight_kg, gender } = profileSnapshot;
  const rValue = gender === 'M' ? WIDMARK_CONSTANTS.MALE_R : WIDMARK_CONSTANTS.FEMALE_R;

  // Convert BAC to total grams of alcohol remaining
  // BAC (‰) = (alcohol_g / (weight_kg * r)) * 10
  // alcohol_g = (BAC * weight_kg * r) / 10
  const remainingAlcoholGrams = (currentBAC * weight_kg * rValue) / 10;

  // Metabolism rate g/hour
  const metabolismRatePerHour = WIDMARK_CONSTANTS.METABOLISM_RATE_G_KG_H * weight_kg;

  // Hours to metabolize
  const hoursToSober = remainingAlcoholGrams / metabolismRatePerHour;

  // Convert to minutes, ceil
  const minutesToSober = Math.ceil(hoursToSober * 60);

  return minutesToSober;
}
```

**Czas:** 60 minut

---

### Krok 4: Utwórz route handler

**4.1. Utwórz src/pages/api/parties/[id]/bac/current.ts**

```typescript
import type { APIRoute } from 'astro';
import { getCurrentBAC } from '@/lib/services/bac.service';
import { APIError, UnauthorizedError } from '@/lib/errors';
import { PartyIdParamSchema } from '@/lib/validation/bac.validation';
import { logger } from '@/lib/logger';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    // 1. Authentication check
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    if (!user) {
      throw new UnauthorizedError();
    }

    // 2. Validate path parameter
    const paramValidation = PartyIdParamSchema.safeParse({ id: context.params.id });

    if (!paramValidation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid party ID format',
            details: { parameter: 'id', issues: paramValidation.error.issues }
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const partyId = paramValidation.data.id;

    // 3. Call service to get current BAC
    const bacData = await getCurrentBAC(supabase, partyId, user.id);

    // 4. Log success
    logger.info('Current BAC calculated successfully', {
      partyId,
      userId: user.id,
      currentBAC: bacData.current_bac,
      thresholdStatus: bacData.threshold_status
    });

    // 5. Return success response
    return new Response(JSON.stringify(bacData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Handle known API errors
    if (error instanceof APIError) {
      logger.warn(`API Error: ${error.code}`, {
        partyId: context.params.id,
        statusCode: error.statusCode,
        message: error.message
      });

      return new Response(JSON.stringify(error.toJSON()), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle unexpected errors
    logger.error('Unexpected error in GET /api/parties/:id/bac/current', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      partyId: context.params.id
    });

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while calculating BAC'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
```

**Czas:** 30 minut

---

### Krok 5: Weryfikacja middleware i RLS policies

**5.1. Sprawdź middleware authentication w src/middleware/index.ts**

Upewnij się że middleware:
- Waliduje Supabase token
- Ustawia `context.locals.user` i `context.locals.supabase`
- Zwraca 401 dla unauthenticated requests

**5.2. Weryfikuj RLS policies w Supabase**

Sprawdź że policies istnieją dla:
- `parties` - user może SELECT tylko swoje
- `baccalculations` - user może SELECT tylko swoje
- `drinks` - user może SELECT tylko swoje
- `userthresholds` - user może SELECT tylko swoje

**Przykładowe SQL (powinny już istnieć):**
```sql
-- Parties
CREATE POLICY "Users can view own parties"
  ON parties FOR SELECT
  USING (auth.uid() = user_id);

-- BACCalculations
CREATE POLICY "Users can view own BAC calculations"
  ON baccalculations FOR SELECT
  USING (auth.uid() = user_id);

-- Drinks
CREATE POLICY "Users can view own drinks"
  ON drinks FOR SELECT
  USING (auth.uid() = user_id);

-- UserThresholds
CREATE POLICY "Users can view own thresholds"
  ON userthresholds FOR SELECT
  USING (auth.uid() = user_id);
```

**Czas:** 15 minut

---

### Krok 6: Weryfikacja database indexes

**6.1. Sprawdź/dodaj indexes dla performance**

```sql
-- Party lookups by user and status
CREATE INDEX IF NOT EXISTS idx_parties_user_status 
  ON parties(user_id, status);

-- BAC calculations by party (for latest calculation)
CREATE INDEX IF NOT EXISTS idx_baccalculations_party 
  ON baccalculations(party_id);

-- Drinks by party and consumed_at (for first/last drink)
CREATE INDEX IF NOT EXISTS idx_drinks_party_consumed 
  ON drinks(party_id, consumed_at);

-- Current threshold lookup
CREATE INDEX IF NOT EXISTS idx_userthresholds_user_current 
  ON userthresholds(user_id, is_current) 
  WHERE is_current = true;
```

**Czas:** 10 minut

---

### Krok 8: Dokumentacja API

**8.1. Aktualizuj API documentation**

Dodaj endpoint do pliku dokumentacji API (np. `docs/api.md` lub Swagger/OpenAPI spec):

```yaml
# OpenAPI 3.0 example
/api/parties/{partyId}/bac/current:
  get:
    summary: Get current BAC for ongoing party
    description: Calculates and returns the current estimated BAC with time-based decay
    security:
      - bearerAuth: []
    parameters:
      - name: partyId
        in: path
        required: true
        schema:
          type: integer
          format: int64
    responses:
      '200':
        description: Current BAC data
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CurrentBACResponse'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
      '404':
        $ref: '#/components/responses/NotFound'
      '500':
        $ref: '#/components/responses/InternalError'
```

**Czas:** 20 minut

---

### Krok 9: Manual testing i debugging

**9.1. Test scenariuszy ręcznie:**

1. Happy path - ongoing party z drinks
2. Party not found
3. Unauthorized access
4. Party bez drinks
5. Closed party
6. Time decay calculations
7. Threshold status transitions

**9.2. Sprawdź logi:**
- Verify logging działa poprawnie
- Check error logging zawiera useful info
- Validate log levels są appropriate

**Czas:** 30 minut

---

### Krok 10: Code review i optymalizacja

**10.1. Code review checklist:**
- [ ] Kod zgodny z projektowym style guide
- [ ] Error handling jest comprehensive
- [ ] Security best practices zastosowane
- [ ] Performance optimized (indexes, queries)
- [ ] TypeScript types są poprawne
- [ ] Logging jest adekwatny
- [ ] Dokumentacja jest kompletna

**10.2. Optymalizacje:**
- Profile database queries
- Check calculation performance
- Verify memory usage

**Czas:** 30 minut

---

## Podsumowanie czasów

| Krok | Opis | Czas |
|------|------|------|
| 1 | Aktualizacja typów i walidacji | 15 min |
| 2 | Custom error classes | 20 min |
| 3 | BAC service | 60 min |
| 4 | Route handler | 30 min |
| 5 | Middleware i RLS | 15 min |
| 6 | Database indexes | 10 min |
| 7 | Testy | 90 min |
| 8 | Dokumentacja | 20 min |
| 9 | Manual testing | 30 min |
| 10 | Code review | 30 min |
| **TOTAL** | | **5 godz 20 min** |

---

## Checklist wdrożenia

- [ ] Types zaktualizowane w `src/types.ts`
- [ ] Error classes utworzone w `src/lib/errors.ts`
- [ ] Validation schema utworzony w `src/lib/validation/bac.validation.ts`
- [ ] BAC service utworzony w `src/lib/services/bac.service.ts`
- [ ] Route handler utworzony w `src/pages/api/parties/[id]/bac/current.ts`
- [ ] Middleware weryfikuje authentication
- [ ] RLS policies są aktywne w Supabase
- [ ] Database indexes utworzone
- [ ] API documentation zaktualizowana
- [ ] Manual testing wykonany
- [ ] Code review przeprowadzony
- [ ] Performance profiling wykonane
- [ ] Endpoint wdrożony na staging
- [ ] Endpoint wdrożony na production

---

## Uwagi końcowe

1. **Kolejność implementacji jest ważna** - najpierw types i errors, potem service, na końcu route handler

2. **Security jest krytyczny** - szczególna uwaga na RLS policies i authentication

3. **Performance monitoring** - monitorować query times i calculation time po wdrożeniu

4. **Future enhancements** rozważyć:
   - WebSocket dla real-time updates zamiast polling
   - Redis caching dla frequently accessed parties
   - Rate limiting per user
   - GraphQL alternative endpoint
