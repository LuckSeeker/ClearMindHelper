# API Endpoint Implementation Plan: GET BAC History

## 1. Przegląd punktu końcowego

Endpoint `GET /api/parties/:partyId/bac/history` służy do pobierania pełnej historii obliczeń BAC (Blood Alcohol Content) dla konkretnej imprezy. Jest to kluczowy endpoint dla funkcjonalności wizualizacji i analityki (US-009), umożliwiający użytkownikowi przeglądanie chronologicznego przebiegu poziomu alkoholu we krwi podczas imprezy.

**Główne funkcjonalności:**
- Zwraca wszystkie obliczenia BAC dla danej imprezy w kolejności chronologicznej
- Zawiera informację o maksymalnym osiągniętym BAC
- Dostarcza metadane pomocne w wizualizacji (czas od pierwszego drinka, zmetabolizowany alkohol)
- Wymaga autoryzacji - użytkownik może przeglądać tylko własne imprezy

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/parties/:partyId/bac/history
```

### Parametry ścieżki

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `partyId` | bigint | Tak | Identyfikator imprezy |

### Nagłówki

| Nagłówek | Wymagany | Opis |
|----------|----------|------|
| `Authorization` | Tak | Bearer token z Supabase auth |

### Query Parameters
Brak (dla MVP). W przyszłości można rozważyć:
- `page`, `limit` - paginacja dla bardzo długich imprez
- `from_timestamp`, `to_timestamp` - filtrowanie zakresu czasowego

### Request Body
Brak (GET request)

### Walidacja parametrów wejściowych

**Schemat Zod dla parametru ścieżki:**
```typescript
const pathParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});
```

**Walidacje:**
1. `partyId` musi być liczbą całkowitą dodatnią
2. `partyId` musi wskazywać na istniejącą imprezę
3. Impreza musi należeć do zalogowanego użytkownika

## 3. Wykorzystywane typy

### DTOs (z types.ts)

**BACHistoryResponseDTO** - główny typ odpowiedzi:
```typescript
export interface BACHistoryResponseDTO {
  party_id: number;
  bac_calculations: BACCalculationDTO[];
  bac_estimate_max: number | null;
  total_count: number;
}
```

**BACCalculationDTO** - pojedyncze obliczenie BAC:
```typescript
export interface BACCalculationDTO extends Omit<BACCalculation, "user_profile_snapshot" | "created_at" | "calculation_timestamp"> {
  calculation_timestamp: string;
  created_at: string;
  user_profile_snapshot: ProfileSnapshot;
}
```

**ProfileSnapshot** - snapshot profilu użytkownika:
```typescript
export interface ProfileSnapshot {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
  captured_at: string;
}
```

### Tabele bazodanowe

**BACCalculations:**
- `id` - identyfikator obliczenia
- `party_id` - FK do Parties
- `user_id` - FK do auth.users (denormalizacja dla RLS)
- `drink_id` - FK do Drinks
- `calculated_bac` - obliczone BAC (0.00-0.99)
- `calculation_timestamp` - timestamp obliczenia
- `algorithm_version` - wersja algorytmu
- `user_profile_snapshot` - JSONB z danymi profilu
- `time_since_first_drink_minutes` - czas od pierwszego drinka
- `metabolized_alcohol_g` - gram zmetabolizowanego alkoholu

**Parties:**
- `id` - identyfikator imprezy
- `user_id` - właściciel imprezy
- `bac_estimate_max` - cached maksymalne BAC
- `status` - status imprezy (ongoing/closed)

### Command Models
Brak (GET endpoint bez body)

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

**Content-Type:** `application/json`

**Struktura:**
```json
{
  "party_id": 123,
  "bac_calculations": [
    {
      "id": 456,
      "party_id": 123,
      "user_id": "uuid-here",
      "drink_id": 789,
      "calculated_bac": 0.05,
      "calculation_timestamp": "2026-01-16T20:30:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 30,
      "metabolized_alcohol_g": 2.5,
      "created_at": "2026-01-16T20:30:00Z"
    }
  ],
  "bac_estimate_max": 0.08,
  "total_count": 5
}
```

**Pola odpowiedzi:**
- `party_id` - ID imprezy (potwierdzenie)
- `bac_calculations` - array z wszystkimi obliczeniami BAC w kolejności chronologicznej
- `bac_estimate_max` - maksymalny BAC osiągnięty w imprezie (cached z Parties)
- `total_count` - liczba obliczeń (dla wygody frontend)

### Błędy

#### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_PARTY_ID",
    "message": "Invalid party ID format"
  }
}
```
**Przyczyny:**
- `partyId` nie jest liczbą
- `partyId` jest ujemny lub zero

#### 401 Unauthorized
```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  }
}
```
**Przyczyny:**
- Brak nagłówka Authorization
- Nieprawidłowy lub wygasły token

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
- Impreza istnieje, ale należy do innego użytkownika

#### 404 Not Found
```json
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```
**Przyczyny:**
- Impreza o podanym ID nie istnieje

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "An error occurred while fetching BAC history"
  }
}
```
**Przyczyny:**
- Błąd połączenia z bazą danych
- Błąd zapytania SQL
- Nieoczekiwany błąd serwera

## 5. Przepływ danych

### Sekwencja operacji

```
1. [Client] → GET /api/parties/:partyId/bac/history
   Headers: Authorization: Bearer <token>

2. [Middleware] → Weryfikacja tokenu przez Supabase Auth
   - Sprawdza ważność tokenu
   - Wyciąga user_id z sesji
   - Dodaje supabase client i user do context.locals

3. [Route Handler] → Walidacja parametrów
   - Parsuje partyId z URL
   - Waliduje format używając Zod schema
   - Zwraca 400 jeśli nieprawidłowy

4. [Route Handler] → Wywołanie serwisu
   - Wywołuje BACService.getBACHistory(supabase, partyId, userId)

5. [BACService] → Weryfikacja uprawnień
   - Query: SELECT user_id FROM parties WHERE id = partyId
   - Sprawdza czy party.user_id === userId
   - Zwraca błąd jeśli nie pasuje (403) lub nie istnieje (404)

6. [BACService] → Pobranie danych BAC
   - Query: SELECT * FROM baccalculations WHERE party_id = partyId ORDER BY calculation_timestamp ASC
   - RLS automatycznie filtruje po user_id

7. [BACService] → Pobranie max BAC
   - Query: SELECT bac_estimate_max FROM parties WHERE id = partyId
   - (Alternatywnie można połączyć z krokiem 5)

8. [BACService] → Transformacja danych
   - Mapuje database rows na BACCalculationDTO[]
   - Konwertuje JSONB user_profile_snapshot na ProfileSnapshot
   - Formatuje timestampy jako ISO strings
   - Konstruuje BACHistoryResponseDTO

9. [Route Handler] → Zwrócenie odpowiedzi
   - Status: 200 OK
   - Body: BACHistoryResponseDTO jako JSON

10. [Client] ← Otrzymuje dane do wizualizacji
```

### Diagramy interakcji

**Główny przepływ (happy path):**
```
Client → Middleware → Handler → Service → Database
                                    ↓
                              Transform DTOs
                                    ↓
Client ← JSON Response ← Handler ← Service
```

**Przepływ błędu autoryzacji:**
```
Client → Middleware → Handler → Service → Database
                                    ↓
                              party.user_id ≠ userId
                                    ↓
Client ← 403 Forbidden ← Handler ← Service
```

### Optymalizacje zapytań

**Podejście 1: Dwa osobne zapytania**
```sql
-- Query 1: Get party and verify ownership
SELECT user_id, bac_estimate_max FROM parties WHERE id = $1;

-- Query 2: Get BAC calculations
SELECT * FROM baccalculations WHERE party_id = $1 ORDER BY calculation_timestamp ASC;
```

**Podejście 2: Jedno zapytanie z JOIN** (preferowane)
```sql
SELECT 
  p.bac_estimate_max,
  bc.*
FROM parties p
LEFT JOIN baccalculations bc ON bc.party_id = p.id
WHERE p.id = $1 AND p.user_id = $2
ORDER BY bc.calculation_timestamp ASC;
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)

**Mechanizm:**
- Bearer token JWT z Supabase Auth
- Token przekazywany w nagłówku `Authorization: Bearer <token>`
- Middleware Astro weryfikuje token przed dotarciem do handlera

**Implementacja w middleware:**
```typescript
// src/middleware/index.ts już obsługuje auth
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({
    error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
  }), { status: 401 });
}
```

### Autoryzacja (Authorization)

**Wielopoziomowa ochrona:**

1. **RLS (Row Level Security) w Supabase:**
   ```sql
   -- Polityka RLS dla baccalculations
   CREATE POLICY "Users can view their own BAC calculations"
   ON baccalculations FOR SELECT
   USING (auth.uid() = user_id);
   ```

2. **Weryfikacja w service layer:**
   ```typescript
   // Dodatkowa weryfikacja własności imprezy
   const { data: party } = await supabase
     .from('parties')
     .select('user_id')
     .eq('id', partyId)
     .single();
   
   if (!party || party.user_id !== userId) {
     throw new Error('FORBIDDEN');
   }
   ```

**Ochrona przed:**
- Dostęp do danych innych użytkowników (403)
- Horizontal privilege escalation
- Party ID enumeration (zwracamy 404 dla nieistniejących i obcych imprez)

### Walidacja danych wejściowych

**Zod schema:**
```typescript
const pathParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});
```

**Zabezpieczenia:**
- Ochrona przed SQL injection (parameterized queries)
- Ochrona przed XSS (zwracamy JSON, nie HTML)
- Type coercion z walidacją
- Odrzucenie nieprawidłowych wartości przed dotarciem do bazy

### Ochrona danych osobowych

**GDPR compliance:**
- Zwracamy tylko dane należące do zalogowanego użytkownika
- user_profile_snapshot zawiera dane użytkownika (wzrost, waga, płeć) - to jego własne dane
- Nie logujemy wrażliwych danych w logach aplikacji

**Data minimization:**
- Endpoint zwraca tylko dane niezbędne do wizualizacji BAC
- Nie zwracamy user_id w odpowiedzi (frontend nie potrzebuje tej informacji)

### Rate Limiting

**Rekomendacje:**
- Limit: 60 requestów/minutę per użytkownik
- Zwracanie nagłówków: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Status 429 przy przekroczeniu limitu

**Implementacja** (przyszłość):
```typescript
// Middleware rate limiting z Redis/Upstash
const rateLimitResult = await rateLimit.check(userId, 'bac-history');
if (!rateLimitResult.success) {
  return new Response(null, { status: 429 });
}
```

### Logowanie bezpieczeństwa

**Co logować:**
- Próby dostępu do obcych imprez (403) - potencjalne ataki
- Nieprawidłowe tokeny (401) - monitorowanie security incidents
- Częstość requestów per user - wykrywanie anomalii

**Nie logować:**
- Prawidłowych requestów (zbyt dużo danych)
- Wrażliwych danych (BAC values, profile data)

## 7. Obsługa błędów

### Katalog błędów

| Kod błędu | Status | Opis | Przyczyna | Akcja użytkownika |
|-----------|--------|------|-----------|-------------------|
| `INVALID_PARTY_ID` | 400 | Nieprawidłowy format ID imprezy | partyId nie jest liczbą dodatnią | Sprawdź poprawność URL |
| `AUTH_REQUIRED` | 401 | Brak autoryzacji | Brak lub nieprawidłowy token | Zaloguj się ponownie |
| `TOKEN_EXPIRED` | 401 | Token wygasł | Token JWT wygasł | Odśwież token/zaloguj się |
| `FORBIDDEN` | 403 | Brak dostępu | Próba dostępu do obcej imprezy | Sprawdź czy to Twoja impreza |
| `PARTY_NOT_FOUND` | 404 | Impreza nie istnieje | Nieprawidłowe partyId | Sprawdź listę imprez |
| `DATABASE_ERROR` | 500 | Błąd bazy danych | Problem z Supabase | Spróbuj ponownie za chwilę |
| `SUPABASE_UNAVAILABLE` | 503 | Usługa niedostępna | Supabase nie odpowiada | Spróbuj później |

### Struktura odpowiedzi błędu

**Standard APIError format (z types.ts):**
```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

**Przykłady:**

```json
// 400 - Walidacja
{
  "error": {
    "code": "INVALID_PARTY_ID",
    "message": "Invalid party ID format",
    "details": {
      "field": "partyId",
      "value": "abc",
      "expected": "positive integer"
    }
  }
}

// 403 - Autoryzacja
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have access to this party"
  }
}

// 500 - Błąd serwera
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "An error occurred while fetching BAC history",
    "details": {
      "timestamp": "2026-01-16T20:00:00Z",
      "request_id": "uuid-here"
    }
  }
}
```

### Logowanie błędów

**Poziomy logowania:**

```typescript
// lib/logger.ts
logger.error('Failed to fetch BAC history', {
  partyId,
  userId,
  error: error.message,
  stack: error.stack
});

logger.warn('Unauthorized access attempt', {
  partyId,
  userId,
  requestedBy: userId,
  actualOwner: party.user_id
});

logger.info('BAC history fetched', {
  partyId,
  calculationsCount: result.total_count
});
```

**Nie logować do Events table:**
- Ten endpoint jest read-only
- Wysokie volume requestów
- Brak wartości biznesowej w auditowaniu odczytów

### Error Recovery Strategies

**Retry logic (client-side):**
- 500/503 errors: retry z exponential backoff
- 401 errors: refresh token, potem retry
- 403/404 errors: nie retry (błąd biznesowy)

**Graceful degradation:**
- Jeśli brak obliczeń BAC: zwróć pustą listę z total_count=0
- Jeśli bac_estimate_max jest null: zwróć null (nie błąd)

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

1. **Duża liczba obliczeń BAC:**
   - Impreza z 100+ drinkami = 100+ BAC calculations
   - Response size: ~30-50KB
   - Czas query: 50-200ms

2. **JSON parsing i serialization:**
   - Każdy BACCalculation ma JSONB user_profile_snapshot
   - Postgres musi deserializować JSONB → JSON
   - Astro musi serializować do response JSON

3. **Network latency:**
   - Transfer dużych responsów dla długich imprez
   - Szczególnie na wolnych połączeniach mobilnych

### Strategie optymalizacji

#### 1. Indeksy bazy danych

**Wymagane indeksy:**
```sql
-- Composite index dla głównego query
CREATE INDEX idx_baccalculations_party_timestamp 
ON baccalculations(party_id, calculation_timestamp ASC);

-- Index dla weryfikacji uprawnień (prawdopodobnie już istnieje)
CREATE INDEX idx_parties_id_userid 
ON parties(id, user_id);

-- RLS performance
CREATE INDEX idx_baccalculations_user_id 
ON baccalculations(user_id);
```

#### 2. Query optimization

**Single query approach:**
```typescript
// Zamiast dwóch zapytań, jedno z LEFT JOIN
const { data, error } = await supabase
  .from('parties')
  .select(`
    bac_estimate_max,
    baccalculations (
      id,
      drink_id,
      calculated_bac,
      calculation_timestamp,
      algorithm_version,
      user_profile_snapshot,
      time_since_first_drink_minutes,
      metabolized_alcohol_g,
      created_at
    )
  `)
  .eq('id', partyId)
  .eq('user_id', userId)
  .order('calculation_timestamp', { 
    foreignTable: 'baccalculations', 
    ascending: true 
  })
  .single();
```

#### 3. Caching strategy

**Server-side caching:**
- Cache na poziomie Astro: `Cache-Control: private, max-age=60`
- BAC history rzadko się zmienia dla closed parties
- Dla ongoing parties: krótszy cache (30s) lub no-cache

**Client-side caching:**
```typescript
// Response headers
{
  'Cache-Control': party.status === 'closed' 
    ? 'private, max-age=3600' // 1h dla zamkniętych
    : 'private, max-age=30',   // 30s dla ongoing
  'ETag': `"${partyId}-${lastUpdated}"`,
  'Last-Modified': party.updated_at
}
```

#### 4. Pagination (future enhancement)

**Dla bardzo długich imprez (200+ drinks):**
```typescript
interface BACHistoryQueryParams {
  page?: number;
  limit?: number; // default 100
  from_timestamp?: string;
  to_timestamp?: string;
}

// Response z pagination meta
interface BACHistoryResponseDTO {
  party_id: number;
  bac_calculations: BACCalculationDTO[];
  bac_estimate_max: number | null;
  total_count: number;
  pagination?: {
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
  };
}
```

#### 5. Response compression

```typescript
// Astro automatycznie kompresuje, ale można wymuszić:
{
  'Content-Encoding': 'gzip',
  'Vary': 'Accept-Encoding'
}
```
- 50KB JSON → ~5-10KB gzipped
- Znacząca redukcja czasu transferu

#### 6. Projection optimization

**Select tylko potrzebne kolumny:**
```typescript
// Nie pobieraj user_id, party_id z baccalculations jeśli nie są używane
// user_profile_snapshot może być duży - upewnij się że jest potrzebny
.select('id, drink_id, calculated_bac, calculation_timestamp, ...')
```

### Performance targets (MVP)

| Metryka | Target | Critical threshold |
|---------|--------|-------------------|
| Response time (p50) | < 200ms | < 500ms |
| Response time (p95) | < 500ms | < 1000ms |
| Response size | < 50KB | < 200KB |
| Database query time | < 100ms | < 300ms |
| Concurrent requests | 10 req/s | 50 req/s |

### Monitoring

**Metryki do śledzenia:**
- Response time distribution
- Response size distribution
- Error rate per error type
- Query execution time (Supabase dashboard)
- Cache hit rate

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie serwisu BACService

**Plik:** `src/lib/services/bac.service.ts`

**Zadania:**
1. Utworzyć funkcję `getBACHistory`:
   ```typescript
   export async function getBACHistory(
     supabase: SupabaseClient,
     partyId: number,
     userId: string
   ): Promise<BACHistoryResponseDTO>
   ```

2. Zaimplementować weryfikację uprawnień:
   - Query do parties dla weryfikacji user_id
   - Throw error jeśli party nie istnieje (404) lub nie należy do użytkownika (403)

3. Zaimplementować query do BACCalculations:
   - Pobrać wszystkie calculations dla party_id
   - Uporządkować po calculation_timestamp ASC
   - Pobrać bac_estimate_max z parties

4. Zaimplementować transformację do DTOs:
   - Map database rows → BACCalculationDTO[]
   - Parse JSONB user_profile_snapshot → ProfileSnapshot
   - Format timestamps jako ISO strings
   - Skonstruować BACHistoryResponseDTO

5. Obsługa błędów:
   - Try-catch z właściwymi error messages
   - Logowanie przez logger.ts
   - Throw errors z kodami: PARTY_NOT_FOUND, FORBIDDEN, DATABASE_ERROR

**Kod szkieletowy:**
```typescript
export async function getBACHistory(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<BACHistoryResponseDTO> {
  try {
    // 1. Verify party ownership and get max BAC
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('user_id, bac_estimate_max')
      .eq('id', partyId)
      .single();

    if (partyError || !party) {
      throw new Error('PARTY_NOT_FOUND');
    }

    if (party.user_id !== userId) {
      throw new Error('FORBIDDEN');
    }

    // 2. Fetch all BAC calculations
    const { data: calculations, error: calcError } = await supabase
      .from('baccalculations')
      .select('*')
      .eq('party_id', partyId)
      .order('calculation_timestamp', { ascending: true });

    if (calcError) {
      logger.error('Failed to fetch BAC calculations', { partyId, error: calcError });
      throw new Error('DATABASE_ERROR');
    }

    // 3. Transform to DTOs
    const bacCalculations: BACCalculationDTO[] = calculations.map(calc => ({
      id: calc.id,
      party_id: calc.party_id,
      user_id: calc.user_id,
      drink_id: calc.drink_id,
      calculated_bac: calc.calculated_bac,
      calculation_timestamp: calc.calculation_timestamp,
      algorithm_version: calc.algorithm_version,
      user_profile_snapshot: calc.user_profile_snapshot as ProfileSnapshot,
      time_since_first_drink_minutes: calc.time_since_first_drink_minutes,
      metabolized_alcohol_g: calc.metabolized_alcohol_g,
      created_at: calc.created_at
    }));

    // 4. Construct response
    return {
      party_id: partyId,
      bac_calculations: bacCalculations,
      bac_estimate_max: party.bac_estimate_max,
      total_count: calculations.length
    };

  } catch (error) {
    logger.error('getBACHistory failed', { partyId, userId, error });
    throw error;
  }
}
```

### Krok 2: Utworzenie route handlera

**Plik:** `src/pages/api/parties/[id]/bac/history.ts`

**Struktura katalogów:**
```
src/pages/api/parties/[id]/
  └── bac/
      └── history.ts
```

**Zadania:**

1. Dodać `export const prerender = false` (zgodnie z regułami Astro)

2. Zaimplementować handler GET:
   ```typescript
   export async function GET(context: APIContext): Promise<Response>
   ```

3. Pobrać partyId z `context.params.id`

4. Walidować partyId używając Zod:
   ```typescript
   const pathParamsSchema = z.object({
     id: z.coerce.number().int().positive()
   });
   ```

5. Pobrać user z `context.locals.user` (middleware już to ustawia)

6. Pobrać supabase client z `context.locals.supabase`

7. Wywołać `BACService.getBACHistory(supabase, partyId, user.id)`

8. Obsłużyć błędy:
   - PARTY_NOT_FOUND → 404
   - FORBIDDEN → 403
   - DATABASE_ERROR → 500

9. Zwrócić Response z właściwymi nagłówkami:
   ```typescript
   return new Response(JSON.stringify(result), {
     status: 200,
     headers: {
       'Content-Type': 'application/json',
       'Cache-Control': 'private, max-age=60'
     }
   });
   ```

**Kod szkieletowy:**
```typescript
import type { APIContext } from 'astro';
import { z } from 'zod';
import { getBACHistory } from '@/lib/services/bac.service';
import { createErrorResponse } from '@/lib/api-helpers';
import type { BACHistoryResponseDTO, APIError } from '@/types';

export const prerender = false;

const pathParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export async function GET(context: APIContext): Promise<Response> {
  const { supabase, user } = context.locals;

  // 1. Verify authentication (middleware should handle this)
  if (!user) {
    return createErrorResponse('AUTH_REQUIRED', 'Authentication required', 401);
  }

  try {
    // 2. Validate path params
    const validation = pathParamsSchema.safeParse({ id: context.params.id });
    
    if (!validation.success) {
      return createErrorResponse(
        'INVALID_PARTY_ID',
        'Invalid party ID format',
        400,
        { errors: validation.error.errors }
      );
    }

    const partyId = validation.data.id;

    // 3. Call service
    const result = await getBACHistory(supabase, partyId, user.id);

    // 4. Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    });

  } catch (error) {
    // 5. Handle errors
    if (error instanceof Error) {
      switch (error.message) {
        case 'PARTY_NOT_FOUND':
          return createErrorResponse('PARTY_NOT_FOUND', 'Party not found', 404);
        
        case 'FORBIDDEN':
          return createErrorResponse(
            'FORBIDDEN',
            "You don't have access to this party",
            403
          );
        
        case 'DATABASE_ERROR':
          return createErrorResponse(
            'DATABASE_ERROR',
            'An error occurred while fetching BAC history',
            500
          );
        
        default:
          return createErrorResponse(
            'INTERNAL_ERROR',
            'An unexpected error occurred',
            500
          );
      }
    }

    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
```

### Krok 3: Weryfikacja i testy middleware

**Plik:** `src/middleware/index.ts`

**Zadania:**

1. Upewnić się, że middleware:
   - Weryfikuje Bearer token
   - Ustawia `context.locals.user`
   - Ustawia `context.locals.supabase`
   - Zwraca 401 dla nieprawidłowych tokenów

2. Sprawdzić czy middleware działa dla wszystkich `/api/*` routes

3. Przetestować różne scenariusze:
   - Brak nagłówka Authorization
   - Nieprawidłowy token
   - Wygasły token
   - Prawidłowy token

**Oczekiwane zachowanie:**
- Middleware powinien już obsługiwać auth
- Jeśli nie: dodać obsługę zgodnie z shared.mdc rules

### Krok 4: Aktualizacja api-helpers.ts

**Plik:** `src/lib/api-helpers.ts`

**Zadania:**

1. Sprawdzić czy istnieje funkcja `createErrorResponse`

2. Jeśli nie istnieje, dodać:
   ```typescript
   export function createErrorResponse(
     code: string,
     message: string,
     status: number,
     details?: Record<string, unknown>
   ): Response {
     const body: APIError = {
       error: {
         code,
         message,
         ...(details && { details })
       }
     };

     return new Response(JSON.stringify(body), {
       status,
       headers: {
         'Content-Type': 'application/json'
       }
     });
   }
   ```

3. Dodać pomocnicze funkcje jeśli potrzebne:
   ```typescript
   export function createSuccessResponse<T>(
     data: T,
     status: number = 200,
     cacheControl?: string
   ): Response {
     const headers: Record<string, string> = {
       'Content-Type': 'application/json'
     };

     if (cacheControl) {
       headers['Cache-Control'] = cacheControl;
     }

     return new Response(JSON.stringify(data), {
       status,
       headers
     });
   }
   ```

### Krok 5: Dokumentacja API

**Plik:** `docs/api/GET-bac-history.md` (nowy)

**Zadania:**

1. Skopiować zawartość tego implementation plan jako bazę

2. Dodać przykłady cURL:
   ```bash
   curl -X GET https://api.example.com/api/parties/123/bac/history \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. Dodać przykłady response:
   - Success response z przykładowymi danymi
   - Error responses dla wszystkich scenariuszy

4. Dodać sekcję "Frontend Integration":
   - Jak używać tego endpointu w React components
   - Przykład z fetch/axios
   - Obsługa błędów po stronie klienta

### Krok 6: Weryfikacja RLS policies

**Plik:** `supabase/migrations/...rls_policies.sql`

**Zadania:**

1. Sprawdzić polityki RLS dla `baccalculations`:
   ```sql
   -- Verify policy exists
   SELECT * FROM pg_policies 
   WHERE tablename = 'baccalculations' 
   AND policyname = 'Users can view their own BAC calculations';
   ```

2. Przetestować RLS:
   ```sql
   -- Test as user A
   SET request.jwt.claim.sub = 'user-a-id';
   SELECT * FROM baccalculations WHERE party_id = 123;
   
   -- Test as user B (should return empty if party belongs to user A)
   SET request.jwt.claim.sub = 'user-b-id';
   SELECT * FROM baccalculations WHERE party_id = 123;
   ```

3. Jeśli polityka nie istnieje lub jest nieprawidłowa:
   - Utworzyć migrację z poprawną polityką
   - Apply migration: `npx supabase db push`

### Krok 7: Code review checklist

**Przed merge do main:**

- [ ] Kod zgodny z TypeScript strict mode
- [ ] Wszystkie typy z types.ts są używane poprawnie
- [ ] Zod validation dla path params
- [ ] Error handling z właściwymi status codes
- [ ] Logger.ts użyty do logowania błędów
- [ ] Service layer oddzielony od route handler
- [ ] RLS policies działają poprawnie
- [ ] ESLint nie zgłasza błędów
- [ ] API documentation zaktualizowana
- [ ] Performance targets spełnione
- [ ] Security review zakończony
- [ ] Code review zatwierdzony przez 1+ person

### Krok 8: Deployment checklist

**Przed wdrożeniem na production:**

- [ ] Wszystkie migracje bazy danych zastosowane
- [ ] Environment variables skonfigurowane
- [ ] RLS policies przetestowane na staging
- [ ] Security scanning (OWASP ZAP)
- [ ] API rate limiting skonfigurowany
- [ ] Monitoring i alerty skonfigurowane
- [ ] Rollback plan przygotowany
- [ ] Documentation dostępna dla zespołu
- [ ] Stakeholders poinformowani

### Krok 9: Post-deployment monitoring

**Pierwsze 24h po wdrożeniu:**

1. Monitorować metryki:
   - Error rate (cel: < 1%)
   - Response time (p50, p95, p99)
   - Request volume
   - Cache hit rate

2. Sprawdzać logi:
   - 4xx errors (szczególnie 403, 404)
   - 5xx errors (alert jeśli > 0.1%)
   - Slow queries (> 500ms)

3. User feedback:
   - Zgłoszenia problemów
   - Performance complaints

4. Jeśli problemy:
   - Hot-fix lub rollback
   - Post-mortem analysis

---

## Dodatki

### A. Przykładowy response dla wizualizacji

**Scenariusz:** Impreza z 5 drinkami w ciągu 2 godzin

```json
{
  "party_id": 123,
  "bac_calculations": [
    {
      "id": 1,
      "party_id": 123,
      "user_id": "uuid-123",
      "drink_id": 1,
      "calculated_bac": 0.02,
      "calculation_timestamp": "2026-01-16T20:00:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 0,
      "metabolized_alcohol_g": 0,
      "created_at": "2026-01-16T20:00:05Z"
    },
    {
      "id": 2,
      "party_id": 123,
      "user_id": "uuid-123",
      "drink_id": 2,
      "calculated_bac": 0.05,
      "calculation_timestamp": "2026-01-16T20:30:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 30,
      "metabolized_alcohol_g": 0.5,
      "created_at": "2026-01-16T20:30:05Z"
    },
    {
      "id": 3,
      "party_id": 123,
      "user_id": "uuid-123",
      "drink_id": 3,
      "calculated_bac": 0.08,
      "calculation_timestamp": "2026-01-16T21:00:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 60,
      "metabolized_alcohol_g": 1.2,
      "created_at": "2026-01-16T21:00:05Z"
    },
    {
      "id": 4,
      "party_id": 123,
      "user_id": "uuid-123",
      "drink_id": 4,
      "calculated_bac": 0.09,
      "calculation_timestamp": "2026-01-16T21:30:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 90,
      "metabolized_alcohol_g": 1.8,
      "created_at": "2026-01-16T21:30:05Z"
    },
    {
      "id": 5,
      "party_id": 123,
      "user_id": "uuid-123",
      "drink_id": 5,
      "calculated_bac": 0.07,
      "calculation_timestamp": "2026-01-16T22:00:00Z",
      "algorithm_version": "Widmark v1",
      "user_profile_snapshot": {
        "height_cm": 175,
        "weight_kg": 70,
        "gender": "M",
        "captured_at": "2026-01-16T20:00:00Z"
      },
      "time_since_first_drink_minutes": 120,
      "metabolized_alcohol_g": 2.4,
      "created_at": "2026-01-16T22:00:05Z"
    }
  ],
  "bac_estimate_max": 0.09,
  "total_count": 5
}
```

**Użycie w wizualizacji:**
- Oś X: calculation_timestamp lub time_since_first_drink_minutes
- Oś Y: calculated_bac
- Linia: połączenie punktów chronologicznie
- Marker: bac_estimate_max jako pozioma linia progowa

### B. Frontend integration example (React)

```typescript
// hooks/useBACHistory.ts
import { useState, useEffect } from 'react';
import type { BACHistoryResponseDTO } from '@/types';

export function useBACHistory(partyId: number) {
  const [data, setData] = useState<BACHistoryResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/parties/${partyId}/bac/history`, {
          headers: {
            'Authorization': `Bearer ${getToken()}` // from auth context
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error.message);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [partyId]);

  return { data, loading, error };
}

// components/BACChart.tsx
export function BACChart({ partyId }: { partyId: number }) {
  const { data, loading, error } = useBACHistory(partyId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div>
      <LineChart
        data={data.bac_calculations.map(calc => ({
          x: calc.calculation_timestamp,
          y: calc.calculated_bac
        }))}
        maxBAC={data.bac_estimate_max}
      />
      <p>Total calculations: {data.total_count}</p>
    </div>
  );
}
```

### C. Query optimization comparison

**Approach 1: Sequential queries (AVOID)**
```typescript
// Query 1
const party = await supabase.from('parties').select('*').eq('id', partyId).single();
// Query 2
const calculations = await supabase.from('baccalculations').select('*').eq('party_id', partyId);
// Total: 2 round trips
```

**Approach 2: Single query with JOIN (RECOMMENDED)**
```typescript
const result = await supabase
  .from('parties')
  .select(`
    bac_estimate_max,
    baccalculations (*)
  `)
  .eq('id', partyId)
  .single();
// Total: 1 round trip, ~50% faster
```

### D. Security audit checklist

- [ ] Authentication verified via Supabase JWT
- [ ] Authorization via RLS policies + service layer check
- [ ] Input validation with Zod
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (JSON response, no HTML)
- [ ] CSRF not applicable (stateless API)
- [ ] Rate limiting configured
- [ ] Sensitive data not logged
- [ ] HTTPS enforced (production)
- [ ] CORS configured properly
- [ ] Error messages don't leak sensitive info

---

## Podsumowanie

Ten plan wdrożenia zapewnia kompleksowe wskazówki dla implementacji endpointu `GET /api/parties/:partyId/bac/history`. Kluczowe punkty:

1. **Architektura:** Service layer (bac.service.ts) + Route handler (history.ts)
2. **Bezpieczeństwo:** JWT auth + RLS policies + input validation
3. **Wydajność:** Single query approach + caching + indeksy
4. **Monitoring:** Logging + metrics + error tracking

Implementacja powinna zająć ~2-3 dni robocze dla doświadczonego developera, włączając testy i dokumentację.
