# API Endpoint Implementation Plan: Close Party

## 1. Przegląd punktu końcowego

Endpoint `PATCH /api/parties/:id/close` służy do zamknięcia trwającej sesji imprezowej. Po zamknięciu impreza otrzymuje status `closed`, ustawiony zostaje timestamp zakończenia, dezaktywowane są wszystkie aktywne alerty związane z imprezą, oraz logowane jest zdarzenie `party_closed`. Zamknięta impreza nie może być dalej edytowana - nie można dodawać nowych napojów ani modyfikować istniejących.

Endpoint jest kluczowy dla user story **US-007** (Zakończenie imprezy) i zapewnia integralność danych poprzez uniemożliwienie modyfikacji zakończonych sesji.

## 2. Szczegóły żądania

### Metoda HTTP
`PATCH`

### Struktura URL
```
/api/parties/:id/close
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Parametry

#### Path Parameters
- **`id`** (bigint, wymagane)
  - Identyfikator imprezy do zamknięcia
  - Musi być dodatnią liczbą całkowitą
  - Przykład: `/api/parties/123/close`

#### Request Body
```json
{
  "ended_at": "2026-01-12T23:30:00Z"  // opcjonalne
}
```

**Pola:**
- **`ended_at`** (string, opcjonalne)
  - Timestamp zakończenia imprezy w formacie ISO 8601
  - Jeśli nie podany, używany jest bieżący timestamp
  - Musi być >= `started_at` imprezy
  - Nie może być w przyszłości (z marginesem tolerancji ~5 minut dla różnic czasu)
  - Przykład: `"2026-01-12T23:30:00.000Z"`

## 3. Wykorzystywane typy

### Command Model
```typescript
// src/types.ts - już zdefiniowany
interface ClosePartyCommand {
  ended_at?: string;
}
```

### Response DTO
```typescript
// src/types.ts - już zdefiniowany
interface ClosePartyResponseDTO {
  id: number;
  status: PartyStatus;  // zawsze 'closed'
  started_at: string;
  ended_at: string;
  bac_estimate_max: number | null;
  total_drinks_count: number | null;
  total_ml_consumed: number | null;
}
```

### Supporting Types
```typescript
// src/types.ts - już zdefiniowane
type PartyStatus = 'ongoing' | 'closed';
type EventType = 'party_closed' | ...;  // enum z database.types.ts
```

### Validation Schema (do stworzenia)
```typescript
// src/lib/validation/party.validation.ts
import { z } from 'zod';

export const closePartyParamsSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

export const closePartyBodySchema = z.object({
  ended_at: z.string().datetime().optional()
});
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Status Code:** `200 OK`

**Body:**
```json
{
  "id": 123,
  "status": "closed",
  "started_at": "2026-01-12T20:00:00.000Z",
  "ended_at": "2026-01-12T23:30:00.000Z",
  "bac_estimate_max": 0.12,
  "total_drinks_count": 8,
  "total_ml_consumed": 2400
}
```

**Pola:**
- `id`: Identyfikator zamkniętej imprezy
- `status`: Zawsze `"closed"`
- `started_at`: Timestamp rozpoczęcia (nie zmieniony)
- `ended_at`: Timestamp zakończenia (nowo ustawiony lub z żądania)
- `bac_estimate_max`: Maksymalne BAC osiągnięte podczas imprezy (cached value)
- `total_drinks_count`: Łączna liczba napojów (cached value)
- `total_ml_consumed`: Łączna ilość ml alkoholu (cached value)

### Error Responses

#### 400 Bad Request - Party Already Closed
```json
{
  "error": {
    "code": "PARTY_ALREADY_CLOSED",
    "message": "Party is already closed and cannot be closed again"
  }
}
```

#### 400 Bad Request - Invalid ended_at
```json
{
  "error": {
    "code": "INVALID_ENDED_AT",
    "message": "ended_at must be after party start time and not in the future",
    "details": {
      "started_at": "2026-01-12T20:00:00Z",
      "ended_at": "2026-01-12T19:00:00Z"
    }
  }
}
```

#### 400 Bad Request - Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "ended_at": "Invalid datetime format"
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
    "message": "You do not have permission to close this party"
  }
}
```

#### 404 Not Found
```json
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## 5. Przepływ danych

### High-Level Flow
```
Client Request
    ↓
[1] Middleware - Authentication
    ↓
[2] Route Handler - Parse & Validate Input
    ↓
[3] Service Layer - Business Logic
    ├── [3a] Fetch party & verify ownership
    ├── [3b] Validate party status (ongoing)
    ├── [3c] Validate ended_at timestamp
    ├── [3d] Update party (status, ended_at)
    ├── [3e] Deactivate all alerts for party
    ├── [3f] Log 'party_closed' event
    └── [3g] Return formatted response
    ↓
[4] Route Handler - Format Response
    ↓
Client Response (200 OK)
```

### Detailed Data Flow

#### Step 1: Authentication (Middleware)
- Middleware w `src/middleware/index.ts` weryfikuje token Bearer
- Pobiera `user_id` z Supabase Auth
- Dodaje instancję Supabase Client do `context.locals`
- W przypadku błędu: zwraca 401 Unauthorized

#### Step 2: Route Handler - Validation
Plik: `src/pages/api/parties/[id].ts`
- Walidacja path parameter `id` (zod schema)
- Walidacja request body `ended_at` (zod schema)
- W przypadku błędów walidacji: zwraca 400 Bad Request

#### Step 3: Service Layer - Business Logic
Plik: `src/lib/services/party.service.ts`

**Metoda:** `closeParty(supabase, userId, partyId, command)`

**3a. Fetch Party & Verify Ownership**
```typescript
const { data: party, error } = await supabase
  .from('parties')
  .select('id, user_id, status, started_at, ended_at, bac_estimate_max, total_drinks_count, total_ml_consumed')
  .eq('id', partyId)
  .eq('user_id', userId)  // RLS also enforces this
  .single();

if (error || !party) {
  throw new Error('PARTY_NOT_FOUND');  // 404
}
```

**3b. Validate Party Status**
```typescript
if (party.status === 'closed') {
  throw new Error('PARTY_ALREADY_CLOSED');  // 400
}
```

**3c. Validate ended_at Timestamp**
```typescript
const endedAt = command.ended_at ? new Date(command.ended_at) : new Date();
const startedAt = new Date(party.started_at);
const now = new Date();

// Check if ended_at is not before started_at
if (endedAt < startedAt) {
  throw new Error('INVALID_ENDED_AT');  // 400
}

// Check if ended_at is not in the future (with 5 min tolerance)
const maxAllowedTime = new Date(now.getTime() + 5 * 60 * 1000);
if (endedAt > maxAllowedTime) {
  throw new Error('INVALID_ENDED_AT');  // 400
}
```

**3d. Update Party**
```typescript
const { data: updatedParty, error: updateError } = await supabase
  .from('parties')
  .update({
    status: 'closed',
    ended_at: endedAt.toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('id', partyId)
  .select('id, status, started_at, ended_at, bac_estimate_max, total_drinks_count, total_ml_consumed')
  .single();

if (updateError) {
  throw updateError;  // 500
}
```

**3e. Deactivate All Alerts**
```typescript
const { error: alertsError } = await supabase
  .from('alerts')
  .update({
    is_active: false,
    updated_at: new Date().toISOString()
  })
  .eq('party_id', partyId)
  .eq('is_active', true);

if (alertsError) {
  logger.error('Failed to deactivate alerts', { partyId, error: alertsError });
  // Don't throw - this is non-critical
}
```

**3f. Log Event**
```typescript
const { error: eventError } = await supabase
  .from('events')
  .insert({
    user_id: userId,
    party_id: partyId,
    event_type: 'party_closed'
  });

if (eventError) {
  logger.error('Failed to log party_closed event', { partyId, error: eventError });
  // Don't throw - this is non-critical
}
```

**3g. Return Formatted Response**
```typescript
return {
  id: updatedParty.id,
  status: updatedParty.status,
  started_at: updatedParty.started_at,
  ended_at: updatedParty.ended_at,
  bac_estimate_max: updatedParty.bac_estimate_max,
  total_drinks_count: updatedParty.total_drinks_count,
  total_ml_consumed: updatedParty.total_ml_consumed
};
```

#### Step 4: Route Handler - Response
- Zwraca sformatowaną odpowiedź z kodem 200 OK
- Ustawia header `Content-Type: application/json`

### Database Interactions

**Tables Modified:**
1. **Parties** - UPDATE (status, ended_at, updated_at)
2. **Alerts** - UPDATE (is_active = false dla wszystkich alertów party)
3. **Events** - INSERT (nowy event 'party_closed')

**Database Queries:**
1. SELECT na Parties (fetch party)
2. UPDATE na Parties (close party)
3. UPDATE na Alerts (deactivate alerts)
4. INSERT na Events (log event)

**Transaction Consideration:**
- Główna operacja UPDATE na Parties jest krytyczna
- Deaktywacja alertów i logowanie eventu są non-critical - błędy są logowane ale nie przerywają flow
- Nie wymaga explicit transaction - RLS i constraints zapewniają spójność

## 6. Względy bezpieczeństwa

### Authentication
- **Wymagania**: Użytkownik musi być zalogowany
- **Implementacja**: 
  - Token Bearer weryfikowany przez middleware
  - Supabase Auth zarządza sesją użytkownika
  - `user_id` pobierany z `context.locals.supabase.auth.getUser()`
- **Błąd**: 401 Unauthorized jeśli token brakuje lub jest nieprawidłowy

### Authorization
- **Wymagania**: Użytkownik może zamknąć tylko własne imprezy
- **Implementacja**:
  - Query do Parties zawiera `.eq('user_id', userId)`
  - RLS policies w Supabase dodatkowo wymuszają dostęp tylko do własnych rekordów
  - Podwójna warstwa zabezpieczeń (application + database)
- **Błąd**: 403 Forbidden lub 404 Not Found (lepiej nie ujawniać istnienia rekordu)

### Input Validation
- **Path Parameter `id`**:
  - Walidacja przez zod: `z.string().regex(/^\d+$/).transform(Number)`
  - Zapobiega SQL injection (choć Supabase client używa prepared statements)
  - Błąd: 400 Bad Request

- **Request Body `ended_at`**:
  - Walidacja przez zod: `z.string().datetime().optional()`
  - Format ISO 8601
  - Dodatkowa walidacja biznesowa (>= started_at, <= now + 5min)
  - Błąd: 400 Bad Request

### Row Level Security (RLS)
- **Parties Table**:
  - Policy: `user_id = auth.uid()` dla SELECT, UPDATE
  - Zapobiega dostępowi do imprez innych użytkowników
  
- **Alerts Table**:
  - Policy: `user_id = auth.uid()` dla UPDATE
  - Chronione dezaktywowanie alertów

- **Events Table**:
  - Policy: `user_id = auth.uid()` dla INSERT
  - Tylko własne eventy mogą być logowane

### Data Integrity
- **Status Transition**:
  - Tylko przejście 'ongoing' → 'closed' jest dozwolone
  - Nie można ponownie zamknąć zamkniętej imprezy
  - Check na poziomie aplikacji

- **Timestamp Consistency**:
  - `ended_at >= started_at` wymuszony przez walidację
  - `ended_at <= now + 5min` zapobiega znacznikom czasu z przyszłości

- **Foreign Key Integrity**:
  - Alerts.party_id i Events.party_id referencje są enforced przez DB

### Rate Limiting
- **Recommendation**: Implementacja rate limiting na poziomie middleware lub API Gateway
- **Suggested Limits**: 
  - 10 żądań/minutę per użytkownik dla endpointów modyfikujących
  - Zapobiega abuse (przypadkowe wielokrotne zamykanie)

### Error Information Disclosure
- **Principle**: Nie ujawniaj szczegółów implementacji w błędach
- **Implementation**:
  - 404 Not Found zamiast 403 Forbidden dla nieistniejących/cudzych imprez
  - Nie ujawniaj database error messages w production
  - Używaj generic 500 Internal Server Error dla nieoczekiwanych błędów
  - Szczegółowe błędy tylko w logach serwera

## 7. Obsługa błędów

### Client Errors (4xx)

#### 400 Bad Request

**Scenario 1: Invalid Party ID Format**
```typescript
// Trigger: id = "abc" lub id = "-5"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": { "id": "Must be a positive integer" }
  }
}
```

**Scenario 2: Party Already Closed**
```typescript
// Trigger: party.status === 'closed'
{
  "error": {
    "code": "PARTY_ALREADY_CLOSED",
    "message": "Party is already closed and cannot be closed again"
  }
}
```

**Scenario 3: Invalid ended_at (Before Start)**
```typescript
// Trigger: ended_at < started_at
{
  "error": {
    "code": "INVALID_ENDED_AT",
    "message": "ended_at must be after party start time",
    "details": {
      "started_at": "2026-01-12T20:00:00Z",
      "ended_at": "2026-01-12T19:00:00Z"
    }
  }
}
```

**Scenario 4: Invalid ended_at (Future)**
```typescript
// Trigger: ended_at > now + 5 minutes
{
  "error": {
    "code": "INVALID_ENDED_AT",
    "message": "ended_at cannot be in the future"
  }
}
```

**Scenario 5: Invalid Datetime Format**
```typescript
// Trigger: ended_at = "not-a-date"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": { "ended_at": "Invalid datetime format" }
  }
}
```

**Handling Strategy:**
- Validate early in route handler
- Use zod for schema validation
- Return detailed error messages for debugging (in development)
- Log validation errors for monitoring

#### 401 Unauthorized

**Scenario: Missing or Invalid Token**
```typescript
// Trigger: No Authorization header, invalid token, or expired token
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**Handling Strategy:**
- Handled by middleware before reaching route handler
- Middleware checks `context.locals.supabase.auth.getUser()`
- Return early with 401

#### 403 Forbidden

**Scenario: Party Belongs to Another User**
```typescript
// Trigger: party.user_id !== authenticated user_id
// Note: With RLS, this typically returns 404 instead
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to close this party"
  }
}
```

**Handling Strategy:**
- Primarily handled by RLS policies
- Can be explicitly checked in service layer
- Prefer returning 404 to avoid information disclosure

#### 404 Not Found

**Scenario: Party Does Not Exist or Unauthorized Access**
```typescript
// Trigger: No party with given ID or party belongs to another user
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```

**Handling Strategy:**
- Single query with `.eq('id', partyId).eq('user_id', userId).single()`
- RLS policies enforce access control
- Return 404 for both "not exists" and "not authorized" (security)

### Server Errors (5xx)

#### 500 Internal Server Error

**Scenario 1: Database Connection Error**
```typescript
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Scenario 2: Unexpected Database Error**
```typescript
// Database constraint violation, timeout, etc.
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Scenario 3: Unhandled Exception**
```typescript
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Handling Strategy:**
- Wrap service calls in try-catch
- Log full error details server-side (using logger)
- Return generic error message to client
- Include request ID for debugging (optional)
- Monitor error rates and types

### Error Handling Implementation

```typescript
// src/pages/api/parties/[id].ts

export const PATCH: APIRoute = async (context) => {
  try {
    // ... authentication, validation, service call
    
  } catch (error) {
    // Log error
    logger.error('Error closing party', { 
      partyId: context.params.id,
      userId: context.locals.userId,
      error 
    });

    // Determine error type and response
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.flatten().fieldErrors
        }
      }), { status: 400 });
    }

    if (error.message === 'PARTY_NOT_FOUND') {
      return new Response(JSON.stringify({
        error: {
          code: 'PARTY_NOT_FOUND',
          message: 'Party not found'
        }
      }), { status: 404 });
    }

    if (error.message === 'PARTY_ALREADY_CLOSED') {
      return new Response(JSON.stringify({
        error: {
          code: 'PARTY_ALREADY_CLOSED',
          message: 'Party is already closed'
        }
      }), { status: 400 });
    }

    if (error.message === 'INVALID_ENDED_AT') {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_ENDED_AT',
          message: 'Invalid ended_at timestamp',
          details: error.details
        }
      }), { status: 400 });
    }

    // Default 500 error
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    }), { status: 500 });
  }
};
```

### Non-Critical Errors

**Alerts Deactivation Failure:**
- Log error but don't throw
- Party closure succeeds even if alerts fail to deactivate
- Rationale: Alerts can be manually managed later

**Event Logging Failure:**
- Log error but don't throw
- Party closure succeeds even if event logging fails
- Rationale: Event logging is for analytics, not critical for business logic

## 8. Rozważania dotyczące wydajności

### Query Optimization

**Single Query for Party Fetch:**
```typescript
// Efficient: Single query with all needed fields
.select('id, user_id, status, started_at, ended_at, bac_estimate_max, total_drinks_count, total_ml_consumed')
.eq('id', partyId)
.eq('user_id', userId)
.single();

// Avoid: Multiple queries or selecting unnecessary columns
```

**Batch Alert Deactivation:**
```typescript
// Efficient: Single UPDATE for all alerts
.update({ is_active: false })
.eq('party_id', partyId)
.eq('is_active', true);

// Avoid: Individual UPDATE per alert
```

### Database Indexes

**Required Indexes:**
- `parties(id)` - Primary key (already indexed)
- `parties(user_id, status)` - Composite index for filtering
- `alerts(party_id, is_active)` - Composite index for batch updates
- `events(user_id, party_id)` - Composite index for logging

**Verification:**
Check existing indexes in migration files:
- `20260104120200_init_indexes.sql`

### Caching Strategy

**Not Applicable for This Endpoint:**
- PATCH operations modify state, no caching needed
- Each request must hit database to ensure data consistency

**Consider for Related Endpoints:**
- GET party details could benefit from short-lived cache (30-60s)
- User profile could be cached for BAC calculations

### Response Size Optimization

**Current Response:**
- 7 fields, minimal data
- Estimated size: ~150-200 bytes
- No optimization needed

**Avoid:**
- Don't include nested objects (drinks, alerts) in close response
- Don't include profile_snapshot (not needed by client)

### Database Connection Pooling

**Supabase Client:**
- Uses connection pooling by default
- No additional configuration needed
- Connections managed by Supabase infrastructure

### Potential Bottlenecks

**1. Multiple Database Writes:**
- **Issue**: 3 database operations (UPDATE parties, UPDATE alerts, INSERT event)
- **Impact**: ~50-150ms total latency
- **Mitigation**: 
  - Keep operations sequential (don't add transaction overhead)
  - Make alert deactivation and event logging non-blocking
  - Consider async event logging (future optimization)

**2. RLS Policy Evaluation:**
- **Issue**: RLS policies add overhead to queries
- **Impact**: Minimal (~5-10ms per query)
- **Mitigation**: 
  - RLS is necessary for security, accept the overhead
  - Ensure indexes support RLS queries

**3. Timestamp Validation Logic:**
- **Issue**: Multiple date comparisons in JavaScript
- **Impact**: Negligible (<1ms)
- **Mitigation**: None needed

### Performance Monitoring

**Metrics to Track:**
- Response time (p50, p95, p99)
- Database query duration
- Error rate
- Success rate

**Logging:**
```typescript
const startTime = Date.now();
// ... operation
logger.info('Party closed', {
  partyId,
  userId,
  duration: Date.now() - startTime
});
```

### Scalability Considerations

**Current Load Estimate:**
- User closes party 1-2 times per session
- Low frequency operation
- No scaling concerns for MVP

**Future Optimization:**
- If event logging becomes bottleneck, use message queue
- If alerts deactivation is slow, consider database trigger

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie walidacji (zod schemas)

**Plik:** `src/lib/validation/party.validation.ts`

**Zadania:**
1. Dodaj schema dla path parameter:
   ```typescript
   export const closePartyParamsSchema = z.object({
     id: z.string().regex(/^\d+$/, 'ID must be a positive integer').transform(Number)
   });
   ```

2. Dodaj schema dla request body:
   ```typescript
   export const closePartyBodySchema = z.object({
     ended_at: z.string().datetime('Invalid ISO 8601 datetime format').optional()
   });
   ```

**Weryfikacja:**
- Uruchom TypeScript compiler: `npm run build`
- Sprawdź brak błędów kompilacji

---

### Krok 2: Implementacja service layer

**Plik:** `src/lib/services/party.service.ts`

**Zadania:**
1. Dodaj import typów:
   ```typescript
   import type { ClosePartyCommand, ClosePartyResponseDTO } from '@/types';
   ```

2. Implementuj funkcję `closeParty`:
   ```typescript
   export async function closeParty(
     supabase: SupabaseClient,
     userId: string,
     partyId: number,
     command: ClosePartyCommand
   ): Promise<ClosePartyResponseDTO> {
     // [Implementation as detailed in section 5]
   }
   ```

3. Struktura funkcji:
   - Fetch party with ownership check
   - Validate party status (not closed)
   - Validate and set ended_at
   - Update party (status, ended_at)
   - Deactivate alerts (non-critical)
   - Log event (non-critical)
   - Return formatted response

4. Error handling:
   - Throw custom errors: `PARTY_NOT_FOUND`, `PARTY_ALREADY_CLOSED`, `INVALID_ENDED_AT`
   - Log non-critical errors (alerts, events)

**Weryfikacja:**
- TypeScript kompiluje bez błędów
- Wszystkie typy są poprawne

---

### Krok 3: Implementacja route handler

**Plik:** `src/pages/api/parties/[id].ts`

**Zadania:**
1. Sprawdź istniejący plik - jeśli istnieje, dodaj handler PATCH do istniejącego pliku
2. Jeśli nie istnieje, utwórz nowy plik z strukturą:
   ```typescript
   import type { APIRoute } from 'astro';
   import { closePartyParamsSchema, closePartyBodySchema } from '@/lib/validation/party.validation';
   import { closeParty } from '@/lib/services/party.service';
   import { logger } from '@/lib/logger';

   export const prerender = false;

   export const PATCH: APIRoute = async (context) => {
     // Implementation
   };
   ```

3. Implementacja PATCH handler:
   - Extract authenticated user from `context.locals`
   - Validate path parameter (id)
   - Parse and validate request body
   - Call service layer
   - Handle errors with appropriate status codes
   - Return formatted response

**Weryfikacja:**
- Endpoint dostępny pod `/api/parties/:id/close`
- TypeScript kompiluje bez błędów

---

### Krok 4: Testowanie manualne

**Setup:**
1. Uruchom lokalny serwer: `npm run dev`
2. Upewnij się, że Supabase działa lokalnie: `npx supabase start`
3. Przygotuj dane testowe:
   - Utworz użytkownika testowego
   - Utwórz ongoing party dla użytkownika

**Test Cases:**

**TC1: Successful Party Closure (Happy Path)**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/1/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 OK with closed party data
```

**TC2: Party Closure with Custom ended_at**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/1/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ended_at": "2026-01-12T23:30:00Z"}'

# Expected: 200 OK with specified ended_at
```

**TC3: Close Already Closed Party**
```bash
# Request (repeat TC1)
# Expected: 400 Bad Request - PARTY_ALREADY_CLOSED
```

**TC4: Close Non-Existent Party**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/99999/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 404 Not Found - PARTY_NOT_FOUND
```

**TC5: Close Party Owned by Another User**
```bash
# Request with different user token
# Expected: 404 Not Found (RLS blocks access)
```

**TC6: Invalid ended_at (Before Start)**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/1/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ended_at": "2020-01-01T00:00:00Z"}'

# Expected: 400 Bad Request - INVALID_ENDED_AT
```

**TC7: Invalid ended_at (Future)**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/1/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ended_at": "2030-01-01T00:00:00Z"}'

# Expected: 400 Bad Request - INVALID_ENDED_AT
```

**TC8: Missing Authentication**
```bash
# Request without Authorization header
curl -X PATCH http://localhost:4321/api/parties/1/close \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 401 Unauthorized
```

**TC9: Invalid Party ID Format**
```bash
# Request
curl -X PATCH http://localhost:4321/api/parties/abc/close \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request - VALIDATION_ERROR
```

**Weryfikacja dodatkowa:**
- Sprawdź w bazie danych, czy:
  - Party status = 'closed'
  - Party ended_at jest ustawione
  - Wszystkie alerty dla party są dezaktywowane (is_active = false)
  - Event 'party_closed' został zalogowany

---

### Krok 5: Veryfikacja integracji

**Zadania:**

1. **Database Verification:**
   ```sql
   -- Check party status
   SELECT id, status, ended_at FROM parties WHERE id = 1;
   
   -- Check alerts deactivation
   SELECT id, is_active FROM alerts WHERE party_id = 1;
   
   -- Check event logging
   SELECT * FROM events WHERE party_id = 1 AND event_type = 'party_closed';
   ```

2. **RLS Verification:**
   - Próba zamknięcia party innego użytkownika
   - Sprawdź, czy RLS blokuje dostęp
   - Weryfikuj, że zwracany jest 404, nie 403

3. **Middleware Verification:**
   - Sprawdź, czy middleware poprawnie weryfikuje token
   - Test z expired token
   - Test z invalid token
   - Test bez tokenu

4. **Logging Verification:**
   - Sprawdź logi serwera pod kątem:
     - Successful closures
     - Validation errors
     - Database errors
     - Non-critical failures (alerts, events)

---

### Krok 6: Dokumentacja i cleanup

**Zadania:**

1. **Code Comments:**
   - Dodaj JSDoc comments do funkcji `closeParty`
   - Udokumentuj parametry i return type
   - Opisz error cases

2. **API Documentation:**
   - Zaktualizuj API documentation (jeśli istnieje)
   - Dodaj przykłady request/response
   - Opisz error codes

3. **Update Types Documentation:**
   - Upewnij się, że komentarze w `types.ts` są aktualne
   - Dodaj przykłady użycia DTOs

4. **Code Review Checklist:**
   - [ ] Wszystkie typy są poprawnie zdefiniowane
   - [ ] Walidacja input jest kompletna
   - [ ] Error handling obejmuje wszystkie scenariusze
   - [ ] RLS policies są respektowane
   - [ ] Logging jest wystarczające do debugowania
   - [ ] Performance nie ma oczywistych problemów
   - [ ] Security best practices są zastosowane
   - [ ] Code follows project conventions (eslint)

5. **Linter:**
   ```bash
   npm run lint
   npm run format
   ```

---

### Krok 7: Deployment preparation

**Zadania:**

1. **Environment Variables:**
   - Sprawdź, czy wszystkie wymagane env vars są ustawione
   - SUPABASE_URL, SUPABASE_ANON_KEY

2. **Database Migrations:**
   - Upewnij się, że wszystkie migracje są applied
   - Sprawdź, czy indexes istnieją

3. **Security Audit:**
   - Review RLS policies
   - Check for potential SQL injection (shouldn't be possible with Supabase)
   - Verify authentication flow
   - Check error message disclosure

4. **Final Verification:**
   - Wszystkie test cases pass
   - No TypeScript errors
   - No linting errors
   - Documentation complete
   - Code reviewed

---

## Podsumowanie implementacji

Endpoint `PATCH /api/parties/:id/close` wymaga zaimplementowania:

1. **Walidacji** (zod schemas) w `party.validation.ts`
2. **Business logic** (service layer) w `party.service.ts`
3. **Route handler** (API endpoint) w `pages/api/parties/[id].ts`

Kluczowe aspekty:
- Authentication przez middleware
- Authorization przez RLS i user_id check
- Walidacja status'u imprezy (tylko 'ongoing' → 'closed')
- Walidacja timestamp'u (>= started_at, <= now)
- Dezaktywacja alertów (non-critical)
- Logowanie eventu (non-critical)
- Comprehensive error handling

Endpoint odpowiada User Story **US-007** i zapewnia integralność danych poprzez uniemożliwienie dalszej edycji zamkniętych imprez.
