# API Endpoint Implementation Plan: GET /api/parties/:partyId/drinks

## 1. Przegląd punktu końcowego

Endpoint służy do pobierania wszystkich napojów skonsumowanych podczas konkretnej imprezy wraz z opcjonalnymi obliczeniami BAC (Blood Alcohol Concentration) dla każdego napoju. Jest to endpoint READ-only implementujący User Story US-009.

**Główne funkcjonalności:**
- Pobieranie listy napojów dla konkretnej imprezy
- Sortowanie napojów chronologicznie według czasu spożycia
- Opcjonalne dołączanie obliczeń BAC dla każdego napoju
- Weryfikacja właściciela imprezy dla bezpieczeństwa
- Zwracanie metadanych (total_count)

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/parties/:partyId/drinks
```

### Headers
```
Authorization: Bearer {access_token}
```

### Parametry

#### Path Parameters (wymagane):
- `partyId` (bigint) - Unikalny identyfikator imprezy
  - Typ: bigint (positive integer)
  - Walidacja: musi być liczbą całkowitą > 0
  - Przykład: `/api/parties/42/drinks`

#### Query Parameters (opcjonalne):
- `include_bac` (boolean) - Czy dołączyć obliczenia BAC dla każdego napoju
  - Typ: boolean
  - Domyślna wartość: `true`
  - Możliwe wartości: `true`, `false`, `1`, `0`
  - Przykład: `/api/parties/42/drinks?include_bac=true`

### Request Body
Brak (endpoint GET)

### Przykłady żądań
```bash
# Pobierz napoje z obliczeniami BAC
GET /api/parties/42/drinks
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Pobierz napoje bez obliczeń BAC
GET /api/parties/42/drinks?include_bac=false
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

**WAŻNE:** Wszystkie typy używane w implementacji MUSZĄ być importowane z `src/types.ts`. Nie twórz nowych typów inline ani w osobnych plikach - wszystkie DTOs, Command Models i typy pomocnicze są zdefiniowane centralnie w types.ts.

### DTOs (Data Transfer Objects)

#### Główna struktura odpowiedzi:
```typescript
// src/types.ts
interface PartyDrinksResponseDTO {
  party_id: number;
  drinks: DrinkWithBACDTO[];
  total_count: number;
}
```

#### Napój z obliczeniem BAC:
```typescript
interface DrinkWithBACDTO extends DrinkDTO {
  bac_calculation: BACCalculationDTO | null;
}
```

#### Podstawowe DTOs:
```typescript
// Napój
interface DrinkDTO extends Omit<Drink, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

// Obliczenie BAC
interface BACCalculationDTO extends Omit<BACCalculation, "user_profile_snapshot" | "created_at" | "calculation_timestamp"> {
  calculation_timestamp: string;
  created_at: string;
  user_profile_snapshot: ProfileSnapshot;
}

// Snapshot profilu użytkownika
interface ProfileSnapshot {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
  captured_at: string;
}
```

#### Struktura błędu:
```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Query Parameters Type:
```typescript
// src/types.ts
interface PartyDrinksQueryParams {
  include_bac?: boolean;
}
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "party_id": 42,
  "drinks": [
    {
      "id": 101,
      "party_id": 42,
      "user_id": "uuid-string",
      "volume_ml": 500,
      "abv_percent": 5.0,
      "consumed_at": "2026-01-13T20:15:00.000Z",
      "original_values": null,
      "edited_at": null,
      "edit_count": 0,
      "order_sequence": 1,
      "created_at": "2026-01-13T20:15:30.000Z",
      "updated_at": "2026-01-13T20:15:30.000Z",
      "bac_calculation": {
        "id": 201,
        "party_id": 42,
        "user_id": "uuid-string",
        "drink_id": 101,
        "calculated_bac": 0.02,
        "calculation_timestamp": "2026-01-13T20:15:30.000Z",
        "algorithm_version": "Widmark v1",
        "user_profile_snapshot": {
          "height_cm": 180,
          "weight_kg": 75.5,
          "gender": "M",
          "captured_at": "2026-01-13T20:00:00.000Z"
        },
        "time_since_first_drink_minutes": 0,
        "metabolized_alcohol_g": 0.0,
        "created_at": "2026-01-13T20:15:30.000Z"
      }
    },
    {
      "id": 102,
      "party_id": 42,
      "user_id": "uuid-string",
      "volume_ml": 40,
      "abv_percent": 40.0,
      "consumed_at": "2026-01-13T20:45:00.000Z",
      "original_values": {
        "volume_ml_before": 50,
        "abv_percent_before": 40.0
      },
      "edited_at": "2026-01-13T20:46:00.000Z",
      "edit_count": 1,
      "order_sequence": 2,
      "created_at": "2026-01-13T20:45:15.000Z",
      "updated_at": "2026-01-13T20:46:00.000Z",
      "bac_calculation": {
        "id": 202,
        "party_id": 42,
        "user_id": "uuid-string",
        "drink_id": 102,
        "calculated_bac": 0.05,
        "calculation_timestamp": "2026-01-13T20:46:00.000Z",
        "algorithm_version": "Widmark v1",
        "user_profile_snapshot": {
          "height_cm": 180,
          "weight_kg": 75.5,
          "gender": "M",
          "captured_at": "2026-01-13T20:00:00.000Z"
        },
        "time_since_first_drink_minutes": 30,
        "metabolized_alcohol_g": 2.5,
        "created_at": "2026-01-13T20:46:00.000Z"
      }
    }
  ],
  "total_count": 2
}
```

### Success Response bez BAC (include_bac=false)

```json
{
  "party_id": 42,
  "drinks": [
    {
      "id": 101,
      "party_id": 42,
      "user_id": "uuid-string",
      "volume_ml": 500,
      "abv_percent": 5.0,
      "consumed_at": "2026-01-13T20:15:00.000Z",
      "original_values": null,
      "edited_at": null,
      "edit_count": 0,
      "order_sequence": 1,
      "created_at": "2026-01-13T20:15:30.000Z",
      "updated_at": "2026-01-13T20:15:30.000Z",
      "bac_calculation": null
    }
  ],
  "total_count": 1
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid party ID format",
    "details": {
      "field": "partyId",
      "value": "abc",
      "expected": "positive integer"
    }
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this party"
  }
}
```

#### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Party not found"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
     ↓
[Astro Middleware] → Weryfikacja tokena JWT
     ↓ (user_id z tokena)
[API Route Handler]
     ↓
[Input Validation] → Zod schema (partyId, include_bac)
     ↓
[Party Service] → Sprawdzenie czy impreza istnieje i należy do użytkownika
     ↓
[Drink Service] → Pobranie napojów z DB
     ↓
[Conditional Join] → Jeśli include_bac=true, join z BACCalculations
     ↓
[Data Transformation] → Mapowanie DB rows → DTOs
     ↓
[Response] → JSON z PartyDrinksResponseDTO
```

### Szczegółowy przepływ

1. **Middleware (`src/middleware/index.ts`)**
   - Weryfikacja tokena Bearer z headerów
   - Ekstrakcja user_id z tokena
   - Utworzenie klienta Supabase z kontekstem użytkownika
   - Przypisanie do `context.locals.supabase` i `context.locals.user`

2. **Route Handler (`src/pages/api/parties/[id]/drinks.ts`)**
   - Ekstrakcja partyId z URL params
   - Ekstrakcja include_bac z query params
   - Walidacja inputów używając Zod schema
   - Parsowanie partyId jako bigint

3. **Authorization Check (`src/lib/services/party.service.ts`)**
   - Weryfikacja czy impreza o podanym ID istnieje
   - Weryfikacja czy impreza należy do zalogowanego użytkownika
   - Zwrócenie błędu 404 jeśli nie istnieje
   - Zwrócenie błędu 403 jeśli należy do innego użytkownika

4. **Data Retrieval (`src/lib/services/drink.service.ts`)**
   - Query do tabeli Drinks z filtrem party_id
   - Sortowanie po consumed_at ASC
   - Jeśli include_bac=true:
     - LEFT JOIN z BACCalculations
     - Pobranie najnowszego obliczenia BAC dla każdego napoju
   - RLS automatycznie filtruje po user_id

5. **Data Transformation**
   - Mapowanie surowych danych DB do DTOs
   - Konwersja timestamps do ISO strings
   - Parsowanie JSONB (profile_snapshot, original_values)
   - Obliczenie total_count

6. **Response**
   - Zwrócenie JSON z kodem 200
   - Ustawienie headerów Content-Type: application/json

### Interakcje z bazą danych

#### Query bez BAC (include_bac=false):
```sql
SELECT 
  d.id,
  d.party_id,
  d.user_id,
  d.volume_ml,
  d.abv_percent,
  d.consumed_at,
  d.original_values,
  d.edited_at,
  d.edit_count,
  d.order_sequence,
  d.created_at,
  d.updated_at
FROM Drinks d
WHERE d.party_id = $1
  AND d.user_id = $2  -- RLS policy
ORDER BY d.consumed_at ASC;
```

#### Query z BAC (include_bac=true):
```sql
SELECT 
  d.id,
  d.party_id,
  d.user_id,
  d.volume_ml,
  d.abv_percent,
  d.consumed_at,
  d.original_values,
  d.edited_at,
  d.edit_count,
  d.order_sequence,
  d.created_at,
  d.updated_at,
  bac.id as bac_id,
  bac.calculated_bac,
  bac.calculation_timestamp,
  bac.algorithm_version,
  bac.user_profile_snapshot,
  bac.time_since_first_drink_minutes,
  bac.metabolized_alcohol_g,
  bac.created_at as bac_created_at
FROM Drinks d
LEFT JOIN LATERAL (
  SELECT *
  FROM BACCalculations
  WHERE drink_id = d.id
  ORDER BY calculation_timestamp DESC
  LIMIT 1
) bac ON true
WHERE d.party_id = $1
  AND d.user_id = $2  -- RLS policy
ORDER BY d.consumed_at ASC;
```

**Uwaga:** Supabase client używa RLS, więc dodatkowy filter user_id jest automatyczny.

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnianie (Authentication)
- **Token JWT**: Każde żądanie musi zawierać Bearer token w headerze Authorization
- **Middleware validation**: Token jest weryfikowany przez Astro middleware przed dotarciem do route handlera
- **Token expiry**: Supabase automatycznie sprawdza ważność tokena
- **Implementacja**: 
  ```typescript
  const authHeader = Astro.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token' }
    }), { status: 401 });
  }
  ```

### 2. Autoryzacja (Authorization)
- **Ownership verification**: KRYTYCZNE - sprawdzenie czy impreza należy do zalogowanego użytkownika
- **IDOR Prevention**: Zabezpieczenie przed Insecure Direct Object Reference
- **RLS Policies**: Supabase Row Level Security automatycznie filtruje dane
- **Implementacja**:
  ```typescript
  const party = await partyService.getPartyById(partyId, userId);
  if (!party) {
    return new Response(JSON.stringify({
      error: { code: 'NOT_FOUND', message: 'Party not found' }
    }), { status: 404 });
  }
  if (party.user_id !== userId) {
    return new Response(JSON.stringify({
      error: { code: 'FORBIDDEN', message: "You don't have permission to access this party" }
    }), { status: 403 });
  }
  ```

### 3. Walidacja danych wejściowych (Input Validation)
- **Zod schema**: Silna walidacja typów dla wszystkich inputów
- **PartyId validation**: Sprawdzenie czy jest positive bigint
- **Query params sanitization**: Parsowanie boolean z różnych formatów ('true', '1', true)
- **SQL Injection prevention**: Supabase client używa parametryzowanych zapytań
- **Implementacja**:
  ```typescript
  const queryParamsSchema = z.object({
    include_bac: z
      .string()
      .optional()
      .default('true')
      .transform(val => val === 'true' || val === '1')
  });

  const partyIdSchema = z.coerce.number().int().positive();
  ```

### 4. Row Level Security (RLS)
- **Supabase RLS policies**: Automatyczne filtrowanie po user_id
- **Defense in depth**: Nawet jeśli logika aplikacji zawiedzie, RLS blokuje nieuprawniony dostęp
- **Policy dla Drinks**:
  ```sql
  CREATE POLICY "Users can view own drinks" ON Drinks
    FOR SELECT USING (auth.uid() = user_id);
  ```

### 5. Rate Limiting
- **Implementacja**: Rozważyć dodanie rate limiting w middleware
- **Supabase limits**: Respektowanie limitów API Supabase
- **DoS prevention**: Ochrona przed nadmiernym obciążeniem

### 6. Data Exposure
- **Minimal data**: Zwracanie tylko niezbędnych danych
- **Sensitive fields**: Nie eksponować wrażliwych danych (np. pełny user_id w niektórych kontekstach)
- **JSONB sanitization**: Upewnienie się że profile_snapshot nie zawiera dodatkowych danych

### 7. Error Messages
- **Generic errors**: Nie ujawniać szczegółów implementacji w komunikatach błędów
- **Logging**: Logować szczegóły błędów po stronie serwera, ale nie wysyłać do klienta
- **Security through obscurity**: Nie różnicować komunikatów 403/404 aby uniemożliwić enumeration attacks

## 7. Obsługa błędów

### Hierarchia obsługi błędów

```
Request → Middleware → Route Handler → Service Layer → Database
   ↓          ↓             ↓               ↓            ↓
 401        401           400             403/404       500
                                          500           500
```

### Szczegółowe scenariusze błędów

#### 1. 400 Bad Request - Nieprawidłowe dane wejściowe

**Przyczyny:**
- Nieprawidłowy format partyId (nie jest liczbą)
- partyId jest ujemny lub zero
- Nieprawidłowy format include_bac (nie można parsować jako boolean)

**Przykłady:**
```typescript
// partyId nie jest liczbą
GET /api/parties/abc/drinks
→ 400: "Invalid party ID format"

// partyId jest ujemny
GET /api/parties/-5/drinks
→ 400: "Party ID must be a positive integer"
```

**Implementacja:**
```typescript
try {
  const partyId = partyIdSchema.parse(params.id);
  const { include_bac } = queryParamsSchema.parse(url.searchParams);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.warn('Validation error', { error: error.errors, path: url.pathname });
    return new Response(JSON.stringify({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid request parameters',
        details: error.errors
      }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
```

#### 2. 401 Unauthorized - Brak lub nieprawidłowa autoryzacja

**Przyczyny:**
- Brak tokena w headerze Authorization
- Token nieprawidłowy lub wygasły
- Token nie zawiera user_id

**Przykłady:**
```typescript
// Brak headera
GET /api/parties/42/drinks
→ 401: "Missing or invalid authentication token"

// Nieprawidłowy token
Authorization: Bearer invalid_token
→ 401: "Missing or invalid authentication token"
```

**Implementacja:**
```typescript
const user = context.locals.user;
if (!user) {
  logger.warn('Unauthorized access attempt', { path: url.pathname });
  return new Response(JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authentication token'
    }
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
```

#### 3. 403 Forbidden - Brak uprawnień do zasobu

**Przyczyny:**
- Impreza należy do innego użytkownika
- Użytkownik próbuje uzyskać dostęp do cudzych danych

**Przykłady:**
```typescript
// User A próbuje dostać się do imprezy User B
GET /api/parties/99/drinks
Authorization: Bearer user_a_token
→ 403: "You don't have permission to access this party"
```

**Implementacja:**
```typescript
const party = await partyService.getPartyById(partyId, supabase);
if (!party) {
  logger.info('Party not found', { partyId, userId: user.id });
  return new Response(JSON.stringify({
    error: {
      code: 'NOT_FOUND',
      message: 'Party not found'
    }
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

if (party.user_id !== user.id) {
  logger.warn('Forbidden access attempt', { partyId, userId: user.id, ownerId: party.user_id });
  return new Response(JSON.stringify({
    error: {
      code: 'FORBIDDEN',
      message: "You don't have permission to access this party"
    }
  }), { status: 403, headers: { 'Content-Type': 'application/json' } });
}
```

#### 4. 404 Not Found - Zasób nie istnieje

**Przyczyny:**
- Impreza o podanym ID nie istnieje w bazie danych
- Impreza została usunięta

**Przykłady:**
```typescript
GET /api/parties/99999/drinks
→ 404: "Party not found"
```

**Implementacja:**
```typescript
const party = await partyService.getPartyById(partyId, supabase);
if (!party) {
  logger.info('Party not found', { partyId, userId: user.id });
  return new Response(JSON.stringify({
    error: {
      code: 'NOT_FOUND',
      message: 'Party not found'
    }
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
```

#### 5. 500 Internal Server Error - Błąd serwera

**Przyczyny:**
- Błąd połączenia z bazą danych
- Nieprzechwycony wyjątek w kodzie
- Błąd Supabase API
- Błąd parsowania JSONB
- Timeout query

**Przykłady:**
```typescript
// Database connection error
→ 500: "An unexpected error occurred"

// JSONB parse error
→ 500: "An unexpected error occurred"
```

**Implementacja:**
```typescript
try {
  // ... main logic
} catch (error) {
  logger.error('Unexpected error in GET drinks', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    partyId,
    userId: user.id
  });
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
```

### Logging Strategy

**Info level:**
- Successful requests (optional dla produkcji)
- 404 errors (legitimate cases)

**Warn level:**
- 400 validation errors
- 401 unauthorized attempts
- 403 forbidden access attempts

**Error level:**
- 500 internal errors
- Database errors
- Unexpected exceptions

**Log format:**
```typescript
logger.error('Error description', {
  error: errorMessage,
  stack: errorStack,
  partyId,
  userId,
  path: url.pathname,
  timestamp: new Date().toISOString()
});
```

### Error Response Format

Wszystkie błędy zwracają spójny format zgodny z `APIError` type:

```typescript
interface APIError {
  error: {
    code: string;           // Machine-readable kod błędu
    message: string;        // Human-readable komunikat
    details?: Record<string, unknown>;  // Opcjonalne szczegóły (tylko dla 400)
  }
}
```

### Rollback Strategy

- **GET endpoint**: Brak potrzeby rollback (read-only)
- **Database transactions**: Nie potrzebne dla pojedynczego SELECT
- **Cache invalidation**: Nie dotyczy GET endpoint

## 8. Rozważania dotyczące wydajności

### 1. Database Query Optimization

#### Indexy
**Wymagane:**
- Index na `Drinks(party_id, consumed_at)` - dla szybkiego sortowania i filtrowania
- Index na `BACCalculations(drink_id, calculation_timestamp DESC)` - dla LATERAL JOIN

**Rekomendowane DDL:**
```sql
-- Index na Drinks dla szybkiego query
CREATE INDEX idx_drinks_party_consumed 
  ON Drinks(party_id, consumed_at ASC);

-- Index na BACCalculations dla LATERAL JOIN
CREATE INDEX idx_bac_drink_timestamp 
  ON BACCalculations(drink_id, calculation_timestamp DESC);
```

#### Query Optimization
- **LATERAL JOIN**: Efektywne pobieranie najnowszego BAC dla każdego napoju
- **Single query**: Unikanie N+1 problem przez użycie JOIN zamiast osobnych queries
- **Conditional JOIN**: Include BAC tylko gdy potrzebne (`include_bac=true`)

### 2. Response Size Management

#### Paginacja (Future Enhancement)
**Obecna implementacja:**
- Zwraca wszystkie napoje z imprezy
- Dla większości case'ów wystarczające (przeciętnie 5-20 napojów per party)

**Przyszłe rozszerzenie:**
```typescript
// Query parameters dla paginacji
interface PartyDrinksQueryParams {
  include_bac?: boolean;
  page?: number;        // Numer strony (default: 1)
  limit?: number;       // Napojów per strona (default: 50, max: 100)
}

// Response z paginacją
interface PartyDrinksResponseDTO {
  party_id: number;
  drinks: DrinkWithBACDTO[];
  total_count: number;
  pagination?: {
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}
```

**Implementacja:**
```sql
-- Query z paginacją
SELECT ... 
FROM Drinks d
WHERE d.party_id = $1
ORDER BY d.consumed_at ASC
LIMIT $2 OFFSET $3;
```

#### Data Compression
- **JSONB fields**: Profile_snapshot może być duży, ale jest kompresowany przez Postgres
- **HTTP compression**: Rozważyć gzip/brotli compression w Astro config
- **Response trimming**: Nie zwracać niepotrzebnych pól

### 3. Caching Strategy

#### Client-side caching
**Headers:**
```typescript
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, max-age=60',  // Cache na 60 sekund
  'ETag': generateETag(drinks),             // Dla conditional requests
};
```

**Conditional requests:**
- Support dla `If-None-Match` header
- Zwracanie 304 Not Modified gdy dane nie zmieniły się

#### Server-side caching
**Strategia:**
- **Redis cache**: Rozważyć dla często odczytywanych parties
- **Cache key**: `party:${partyId}:drinks:${include_bac}`
- **TTL**: 60 seconds
- **Invalidation**: Przy dodaniu/edycji/usunięciu drinka

**Implementacja (future):**
```typescript
const cacheKey = `party:${partyId}:drinks:${include_bac}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return new Response(cached, { status: 200, headers });
}
// ... fetch from DB
await redis.setex(cacheKey, 60, JSON.stringify(response));
```

### 4. Connection Pooling
- **Supabase client**: Używa connection pooling automatycznie
- **Max connections**: Respektowanie limitów plan Supabase
- **Timeout**: Ustawienie reasonable timeout (5-10 sekund)

### 5. Monitoring Metrics

**Key metrics:**
- **Response time**: P50, P95, P99 latency
- **Database query time**: Monitoring slow queries (>100ms)
- **Error rate**: % żądań z błędami 4xx/5xx
- **Throughput**: Requests per second
- **Cache hit rate**: Jeśli implementujemy caching

**Alarmy:**
- Response time > 500ms dla P95
- Error rate > 5%
- Database query time > 200ms

### 6. Performance Budgets

**Cele:**
- Total response time: < 200ms (P95)
- Database query time: < 100ms
- Payload size: < 50KB dla typowej imprezy (10 napojów)
- Memory usage: < 10MB per request

**Limity:**
- Max drinks per party: Rozważyć limit (np. 200) z paginacją
- Query timeout: 10 sekund
- Request timeout: 30 sekund

## 7. Etapy wdrożenia

### Faza 1: Przygotowanie (Setup)

#### Krok 1.1: Weryfikacja zależności
```bash
# Sprawdzenie czy wszystkie zależności są zainstalowane
npm list zod
npm list @supabase/supabase-js
```

#### Krok 1.2: Weryfikacja indeksów w bazie danych
```sql
-- Sprawdzić czy indeksy istnieją
\d Drinks
\d BACCalculations

-- Jeśli nie, utworzyć:
CREATE INDEX IF NOT EXISTS idx_drinks_party_consumed 
  ON Drinks(party_id, consumed_at ASC);

CREATE INDEX IF NOT EXISTS idx_bac_drink_timestamp 
  ON BACCalculations(drink_id, calculation_timestamp DESC);
```

#### Krok 1.3: Weryfikacja RLS policies
```sql
-- Sprawdzić policies dla Drinks
SELECT * FROM pg_policies WHERE tablename = 'drinks';

-- Sprawdzić policies dla BACCalculations
SELECT * FROM pg_policies WHERE tablename = 'baccalculations';
```

### Faza 2: Service Layer

#### Krok 2.1: Rozszerzenie drink.service.ts
**Lokalizacja:** `src/lib/services/drink.service.ts`

**WAŻNE:** Zaimportuj wszystkie potrzebne typy z `src/types.ts` - NIE twórz własnych definicji typów!

**Zadania:**
1. Utworzyć metodę `getDrinksByPartyId()`
2. Implementować conditional join z BACCalculations
3. Obsłużyć parametr `include_bac`
4. Sortowanie po consumed_at ASC
5. Mapowanie danych do DTOs

**Implementacja:**
```typescript
// src/lib/services/drink.service.ts

import type { SupabaseClient } from '../db/supabase.client';
import type { DrinkWithBACDTO, BACCalculationDTO } from '../types';

export async function getDrinksByPartyId(
  partyId: number,
  includeBac: boolean,
  supabase: SupabaseClient
): Promise<DrinkWithBACDTO[]> {
  let query = supabase
    .from('drinks')
    .select(`
      *,
      ${includeBac ? 'baccalculations!inner(*)' : ''}
    `)
    .eq('party_id', partyId)
    .order('consumed_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch drinks: ${error.message}`);
  }

  // Mapowanie do DTOs
  return data.map(drink => ({
    ...drink,
    created_at: drink.created_at,
    updated_at: drink.updated_at,
    bac_calculation: includeBac && drink.baccalculations?.length > 0
      ? mapBACCalculationToDTO(drink.baccalculations[0])
      : null
  }));
}

function mapBACCalculationToDTO(bac: any): BACCalculationDTO {
  return {
    id: bac.id,
    party_id: bac.party_id,
    user_id: bac.user_id,
    drink_id: bac.drink_id,
    calculated_bac: bac.calculated_bac,
    calculation_timestamp: bac.calculation_timestamp,
    algorithm_version: bac.algorithm_version,
    user_profile_snapshot: bac.user_profile_snapshot,
    time_since_first_drink_minutes: bac.time_since_first_drink_minutes,
    metabolized_alcohol_g: bac.metabolized_alcohol_g,
    created_at: bac.created_at
  };
}
```

#### Krok 2.2: Weryfikacja party.service.ts
**Lokalizacja:** `src/lib/services/party.service.ts`

**WAŻNE:** Użyj typu `Party` z `src/types.ts` dla wartości zwracanej.

**Zadania:**
1. Sprawdzić czy istnieje metoda `getPartyById()`
2. Jeśli nie, utworzyć ją
3. Metoda powinna zwracać party lub null

**Implementacja:**
```typescript
// src/lib/services/party.service.ts

import type { SupabaseClient } from '../db/supabase.client';
import type { Party } from '../types';

export async function getPartyById(
  partyId: number,
  supabase: SupabaseClient
): Promise<Party | null> {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {  // Not found
      return null;
    }
    throw new Error(`Failed to fetch party: ${error.message}`);
  }

  return data;
}
```

### Faza 3: Validation Layer

#### Krok 3.1: Utworzenie validation schemas
**Lokalizacja:** `src/lib/validation/drink.validation.ts` (lub nowy plik)

**Implementacja:**
```typescript
// src/lib/validation/drink.validation.ts

import { z } from 'zod';

export const partyIdParamSchema = z.object({
  id: z.coerce.number().int().positive({
    message: 'Party ID must be a positive integer'
  })
});

export const partyDrinksQuerySchema = z.object({
  include_bac: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default('true')
    .transform(val => val === 'true' || val === '1')
});
```

### Faza 4: API Route Handler

#### Krok 4.1: Utworzenie pliku route
**Lokalizacja:** `src/pages/api/parties/[id]/drinks.ts`

**KRYTYCZNE:** Zaimportuj wszystkie typy response i error z `src/types.ts`:
- `PartyDrinksResponseDTO` - dla success response
- `APIError` - dla error responses
- Użyj `satisfies` operator dla type safety

**Struktura:**
```typescript
// src/pages/api/parties/[id]/drinks.ts

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { partyIdParamSchema, partyDrinksQuerySchema } from '../../../../lib/validation/drink.validation';
import { getPartyById } from '../../../../lib/services/party.service';
import { getDrinksByPartyId } from '../../../../lib/services/drink.service';
import { logger } from '../../../../lib/logger';
import type { PartyDrinksResponseDTO, APIError } from '../../../../types';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals, url }) => {
  const supabase = locals.supabase;
  const user = locals.user;

  try {
    // 1. Authorization check
    if (!user) {
      logger.warn('Unauthorized access attempt', { path: url.pathname });
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authentication token'
          }
        } satisfies APIError),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Input validation
    const paramsResult = partyIdParamSchema.safeParse(params);
    if (!paramsResult.success) {
      logger.warn('Invalid party ID', { 
        error: paramsResult.error.errors, 
        params 
      });
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid party ID format',
            details: paramsResult.error.errors
          }
        } satisfies APIError),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partyId = paramsResult.data.id;

    const queryResult = partyDrinksQuerySchema.safeParse(
      Object.fromEntries(url.searchParams)
    );
    if (!queryResult.success) {
      logger.warn('Invalid query parameters', { 
        error: queryResult.error.errors, 
        query: url.search 
      });
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid query parameters',
            details: queryResult.error.errors
          }
        } satisfies APIError),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { include_bac } = queryResult.data;

    // 3. Party existence and ownership check
    const party = await getPartyById(partyId, supabase);
    
    if (!party) {
      logger.info('Party not found', { partyId, userId: user.id });
      return new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Party not found'
          }
        } satisfies APIError),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (party.user_id !== user.id) {
      logger.warn('Forbidden access attempt', { 
        partyId, 
        userId: user.id, 
        ownerId: party.user_id 
      });
      return new Response(
        JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: "You don't have permission to access this party"
          }
        } satisfies APIError),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch drinks with optional BAC
    const drinks = await getDrinksByPartyId(partyId, include_bac, supabase);

    // 5. Build response
    const response: PartyDrinksResponseDTO = {
      party_id: partyId,
      drinks,
      total_count: drinks.length
    };

    logger.info('Successfully fetched party drinks', {
      partyId,
      userId: user.id,
      drinksCount: drinks.length,
      includeBac: include_bac
    });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60'
        } 
      }
    );

  } catch (error) {
    logger.error('Unexpected error in GET party drinks', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      partyId: params.id,
      userId: user?.id,
      path: url.pathname
    });

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      } satisfies APIError),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### Faza 5: Manual testing

**Checklist:**
- [ ] Utworzyć test party przez UI lub API
- [ ] Dodać kilka napojów do party
- [ ] Przetestować GET /api/parties/{id}/drinks
- [ ] Przetestować z include_bac=true i false
- [ ] Przetestować z nieprawidłowym partyId
- [ ] Przetestować bez tokena
- [ ] Przetestować z tokenem innego użytkownika
- [ ] Sprawdzić response times w Network tab
- [ ] Sprawdzić logi w konsoli serwera

### Faza 6: Documentation

#### Krok 6.1: API Documentation
**Lokalizacja:** `docs/api/parties-drinks-get.md` (jeśli istnieje docs folder)

**Zawartość:**
- Endpoint URL i metoda
- Opis funkcjonalności
- Request parameters
- Response format
- Error codes
- Przykłady cURL
- Code examples (JavaScript/TypeScript)

#### Krok 6.2: Code comments
- JSDoc dla exported functions
- Inline comments dla complex logic
- TODO comments dla future enhancements

#### Krok 6.3: Changelog
**Lokalizacja:** `CHANGELOG.md`

**Entry:**
```markdown
## [Unreleased]

### Added
- GET /api/parties/:partyId/drinks endpoint for retrieving party drinks with optional BAC calculations
- Support for conditional BAC calculations via include_bac query parameter
- Comprehensive error handling and validation for drinks endpoint
```

### Faza 7: Deployment Preparation

#### Krok 7.1: Environment variables check
```bash
# .env.local
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### Krok 7.2: Database migrations
- Sprawdzić czy wszystkie migracje są applied
- Sprawdzić czy indeksy są utworzone
- Sprawdzić czy RLS policies są active

#### Krok 7.3: Performance baseline
- Zmierzyć response time w dev environment
- Zmierzyć database query time
- Zapisać baseline metrics

#### Krok 7.4: Security audit
- [ ] RLS policies verified
- [ ] Authorization checks in place
- [ ] Input validation comprehensive
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't expose PII

### Faza 8: Deployment

#### Krok 8.1: Code review
- Pull request z pełnym opisem
- Review od przynajmniej jednego team member
- Approval przed merge

#### Krok 8.2: Staging deployment
- Deploy do staging environment
- Run full test suite
- Manual smoke tests
- Performance verification

#### Krok 8.3: Production deployment
- Deploy do production
- Monitor error rates
- Monitor response times
- Monitor database load

#### Krok 8.4: Post-deployment verification
- [ ] Endpoint odpowiada na requests
- [ ] Response format jest poprawny
- [ ] Error handling działa
- [ ] Logi są zapisywane
- [ ] Metrics są zbierane

### Faza 9: Monitoring i Maintenance

#### Krok 9.1: Monitoring setup
- Configure alerts dla error rate > 5%
- Configure alerts dla response time > 500ms
- Configure alerts dla database query time > 200ms

#### Krok 9.2: Dashboard
- Utworzyć dashboard z key metrics:
  - Requests per minute
  - Average response time
  - Error rate by status code
  - Database query performance
  - Cache hit rate (jeśli applicable)

#### Krok 9.3: Regular reviews
- Weekly review of error logs
- Monthly performance analysis
- Quarterly security audit

---

## 10. Best Practices i Checklisty

### Checklist: Używanie typów z types.ts

**OBOWIĄZKOWE dla każdego pliku:**

```typescript
// ✅ POPRAWNIE - import typów z types.ts
import type { 
  PartyDrinksResponseDTO, 
  DrinkWithBACDTO,
  BACCalculationDTO,
  APIError 
} from '../types';

// ✅ POPRAWNIE - użycie satisfies dla type safety
const response = {
  party_id: 42,
  drinks: [],
  total_count: 0
} satisfies PartyDrinksResponseDTO;

// ❌ ŹLE - tworzenie własnych typów
interface MyDrinkResponse {  // NIE ROBIĆ TEGO!
  drinks: any[];
}

// ❌ ŹLE - any zamiast typów z types.ts
const response: any = { ... };  // NIE ROBIĆ TEGO!
```

### Checklist przed commitem:

- [ ] Wszystkie typy zaimportowane z `src/types.ts`
- [ ] Brak inline type definitions dla DTOs
- [ ] Użycie `satisfies` operator dla response objects
- [ ] Brak użycia `any` type (używaj typów z types.ts)
- [ ] Import `SupabaseClient` z `src/db/supabase.client.ts` (NIE z @supabase/supabase-js)
- [ ] Wszystkie DTOs są properly typed
- [ ] Error responses używają `APIError` type

### Przykład property typed file:

```typescript
// src/pages/api/parties/[id]/drinks.ts
import type { APIRoute } from 'astro';
import type { 
  PartyDrinksResponseDTO, 
  APIError,
  DrinkWithBACDTO 
} from '../../../../types';  // ✅ CENTRALNY IMPORT
import type { SupabaseClient } from '../../../../db/supabase.client';  // ✅ NIE z @supabase/supabase-js

export const GET: APIRoute = async ({ params, request, locals }) => {
  // ... logic
  
  // ✅ Type-safe response
  const response: PartyDrinksResponseDTO = {
    party_id: partyId,
    drinks: drinks,
    total_count: drinks.length
  };
  
  // ✅ Type-safe error
  const error: APIError = {
    error: {
      code: 'NOT_FOUND',
      message: 'Party not found'
    }
  };
};
```

---

## Podsumowanie

Ten plan implementacji zapewnia kompleksowe wytyczne dla wdrożenia endpointu `GET /api/parties/:partyId/drinks`. Kluczowe aspekty:

1. **Bezpieczeństwo** - Wielowarstwowa autoryzacja i walidacja
2. **Wydajność** - Optymalizacja zapytań i strategia cachowania
3. **Niezawodność** - Kompleksowa obsługa błędów
4. **Skalowalność** - Przygotowanie na paginację i większe obciążenie
5. **Maintainability** - Czysta architektura z separation of concerns

**Szacowany czas implementacji:**
- Faza 1-4 (Core implementation): 4-6 godzin
- Faza 5 (Testing): 3-4 godziny
- Faza 6-9 (Docs, deployment, monitoring): 2-3 godziny
- **Total: 9-13 godzin**

**Priorytety:**
1. Core functionality (Faza 1-4) - MUST HAVE
2. Testing (Faza 5) - MUST HAVE
3. Documentation (Faza 6) - SHOULD HAVE
4. Advanced monitoring (Faza 9) - NICE TO HAVE
