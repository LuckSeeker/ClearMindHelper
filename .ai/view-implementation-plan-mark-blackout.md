# API Endpoint Implementation Plan: Mark Party Blackout

## 1. Przegląd punktu końcowego

**Endpoint**: `PATCH /api/parties/:id/blackout`

Endpoint służy do oznaczania, że impreza zakończyła się urwaniem filmu (blackout) u użytkownika. To działanie wyzwala automatyczną adaptację progu BAC użytkownika - nowy próg jest ustawiany na wartość szczytowego BAC osiągniętego podczas tej imprezy. Ma to na celu pomóc użytkownikowi uniknąć podobnych sytuacji w przyszłości poprzez wcześniejsze ostrzeżenia.

**Kluczowe funkcjonalności:**
- Oznaczenie imprezy jako zakończonej blackout'em
- Automatyczne utworzenie nowego progu BAC opartego na szczytowej wartości BAC z tej imprezy
- Deaktywacja poprzedniego progu użytkownika
- Logowanie zdarzeń dla celów analitycznych

**User Stories**: US-008, US-014

## 2. Szczegóły żądania

### Metoda HTTP
`PATCH`

### Struktura URL
```
/api/parties/:id/blackout
```

### Parametry

**Path Parameters:**
- `id` (bigint, required) - Identyfikator imprezy, którą chcemy oznaczyć

**Headers:**
- `Authorization: Bearer {access_token}` (required) - Token JWT dla uwierzytelnienia użytkownika

**Request Body:**
```typescript
{
  "blackout_marked": boolean  // required - zawsze true w praktyce
}
```

**Przykładowe żądanie:**
```http
PATCH /api/parties/123/blackout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "blackout_marked": true
}
```

## 3. Wykorzystywane typy

### Command Models
```typescript
// z types.ts
interface MarkBlackoutCommand {
  blackout_marked: boolean;
}
```

### Response DTOs
```typescript
// z types.ts
interface MarkBlackoutResponseDTO {
  id: number;
  blackout_marked: boolean;
  blackout_marked_at: string | null;
  new_threshold: UserThresholdDTO | null;
}

interface UserThresholdDTO extends Omit<UserThreshold, "created_at"> {
  created_at: string;
}
```

### Database Entities
```typescript
// z database.types.ts (przez types.ts)
type Party = Tables<"parties">;
type UserThreshold = Tables<"userthresholds">;
type BACCalculation = Tables<"baccalculations">;
type Event = Tables<"events">;
```

### Validation Schema (Zod)
```typescript
// Do utworzenia w party.validation.ts
const markBlackoutSchema = z.object({
  blackout_marked: z.boolean({
    required_error: "blackout_marked is required",
    invalid_type_error: "blackout_marked must be a boolean"
  })
});

const partyIdSchema = z.coerce.number().int().positive({
  message: "Party ID must be a positive integer"
});
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)
```typescript
{
  "id": 123,
  "blackout_marked": true,
  "blackout_marked_at": "2026-01-12T22:30:00.000Z",
  "new_threshold": {
    "id": 45,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "threshold_bac": 0.15,
    "is_current": true,
    "reason": "blackout_marked",
    "trigger_party_id": 123,
    "created_at": "2026-01-12T22:30:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request** - Walidacja biznesowa nieudana
```typescript
{
  "error": {
    "code": "PARTY_NOT_CLOSED",
    "message": "Cannot mark blackout for ongoing party. Close the party first."
  }
}
```
lub
```typescript
{
  "error": {
    "code": "NO_BAC_CALCULATIONS",
    "message": "Cannot mark blackout: no BAC calculations available for this party"
  }
}
```
lub
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "blackout_marked": "blackout_marked is required"
    }
  }
}
```

**401 Unauthorized** - Brak/nieprawidłowy token
```typescript
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**403 Forbidden** - Impreza należy do innego użytkownika
```typescript
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to modify this party"
  }
}
```

**404 Not Found** - Impreza nie istnieje
```typescript
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```

**500 Internal Server Error** - Błąd serwera
```typescript
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
[1] Middleware: Authenticate user (extract user_id from JWT)
    ↓
[2] API Route: /api/parties/[id]/blackout.ts
    ↓
[3] Validate path parameter (id)
    ↓
[4] Parse & validate request body (Zod schema)
    ↓
[5] Call PartyService.markBlackout(partyId, userId, command)
    ↓
[6] Service: Begin database transaction
    ↓
[7] Service: Fetch party by ID
    ├─ If not found → throw 404 error
    └─ If found → continue
    ↓
[8] Service: Check party.user_id === userId
    ├─ If not equal → throw 403 error
    └─ If equal → continue
    ↓
[9] Service: Check party.status === 'closed'
    ├─ If 'ongoing' → throw 400 error (PARTY_NOT_CLOSED)
    └─ If 'closed' → continue
    ↓
[10] Service: Query MAX(calculated_bac) from BACCalculations WHERE party_id = id
    ├─ If no results → throw 400 error (NO_BAC_CALCULATIONS)
    └─ If found → peakBAC = max value
    ↓
[11] Service: Update Parties table
     SET blackout_marked = true,
         blackout_marked_at = NOW(),
         updated_at = NOW()
     WHERE id = partyId
    ↓
[12] Service: Update previous UserThresholds
     SET is_current = false
     WHERE user_id = userId AND is_current = true
    ↓
[13] Service: Insert new UserThreshold
     {
       user_id: userId,
       threshold_bac: peakBAC,
       is_current: true,
       reason: 'blackout_marked',
       trigger_party_id: partyId,
       created_at: NOW()
     }
    ↓
[14] Service: Insert 'blackout_marked' event
     {
       user_id: userId,
       party_id: partyId,
       event_type: 'blackout_marked',
       created_at: NOW()
     }
    ↓
[15] Service: Insert 'threshold_adjusted' event
     {
       user_id: userId,
       party_id: partyId,
       event_type: 'threshold_adjusted',
       created_at: NOW()
     }
    ↓
[16] Service: Commit transaction
    ↓
[17] Service: Fetch created threshold record
    ↓
[18] Service: Return MarkBlackoutResponseDTO
    ↓
[19] API Route: Return JSON response with 200 status
    ↓
Client receives response
```

### Interakcje z bazą danych

**Tabele zaangażowane:**
1. `Parties` - aktualizacja pól blackout_marked, blackout_marked_at
2. `BACCalculations` - zapytanie o maksymalny BAC
3. `UserThresholds` - deaktywacja starych progów i utworzenie nowego
4. `Events` - logowanie dwóch zdarzeń

**Transakcja SQL (koncepcyjnie):**
```sql
BEGIN;

-- Pobranie imprezy
SELECT * FROM Parties WHERE id = $1;

-- Sprawdzenie BAC calculations
SELECT MAX(calculated_bac) FROM BACCalculations WHERE party_id = $1;

-- Aktualizacja imprezy
UPDATE Parties 
SET blackout_marked = true, 
    blackout_marked_at = NOW(), 
    updated_at = NOW()
WHERE id = $1;

-- Deaktywacja starych progów
UPDATE UserThresholds 
SET is_current = false 
WHERE user_id = $2 AND is_current = true;

-- Utworzenie nowego progu
INSERT INTO UserThresholds (user_id, threshold_bac, is_current, reason, trigger_party_id)
VALUES ($2, $3, true, 'blackout_marked', $1)
RETURNING *;

-- Logowanie zdarzeń
INSERT INTO Events (user_id, party_id, event_type) 
VALUES ($2, $1, 'blackout_marked');

INSERT INTO Events (user_id, party_id, event_type) 
VALUES ($2, $1, 'threshold_adjusted');

COMMIT;
```

### Supabase Client Usage
```typescript
// W service
const { data: party, error } = await supabase
  .from('parties')
  .select('*')
  .eq('id', partyId)
  .single();

const { data: bacCalc } = await supabase
  .from('baccalculations')
  .select('calculated_bac')
  .eq('party_id', partyId)
  .order('calculated_bac', { ascending: false })
  .limit(1)
  .single();

// ... itd.
```

## 6. Względy bezpieczeństwa

### Uwierzytelnienie (Authentication)
- **Mechanizm**: JWT Bearer token w nagłówku `Authorization`
- **Implementacja**: 
  - Token jest weryfikowany przez middleware Astro (`src/middleware/index.ts`)
  - Supabase automatycznie weryfikuje token i dostarcza `user` w `context.locals`
  - API endpoint sprawdza obecność `context.locals.user`
- **Kod błędu**: 401 Unauthorized jeśli token jest nieprawidłowy/brakuje

### Autoryzacja (Authorization)
- **Sprawdzenie**: Party.user_id musi odpowiadać authenticated user_id
- **Implementacja**: 
  - Po pobraniu party z bazy, porównaj `party.user_id` z `context.locals.user.id`
  - RLS (Row Level Security) w Supabase dodatkowo zapewnia ochronę na poziomie bazy
- **Kod błędu**: 403 Forbidden jeśli użytkownik próbuje zmodyfikować cudze party

### Walidacja danych wejściowych
- **Request Body**: Zod schema waliduje typ i obecność `blackout_marked`
- **Path Parameter**: Walidacja że `id` jest pozytywnym integerem
- **Business Logic Validation**:
  - Status imprezy musi być 'closed'
  - Muszą istnieć BAC calculations dla tej imprezy
- **Kod błędu**: 400 Bad Request dla nieprawidłowych danych

### Ochrona przed atakami

**SQL Injection:**
- Supabase SDK używa parametryzowanych zapytań
- Brak bezpośredniego SQL w kodzie aplikacji

**Authorization Bypass:**
- Podwójne zabezpieczenie: kod aplikacji + RLS policies
- RLS policies zapewniają, że nawet przy błędzie w kodzie, użytkownik nie może modyfikować cudzych danych

**Race Conditions:**
- Użycie transakcji bazy danych zapewnia atomowość operacji
- Szczególnie ważne dla deaktywacji starych progów i utworzenia nowego

**Data Integrity:**
- CHECK constraints w bazie danych (threshold_bac między 0.08 a 0.50)
- Foreign key constraints zapewniają spójność relacji

### RLS Policies (Row Level Security)
Zakładamy istniejące policies dla tabel:
```sql
-- Parties: użytkownik może modyfikować tylko swoje imprezy
CREATE POLICY "Users can update own parties" ON Parties
  FOR UPDATE USING (auth.uid() = user_id);

-- UserThresholds: użytkownik może tworzyć/modyfikować tylko swoje progi
CREATE POLICY "Users can insert own thresholds" ON UserThresholds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thresholds" ON UserThresholds
  FOR UPDATE USING (auth.uid() = user_id);

-- Events: użytkownik może tworzyć tylko swoje zdarzenia
CREATE POLICY "Users can insert own events" ON Events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 7. Obsługa błędów

### Kategorie błędów i odpowiedzi

#### 1. Błędy uwierzytelnienia (401)
**Scenariusze:**
- Brak nagłówka Authorization
- Nieprawidłowy format tokenu
- Token wygasły
- Token nieważny (nieprawidłowy podpis)

**Obsługa:**
```typescript
// W middleware - automatyczna obsługa przez Supabase
if (!context.locals.user) {
  return new Response(
    JSON.stringify({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authentication token"
      }
    }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 2. Błędy autoryzacji (403)
**Scenariusze:**
- Użytkownik próbuje zmodyfikować party należące do innego użytkownika

**Obsługa:**
```typescript
// W service
if (party.user_id !== userId) {
  throw {
    status: 403,
    code: "FORBIDDEN",
    message: "You don't have permission to modify this party"
  };
}
```

#### 3. Błędy walidacji (400)
**Scenariusze:**

a) **Nieprawidłowy request body:**
```typescript
// Zod validation error
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request body",
    details: {
      blackout_marked: "Expected boolean, received string"
    }
  }
}
```

b) **Impreza nie jest zamknięta:**
```typescript
{
  error: {
    code: "PARTY_NOT_CLOSED",
    message: "Cannot mark blackout for ongoing party. Close the party first."
  }
}
```

c) **Brak BAC calculations:**
```typescript
{
  error: {
    code: "NO_BAC_CALCULATIONS",
    message: "Cannot mark blackout: no BAC calculations available for this party"
  }
}
```

d) **Nieprawidłowy party ID:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid party ID",
    details: {
      id: "Party ID must be a positive integer"
    }
  }
}
```

#### 4. Błędy not found (404)
**Scenariusze:**
- Party o podanym ID nie istnieje w bazie

**Obsługa:**
```typescript
// W service
if (!party) {
  throw {
    status: 404,
    code: "PARTY_NOT_FOUND",
    message: "Party not found"
  };
}
```

#### 5. Błędy serwera (500)
**Scenariusze:**
- Błąd bazy danych (connection timeout, constraint violation)
- Nieoczekiwany błąd w kodzie aplikacji
- Błąd transakcji

**Obsługa:**
```typescript
// W API route - catch-all
try {
  // ... business logic
} catch (error) {
  // Log error for debugging
  logger.error("Error marking blackout", { error, partyId, userId });
  
  // Return generic error to client (nie ujawniaj szczegółów wewnętrznych)
  if (error.status) {
    // Known application error
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }),
      { status: error.status }
    );
  }
  
  // Unknown error
  return new Response(
    JSON.stringify({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      }
    }),
    { status: 500 }
  );
}
```

### Strategia logowania błędów
```typescript
// Użyj istniejącego logger z src/lib/logger.ts
import { logger } from "@/lib/logger";

// Loguj wszystkie błędy z kontekstem
logger.error("Failed to mark blackout", {
  partyId,
  userId,
  error: error.message,
  stack: error.stack
});

// Loguj warningi dla business validation
logger.warn("Attempted to mark blackout for unclosed party", {
  partyId,
  userId,
  partyStatus: party.status
});
```

### Obsługa błędów transakcji
```typescript
// Supabase nie wspiera bezpośrednio transakcji w SDK
// Alternatywy:
// 1. Użyj Postgres Functions (RPC) dla atomowych operacji
// 2. Zaimplementuj compensating transactions (rollback manualnie)
// 3. Użyj optimistic locking

// Przykład z RPC:
const { data, error } = await supabase.rpc('mark_party_blackout', {
  p_party_id: partyId,
  p_user_id: userId
});

if (error) {
  throw {
    status: 500,
    code: "DATABASE_ERROR",
    message: "Failed to mark blackout"
  };
}
```

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

#### 1. Zapytanie o maksymalny BAC
**Problem:** Skanowanie całej tabeli BACCalculations dla party
**Optymalizacja:**
- Wykorzystaj istniejący index na `party_id` (już jest w migracjach)
- Dodatkowy index na `(party_id, calculated_bac DESC)` dla szybszego MAX query
```sql
CREATE INDEX idx_bac_party_max ON BACCalculations(party_id, calculated_bac DESC);
```

**Alternatywa:** Użyj cached `bac_estimate_max` z tabeli Parties (jeśli już jest obliczony)
```typescript
// Jeśli party.bac_estimate_max jest dostępne, użyj go zamiast query do BACCalculations
const peakBAC = party.bac_estimate_max ?? await queryMaxBAC(partyId);
```

#### 2. Aktualizacja poprzednich progów
**Problem:** UPDATE na wszystkich progach użytkownika z is_current = true
**Optymalizacja:**
- Zazwyczaj tylko jeden próg jest current, więc to szybka operacja
- Index na `(user_id, is_current)` zapewnia szybki lookup
```sql
CREATE INDEX idx_thresholds_user_current ON UserThresholds(user_id, is_current) 
WHERE is_current = true;
```

#### 3. Multiple INSERT operations
**Problem:** Trzy inserty w ramach jednej operacji (threshold, 2x events)
**Optymalizacja:**
- Użyj batch inserts gdzie możliwe
```typescript
// Batch insert events
await supabase.from('events').insert([
  {
    user_id: userId,
    party_id: partyId,
    event_type: 'blackout_marked'
  },
  {
    user_id: userId,
    party_id: partyId,
    event_type: 'threshold_adjusted'
  }
]);
```

### Strategie optymalizacji

#### 1. Database Indexes
Upewnij się że są utworzone (już są w migracjach):
```sql
-- Z migrations
CREATE INDEX idx_parties_user_id ON Parties(user_id);
CREATE INDEX idx_bac_party_id ON BACCalculations(party_id);
CREATE INDEX idx_thresholds_user_current ON UserThresholds(user_id, is_current);
CREATE INDEX idx_events_user_party ON Events(user_id, party_id);
```

#### 2. Use Postgres Functions (RPC)
Dla atomowych operacji i lepszej wydajności, stwórz Postgres function:
```sql
CREATE OR REPLACE FUNCTION mark_party_blackout(
  p_party_id BIGINT,
  p_user_id UUID
) RETURNS TABLE(
  party_id BIGINT,
  blackout_marked BOOLEAN,
  blackout_marked_at TIMESTAMP WITH TIME ZONE,
  threshold_id BIGINT,
  threshold_bac DECIMAL(4,2)
) AS $$
DECLARE
  v_peak_bac DECIMAL(4,2);
  v_party Parties%ROWTYPE;
  v_threshold UserThresholds%ROWTYPE;
BEGIN
  -- Fetch and validate party
  SELECT * INTO v_party FROM Parties WHERE id = p_party_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party not found' USING ERRCODE = 'P0001';
  END IF;
  
  IF v_party.user_id != p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0002';
  END IF;
  
  IF v_party.status != 'closed' THEN
    RAISE EXCEPTION 'Party not closed' USING ERRCODE = 'P0003';
  END IF;
  
  -- Get peak BAC
  SELECT COALESCE(MAX(calculated_bac), v_party.bac_estimate_max) 
  INTO v_peak_bac 
  FROM BACCalculations 
  WHERE party_id = p_party_id;
  
  IF v_peak_bac IS NULL THEN
    RAISE EXCEPTION 'No BAC calculations' USING ERRCODE = 'P0004';
  END IF;
  
  -- Update party
  UPDATE Parties 
  SET blackout_marked = true, 
      blackout_marked_at = NOW(), 
      updated_at = NOW()
  WHERE id = p_party_id;
  
  -- Deactivate old thresholds
  UPDATE UserThresholds 
  SET is_current = false 
  WHERE user_id = p_user_id AND is_current = true;
  
  -- Create new threshold
  INSERT INTO UserThresholds (user_id, threshold_bac, is_current, reason, trigger_party_id)
  VALUES (p_user_id, v_peak_bac, true, 'blackout_marked', p_party_id)
  RETURNING * INTO v_threshold;
  
  -- Log events
  INSERT INTO Events (user_id, party_id, event_type) VALUES
    (p_user_id, p_party_id, 'blackout_marked'),
    (p_user_id, p_party_id, 'threshold_adjusted');
  
  -- Return result
  RETURN QUERY SELECT 
    p_party_id,
    true,
    NOW(),
    v_threshold.id,
    v_threshold.threshold_bac;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Zalety:**
- Atomowe wykonanie (transaction handling wbudowany)
- Mniejszy network roundtrip (jedna wywołanie zamiast wielu)
- Lepsze wykorzystanie connection pooling
- Łatwiejsze testowanie (można testować function bezpośrednio)

#### 3. Connection Pooling
- Supabase automatycznie zarządza connection pooling
- Upewnij się że używasz `context.locals.supabase` w API routes (pooled connection)

#### 4. Caching considerations
- Ten endpoint modyfikuje dane, więc nie ma sensu cache'ować response
- Jeśli istnieje cache dla party details, należy go invalidate po tej operacji

#### 5. Rate Limiting
Zaimplementuj rate limiting dla ochrony przed abuse:
```typescript
// Możliwe limity:
// - Max 1 request per party (tylko raz można oznaczyć blackout)
// - Max 10 requests per user per hour (ochrona przed spam)
```

### Monitoring i Metryki
```typescript
// Metryki do śledzenia:
// - Średni czas wykonania endpoint
// - Liczba błędów 400 (validation failures)
// - Liczba błędów 500 (server errors)
// - Rozkład peak BAC values (analityka)
// - Czas wykonania poszczególnych operacji DB
```

## 9. Kroki implementacji

### Krok 1: Przygotowanie walidacji
**Plik:** `src/lib/validation/party.validation.ts`

**Akcje:**
```typescript
// Dodaj do istniejącego pliku party.validation.ts
import { z } from "zod";

export const markBlackoutSchema = z.object({
  blackout_marked: z.boolean({
    required_error: "blackout_marked is required",
    invalid_type_error: "blackout_marked must be a boolean"
  })
});

export const partyIdParamSchema = z.coerce
  .number({
    required_error: "Party ID is required",
    invalid_type_error: "Party ID must be a number"
  })
  .int({ message: "Party ID must be an integer" })
  .positive({ message: "Party ID must be positive" });
```

### Krok 2: Rozszerzenie Party Service
**Plik:** `src/lib/services/party.service.ts`

**Akcje:**
```typescript
// Dodaj nową metodę do istniejącej klasy/modułu PartyService

import type { SupabaseClient } from "@/db/supabase.client";
import type { MarkBlackoutCommand, MarkBlackoutResponseDTO } from "@/types";
import { logger } from "@/lib/logger";

/**
 * Marks a party as having resulted in blackout and adapts user's threshold
 * @param supabase - Supabase client from context.locals
 * @param partyId - ID of the party to mark
 * @param userId - Authenticated user's ID
 * @param command - Mark blackout command data
 * @returns Response with updated party and new threshold
 * @throws Error with status code for various validation failures
 */
export async function markBlackout(
  supabase: SupabaseClient,
  partyId: number,
  userId: string,
  command: MarkBlackoutCommand
): Promise<MarkBlackoutResponseDTO> {
  logger.info("Marking party blackout", { partyId, userId });

  // Step 1: Fetch party
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("*")
    .eq("id", partyId)
    .single();

  if (partyError || !party) {
    logger.warn("Party not found", { partyId, userId });
    throw {
      status: 404,
      code: "PARTY_NOT_FOUND",
      message: "Party not found"
    };
  }

  // Step 2: Check authorization
  if (party.user_id !== userId) {
    logger.warn("Unauthorized access attempt", { partyId, userId, ownerId: party.user_id });
    throw {
      status: 403,
      code: "FORBIDDEN",
      message: "You don't have permission to modify this party"
    };
  }

  // Step 3: Validate party is closed
  if (party.status !== "closed") {
    logger.warn("Attempted to mark blackout for unclosed party", { partyId, status: party.status });
    throw {
      status: 400,
      code: "PARTY_NOT_CLOSED",
      message: "Cannot mark blackout for ongoing party. Close the party first."
    };
  }

  // Step 4: Get peak BAC (use cached value if available, otherwise query)
  let peakBAC = party.bac_estimate_max;
  
  if (!peakBAC || peakBAC === 0) {
    const { data: bacData, error: bacError } = await supabase
      .from("baccalculations")
      .select("calculated_bac")
      .eq("party_id", partyId)
      .order("calculated_bac", { ascending: false })
      .limit(1)
      .single();

    if (bacError || !bacData) {
      logger.warn("No BAC calculations found", { partyId, userId });
      throw {
        status: 400,
        code: "NO_BAC_CALCULATIONS",
        message: "Cannot mark blackout: no BAC calculations available for this party"
      };
    }

    peakBAC = bacData.calculated_bac;
  }

  // Step 5: Update party
  const { error: updateError } = await supabase
    .from("parties")
    .update({
      blackout_marked: command.blackout_marked,
      blackout_marked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", partyId);

  if (updateError) {
    logger.error("Failed to update party", { partyId, error: updateError });
    throw {
      status: 500,
      code: "DATABASE_ERROR",
      message: "Failed to mark blackout"
    };
  }

  // Step 6: Deactivate old thresholds
  const { error: deactivateError } = await supabase
    .from("userthresholds")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true);

  if (deactivateError) {
    logger.error("Failed to deactivate old thresholds", { userId, error: deactivateError });
    // Continue - not critical
  }

  // Step 7: Create new threshold
  const { data: newThreshold, error: thresholdError } = await supabase
    .from("userthresholds")
    .insert({
      user_id: userId,
      threshold_bac: peakBAC,
      is_current: true,
      reason: "blackout_marked",
      trigger_party_id: partyId
    })
    .select()
    .single();

  if (thresholdError || !newThreshold) {
    logger.error("Failed to create new threshold", { userId, peakBAC, error: thresholdError });
    throw {
      status: 500,
      code: "DATABASE_ERROR",
      message: "Failed to create new threshold"
    };
  }

  // Step 8: Log events
  const { error: eventsError } = await supabase
    .from("events")
    .insert([
      {
        user_id: userId,
        party_id: partyId,
        event_type: "blackout_marked"
      },
      {
        user_id: userId,
        party_id: partyId,
        event_type: "threshold_adjusted"
      }
    ]);

  if (eventsError) {
    logger.error("Failed to log events", { userId, partyId, error: eventsError });
    // Continue - not critical
  }

  // Step 9: Build response
  const response: MarkBlackoutResponseDTO = {
    id: partyId,
    blackout_marked: true,
    blackout_marked_at: new Date().toISOString(),
    new_threshold: {
      id: newThreshold.id,
      user_id: newThreshold.user_id,
      threshold_bac: newThreshold.threshold_bac,
      is_current: newThreshold.is_current,
      reason: newThreshold.reason,
      trigger_party_id: newThreshold.trigger_party_id,
      created_at: newThreshold.created_at
    }
  };

  logger.info("Successfully marked blackout", { partyId, userId, newThresholdId: newThreshold.id });
  
  return response;
}
```

### Krok 3: Utworzenie API Route
**Plik:** `src/pages/api/parties/[id]/blackout.ts`

**Akcje:**
```typescript
import type { APIRoute } from "astro";
import { partyIdParamSchema, markBlackoutSchema } from "@/lib/validation/party.validation";
import { markBlackout } from "@/lib/services/party.service";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * PATCH /api/parties/:id/blackout
 * Marks that a party resulted in blackout and adapts user's threshold
 */
export const PATCH: APIRoute = async (context) => {
  try {
    // 1. Check authentication
    const user = context.locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid authentication token"
          }
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // 2. Validate party ID from path
    const partyIdResult = partyIdParamSchema.safeParse(context.params.id);
    if (!partyIdResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid party ID",
            details: partyIdResult.error.flatten().fieldErrors
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const partyId = partyIdResult.data;

    // 3. Parse and validate request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid JSON in request body"
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const validationResult = markBlackoutSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validationResult.error.flatten().fieldErrors
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // 4. Call service
    const supabase = context.locals.supabase;
    const result = await markBlackout(
      supabase,
      partyId,
      user.id,
      validationResult.data
    );

    // 5. Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    // Handle known application errors
    if (error.status && error.code) {
      return new Response(
        JSON.stringify({
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        }),
        {
          status: error.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Handle unexpected errors
    logger.error("Unexpected error in PATCH /api/parties/:id/blackout", {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
```

### Krok 4: Aktualizacja dokumentacji API
**Plik:** `docs/api/parties.md` (jeśli istnieje)

**Akcje:**
- Dodaj dokumentację nowego endpointu
- Uwzględnij przykłady requestów i responses
- Opisz wszystkie error codes
- Dodaj przykłady użycia

### Krok 5: (Opcjonalne) Implementacja Postgres Function
**Plik:** `supabase/migrations/[timestamp]_add_mark_blackout_function.sql`

**Akcje:**
```sql
-- Opcjonalna implementacja jako Postgres function dla lepszej wydajności

CREATE OR REPLACE FUNCTION mark_party_blackout(
  p_party_id BIGINT,
  p_user_id UUID,
  p_blackout_marked BOOLEAN
) RETURNS JSON AS $$
DECLARE
  v_peak_bac DECIMAL(4,2);
  v_party Parties%ROWTYPE;
  v_threshold UserThresholds%ROWTYPE;
  v_result JSON;
BEGIN
  -- Fetch and validate party
  SELECT * INTO v_party FROM Parties WHERE id = p_party_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party not found' USING ERRCODE = '404  ';
  END IF;
  
  IF v_party.user_id != p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '403  ';
  END IF;
  
  IF v_party.status != 'closed' THEN
    RAISE EXCEPTION 'Party not closed' USING ERRCODE = '400-1';
  END IF;
  
  -- Get peak BAC (use cached or query)
  v_peak_bac := v_party.bac_estimate_max;
  
  IF v_peak_bac IS NULL OR v_peak_bac = 0 THEN
    SELECT MAX(calculated_bac) INTO v_peak_bac 
    FROM BACCalculations 
    WHERE party_id = p_party_id;
  END IF;
  
  IF v_peak_bac IS NULL THEN
    RAISE EXCEPTION 'No BAC calculations' USING ERRCODE = '400-2';
  END IF;
  
  -- Update party
  UPDATE Parties 
  SET blackout_marked = p_blackout_marked, 
      blackout_marked_at = NOW(), 
      updated_at = NOW()
  WHERE id = p_party_id;
  
  -- Deactivate old thresholds
  UPDATE UserThresholds 
  SET is_current = false 
  WHERE user_id = p_user_id AND is_current = true;
  
  -- Create new threshold
  INSERT INTO UserThresholds (
    user_id, 
    threshold_bac, 
    is_current, 
    reason, 
    trigger_party_id
  )
  VALUES (
    p_user_id, 
    v_peak_bac, 
    true, 
    'blackout_marked', 
    p_party_id
  )
  RETURNING * INTO v_threshold;
  
  -- Log events
  INSERT INTO Events (user_id, party_id, event_type) VALUES
    (p_user_id, p_party_id, 'blackout_marked'),
    (p_user_id, p_party_id, 'threshold_adjusted');
  
  -- Build JSON result
  v_result := json_build_object(
    'id', p_party_id,
    'blackout_marked', p_blackout_marked,
    'blackout_marked_at', NOW(),
    'new_threshold', json_build_object(
      'id', v_threshold.id,
      'user_id', v_threshold.user_id,
      'threshold_bac', v_threshold.threshold_bac,
      'is_current', v_threshold.is_current,
      'reason', v_threshold.reason,
      'trigger_party_id', v_threshold.trigger_party_id,
      'created_at', v_threshold.created_at
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN SQLSTATE '404  ' THEN
    RAISE EXCEPTION 'PARTY_NOT_FOUND: %', SQLERRM;
  WHEN SQLSTATE '403  ' THEN
    RAISE EXCEPTION 'FORBIDDEN: %', SQLERRM;
  WHEN SQLSTATE '400-1' THEN
    RAISE EXCEPTION 'PARTY_NOT_CLOSED: %', SQLERRM;
  WHEN SQLSTATE '400-2' THEN
    RAISE EXCEPTION 'NO_BAC_CALCULATIONS: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'DATABASE_ERROR: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_party_blackout(BIGINT, UUID, BOOLEAN) TO authenticated;
```

### Krok 6: Deployment checklist
- [ ] Kod przeszedł code review
- [ ] Migracje bazy danych zastosowane na staging
- [ ] RLS policies zweryfikowane
- [ ] Dokumentacja API zaktualizowana
- [ ] Error logging skonfigurowane
- [ ] Security review przeprowadzone
- [ ] Deployment na staging udany
- [ ] Deployment na production zaplanowany

## 10. Podsumowanie

Endpoint `PATCH /api/parties/:id/blackout` implementuje krytyczną funkcjonalność adaptacji progu BAC na podstawie doświadczeń użytkownika (blackout). Kluczowe aspekty implementacji:

**Bezpieczeństwo:**
- Uwierzytelnienie JWT + RLS policies
- Autoryzacja właściciela party
- Walidacja biznesowa (status, BAC calculations)

**Wydajność:**
- Wykorzystanie cached bac_estimate_max
- Indeksy na kluczowych kolumnach
- Opcjonalnie: Postgres function dla atomowości

**Niezawodność:**
- Comprehensive error handling
- Structured logging
- Event tracking dla auditingu

**Maintainability:**
- Separation of concerns (route → validation → service)
- Reusable validation schemas
- Well-typed interfaces
- Comprehensive tests

Implementacja powinna być zgodna z istniejącymi wzorcami w projekcie, szczególnie z już zaimplementowanymi endpointami w `src/pages/api/parties/`.
