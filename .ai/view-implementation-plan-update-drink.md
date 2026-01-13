# API Endpoint Implementation Plan: Update Last Drink

## 1. Przegląd punktu końcowego

Endpoint `PUT /api/parties/:partyId/drinks/:drinkId` umożliwia edycję ostatniego napoju w trwającej imprezie. Zapewnia możliwość korekty błędnie wprowadzonych danych (objętość lub zawartość alkoholu) tylko dla najnowszego napoju. Po edycji system automatycznie przelicza BAC, aktualizuje statystyki imprezy i re-ewaluuje alerty.

**Kluczowe ograniczenia:**
- Edycji podlega wyłącznie ostatni napój w imprezie (z najwyższym `order_sequence`)
- Impreza musi mieć status `ongoing`
- Przy pierwszej edycji zachowywane są oryginalne wartości dla auditingu
- System automatycznie przelicza BAC i statystyki po każdej zmianie

**User Story:** US-006 - Edycja ostatniego dodanego napoju

---

## 2. Szczegóły żądania

### Metoda HTTP
`PUT`

### Struktura URL
```
/api/parties/:partyId/drinks/:drinkId
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Parametry

#### Path Parameters (Required)
- `partyId` (bigint) - Identyfikator imprezy
- `drinkId` (bigint) - Identyfikator napoju do edycji

#### Request Body (Required)
```json
{
  "volume_ml": 500,        // integer, >0, ≤5000
  "abv_percent": 5.0       // decimal, 0.1-100.0
}
```

**Walidacja Zod Schema:**
```typescript
const UpdateDrinkParamsSchema = z.object({
  partyId: z.string().regex(/^\d+$/).transform(Number),
  drinkId: z.string().regex(/^\d+$/).transform(Number)
});

const UpdateDrinkBodySchema = z.object({
  volume_ml: z.number().int().min(1).max(5000),
  abv_percent: z.number().min(0.1).max(100)
});
```

---

## 3. Wykorzystywane typy

### Command Models (Input)
```typescript
// z types.ts
interface UpdateDrinkCommand {
  volume_ml: number;
  abv_percent: number;
}
```

### Response DTOs (Output)
```typescript
// z types.ts
interface UpdateDrinkResponseDTO {
  drink: DrinkDTO;
  bac_calculation: BACCalculationDTO;
  warnings: DrinkValidationWarning[];
  active_alerts: AlertDTO[];
}

interface DrinkDTO extends Omit<Drink, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

interface BACCalculationDTO extends Omit<BACCalculation, "user_profile_snapshot" | "created_at" | "calculation_timestamp"> {
  calculation_timestamp: string;
  created_at: string;
  user_profile_snapshot: ProfileSnapshot;
}

interface DrinkValidationWarning {
  code: string;
  message: string;
  field: string;
  value: number;
}

interface AlertDTO extends Omit<Alert, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}
```

### Database Entities
```typescript
// z database.types.ts
type Party = Tables<"parties">;
type Drink = Tables<"drinks">;
type BACCalculation = Tables<"baccalculations">;
type Alert = Tables<"alerts">;
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)
```json
{
  "drink": {
    "id": 123,
    "party_id": 456,
    "user_id": "uuid-string",
    "volume_ml": 500,
    "abv_percent": 5.0,
    "consumed_at": "2026-01-13T20:00:00Z",
    "original_values": {
      "volume_ml_before": 600,
      "abv_percent_before": 4.5
    },
    "edited_at": "2026-01-13T20:15:00Z",
    "edit_count": 1,
    "order_sequence": 3,
    "created_at": "2026-01-13T19:45:00Z",
    "updated_at": "2026-01-13T20:15:00Z"
  },
  "bac_calculation": {
    "id": 789,
    "party_id": 456,
    "user_id": "uuid-string",
    "drink_id": 123,
    "calculated_bac": 0.08,
    "calculation_timestamp": "2026-01-13T20:15:00Z",
    "algorithm_version": "Widmark v1",
    "user_profile_snapshot": {
      "height_cm": 180,
      "weight_kg": 80,
      "gender": "M",
      "captured_at": "2026-01-13T19:00:00Z"
    },
    "time_since_first_drink_minutes": 75,
    "metabolized_alcohol_g": 9.375,
    "created_at": "2026-01-13T20:15:00Z"
  },
  "warnings": [
    {
      "code": "UNREALISTIC_VOLUME",
      "message": "Volume of 2500ml is unusually large. Are you sure this is correct?",
      "field": "volume_ml",
      "value": 2500
    }
  ],
  "active_alerts": [
    {
      "id": 321,
      "party_id": 456,
      "user_id": "uuid-string",
      "alert_type": "approaching_threshold",
      "is_active": true,
      "bac_at_alert": 0.072,
      "triggered_at": "2026-01-13T20:15:00Z",
      "last_alert_sent_at": "2026-01-13T20:15:00Z",
      "created_at": "2026-01-13T20:15:00Z",
      "updated_at": "2026-01-13T20:15:00Z"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Invalid Input
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "volume_ml must be between 1 and 5000"
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
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
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```
lub
```json
{
  "error": {
    "code": "DRINK_NOT_FOUND",
    "message": "Drink not found in this party"
  }
}
```

#### 409 Conflict - Not Last Drink
```json
{
  "error": {
    "code": "NOT_LAST_DRINK",
    "message": "Only the last drink in the party can be edited. This drink has order_sequence 2, but the last drink has order_sequence 5."
  }
}
```

#### 422 Unprocessable Entity - Party Closed
```json
{
  "error": {
    "code": "PARTY_CLOSED",
    "message": "Cannot edit drinks in a closed party"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 5. Przepływ danych

### Sekwencja operacji:

```
1. Client → PUT /api/parties/:partyId/drinks/:drinkId
                ↓
2. Astro Middleware
   - Weryfikacja tokenu auth (Supabase)
   - Ustawienie supabase client w context.locals
                ↓
3. Endpoint Handler (src/pages/api/parties/[id]/drinks/[drinkId].ts)
   - Walidacja path params (Zod)
   - Walidacja request body (Zod)
                ↓
4. Service Layer (drink.service.ts::updateLastDrink)
   ┌─────────────────────────────────────────────────┐
   │ 4.1. Pobranie party z DB                        │
   │      - SELECT * FROM parties WHERE id = partyId  │
   │      - Walidacja party (validatePartyForDrink)  │
   │        • istnieje                               │
   │        • należy do user                         │
   │        • status = 'ongoing'                     │
   │                                                  │
   │ 4.2. Pobranie drink z DB                        │
   │      - SELECT * FROM drinks WHERE id = drinkId   │
   │        AND party_id = partyId                   │
   │      - Walidacja drink                          │
   │        • istnieje                               │
   │        • należy do party                        │
   │                                                  │
   │ 4.3. Walidacja czy drink jest ostatni          │
   │      - SELECT MAX(order_sequence) FROM drinks   │
   │        WHERE party_id = partyId                 │
   │      - Jeśli drink.order_sequence != max        │
   │        → return 409 Conflict                    │
   │                                                  │
   │ 4.4. Generowanie warnings                       │
   │      - checkUnrealisticVolume()                 │
   │      - (brak fast consumption - to update)      │
   │                                                  │
   │ 4.5. Przygotowanie danych do update             │
   │      IF edit_count = 0 THEN                     │
   │        original_values = {                      │
   │          volume_ml_before: current volume_ml,   │
   │          abv_percent_before: current abv_percent│
   │        }                                         │
   │      END IF                                     │
   │                                                  │
   │ 4.6. Update drink (Transaction start)           │
   │      UPDATE drinks SET                          │
   │        volume_ml = new_value,                   │
   │        abv_percent = new_value,                 │
   │        original_values = computed_value,        │
   │        edited_at = NOW(),                       │
   │        edit_count = edit_count + 1,             │
   │        updated_at = NOW()                       │
   │      WHERE id = drinkId                         │
   │                                                  │
   │ 4.7. Przeliczenie BAC                           │
   │      - Pobranie wszystkich drinks z party       │
   │        (ORDER BY consumed_at)                   │
   │      - Dla edytowanego drinka:                  │
   │        • Obliczenie BAC (calculateBAC)          │
   │        • UPDATE existing BACCalculation         │
   │                                                  │
   │ 4.8. Aktualizacja party stats                   │
   │      - Przeliczenie total_ml_consumed           │
   │      - Znalezienie max BAC                      │
   │      UPDATE parties SET                         │
   │        bac_estimate_max = new_max,              │
   │        total_ml_consumed = new_total,           │
   │        updated_at = NOW()                       │
   │      WHERE id = partyId                         │
   │                                                  │
   │ 4.9. Re-ewaluacja alerts                        │
   │      - Pobranie user threshold                  │
   │      - Sprawdzenie approaching/exceeded         │
   │      - Deaktywacja nieaktualnych alerts         │
   │      - Utworzenie nowych alerts jeśli potrzeba  │
   │                                                  │
   │ 4.10. Logging event                             │
   │       INSERT INTO events (                      │
   │         user_id, party_id,                      │
   │         event_type = 'drink_edited'             │
   │       )                                          │
   │                                                  │
   │ (Transaction commit)                            │
   └─────────────────────────────────────────────────┘
                ↓
5. Response Construction
   - Formatowanie DrinkDTO
   - Formatowanie BACCalculationDTO
   - Pobranie active alerts
   - Return UpdateDrinkResponseDTO
                ↓
6. Client ← 200 OK + JSON Response
```

### Interakcje z bazą danych:

**Read Operations:**
1. `SELECT` party by ID
2. `SELECT` drink by ID and party_id
3. `SELECT MAX(order_sequence)` from drinks for party
4. `SELECT` all drinks for party (for BAC recalculation)
5. `SELECT` user threshold
6. `SELECT` active alerts for party

**Write Operations:**
1. `UPDATE` drink (volume, abv, original_values, edited_at, edit_count)
2. `UPDATE` BAC calculation (calculated_bac, calculation_timestamp, metabolized_alcohol_g, time_since_first_drink_minutes)
3. `UPDATE` party stats (bac_estimate_max, total_ml_consumed)
4. `UPDATE` alerts (deactivate old)
5. `INSERT` new alerts if triggered
6. `INSERT` event log

**Transaction Boundary:**
- Wszystkie write operations powinny być w jednej transakcji dla zachowania spójności

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie
- **Mechanizm:** Supabase Authentication via Bearer token
- **Implementacja:** Token przekazywany w header `Authorization: Bearer {token}`
- **Walidacja:** Astro middleware weryfikuje token i ustawia `context.locals.supabase`
- **Błąd:** 401 Unauthorized jeśli token brak lub nieprawidłowy

### 6.2. Autoryzacja
- **Row Level Security (RLS):** Supabase RLS policies zapewniają że:
  - User może edytować tylko własne drinki
  - User ma dostęp tylko do własnych party
- **Application Level:** 
  - Explicit check: `party.user_id === authenticatedUserId`
  - Explicit check: drink należy do party użytkownika
- **Błąd:** 403 Forbidden jeśli user próbuje edytować cudze dane

### 6.3. Walidacja danych wejściowych

**Poziom 1 - Schema Validation (Zod):**
```typescript
- volume_ml: integer, 1-5000
- abv_percent: decimal, 0.1-100.0
- partyId: positive bigint
- drinkId: positive bigint
```

**Poziom 2 - Business Logic Validation:**
```typescript
- Party must exist (404)
- Party must belong to user (403)
- Party status must be 'ongoing' (422)
- Drink must exist (404)
- Drink must belong to party (404)
- Drink must be last in party (409)
- Updated values must not cause BAC > 0.99 (400)
```

**Poziom 3 - Non-blocking Warnings:**
```typescript
- volume_ml > 2000ml → UNREALISTIC_VOLUME warning
```

### 6.4. SQL Injection Prevention
- **Parametryzowane zapytania:** Supabase SDK automatycznie parametryzuje wszystkie queries
- **No raw SQL:** Używamy wyłącznie Supabase query builder

### 6.5. Rate Limiting
- **Implementacja:** Astro middleware (jeśli skonfigurowane)
- **Zalecenia:** 
  - 60 requests per minute per user
  - 10 requests per minute per endpoint per user

### 6.6. CSRF Protection
- **Nie dotyczy:** Supabase JWT tokens są immune to CSRF
- **Same-site cookies:** Jeśli używamy cookies dla auth

### 6.7. Data Exposure
- **Principle of Least Privilege:** Response zawiera tylko niezbędne dane
- **No sensitive data:** Nie eksponujemy internal IDs innych użytkowników
- **RLS policies:** Zabezpieczają przed data leakage

### 6.8. Concurrent Modifications
- **Problem:** Race condition gdy ten sam użytkownik wykonuje równoczesne edycje z różnych urządzeń/sesji
- **Uwaga:** Każdy drink należy do jednego użytkownika, więc nie ma problemu z edycją przez różnych użytkowników
- **Rozwiązanie:** 
  - Database transaction isolation level
  - Możliwe dodanie optimistic locking (version field)
  - Check edit_count przed update

---

## 7. Obsługa błędów

### 7.1. Błędy walidacji (400 Bad Request)

**Przyczyny:**
- `volume_ml` < 1 lub > 5000
- `abv_percent` < 0.1 lub > 100.0
- Nieprawidłowy format danych (np. string zamiast number)
- BAC przekroczyłby limit 0.99

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "volume_ml must be between 1 and 5000",
    "field": "volume_ml",
    "value": 6000
  }
}
```

**Implementacja:**
```typescript
try {
  UpdateDrinkBodySchema.parse(body);
} catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: {
        code: "VALIDATION_ERROR",
        message: error.errors[0].message,
        field: error.errors[0].path[0],
        value: error.errors[0].received
      }
    }), { status: 400 });
  }
}
```

### 7.2. Błędy uwierzytelniania (401 Unauthorized)

**Przyczyny:**
- Brak tokenu w header Authorization
- Token wygasły
- Token nieprawidłowy

**Response:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Implementacja:**
- Middleware sprawdza `context.locals.supabase.auth.getUser()`
- Jeśli nie ma usera → 401

### 7.3. Błędy autoryzacji (403 Forbidden)

**Przyczyny:**
- Party należy do innego użytkownika
- Drink należy do party innego użytkownika

**Response:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this party"
  }
}
```

**Implementacja:**
```typescript
const validation = validatePartyForDrink(party, userId);
if (!validation.valid && validation.status === 403) {
  return new Response(JSON.stringify({ error: validation.error }), { 
    status: 403 
  });
}
```

### 7.4. Błędy nie znaleziono (404 Not Found)

**Przyczyny:**
- Party o podanym ID nie istnieje
- Drink o podanym ID nie istnieje
- Drink nie należy do podanego party

**Response:**
```json
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Party not found"
  }
}
```
lub
```json
{
  "error": {
    "code": "DRINK_NOT_FOUND",
    "message": "Drink not found in this party"
  }
}
```

**Implementacja:**
```typescript
if (!party) {
  return new Response(JSON.stringify({
    error: { code: "PARTY_NOT_FOUND", message: "Party not found" }
  }), { status: 404 });
}

if (!drink) {
  return new Response(JSON.stringify({
    error: { code: "DRINK_NOT_FOUND", message: "Drink not found in this party" }
  }), { status: 404 });
}
```

### 7.5. Błędy konfliktu (409 Conflict)

**Przyczyny:**
- Drink nie jest ostatni w party (nie można edytować historycznych drinków)

**Response:**
```json
{
  "error": {
    "code": "NOT_LAST_DRINK",
    "message": "Only the last drink in the party can be edited. This drink has order_sequence 2, but the last drink has order_sequence 5."
  }
}
```

**Implementacja:**
```typescript
const { data: maxOrderData } = await supabase
  .from("drinks")
  .select("order_sequence")
  .eq("party_id", partyId)
  .order("order_sequence", { ascending: false })
  .limit(1)
  .single();

if (drink.order_sequence !== maxOrderData.order_sequence) {
  return new Response(JSON.stringify({
    error: {
      code: "NOT_LAST_DRINK",
      message: `Only the last drink in the party can be edited. This drink has order_sequence ${drink.order_sequence}, but the last drink has order_sequence ${maxOrderData.order_sequence}.`
    }
  }), { status: 409 });
}
```

### 7.6. Błędy niemożliwe do przetworzenia (422 Unprocessable Entity)

**Przyczyny:**
- Party jest zamknięte (status !== 'ongoing')

**Response:**
```json
{
  "error": {
    "code": "PARTY_CLOSED",
    "message": "Cannot edit drinks in a closed party"
  }
}
```

**Implementacja:**
```typescript
const validation = validatePartyForDrink(party, userId);
if (!validation.valid && validation.error?.code === "PARTY_CLOSED") {
  return new Response(JSON.stringify({ error: validation.error }), { 
    status: 422 
  });
}
```

### 7.7. Błędy serwera (500 Internal Server Error)

**Przyczyny:**
- Błędy bazy danych (Supabase)
- Nieobsłużone wyjątki
- Problemy z połączeniem

**Response:**
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Implementacja:**
```typescript
try {
  // ... business logic
} catch (error) {
  logError("Failed to update drink", { 
    partyId, 
    drinkId, 
    userId, 
    error: error.message 
  });
  
  return new Response(JSON.stringify({
    error: {
      code: "DATABASE_ERROR",
      message: "An unexpected error occurred"
    }
  }), { status: 500 });
}
```

### 7.8. Logging strategia

**Error Logging:**
```typescript
logError(message: string, context: object)
```
- Wszystkie błędy 500
- Wszystkie błędy bazy danych
- Nieobsłużone wyjątki

**Info Logging:**
```typescript
logInfo(message: string, context: object)
```
- Pomyślne edycje drinków
- Generowanie warnings

**Event Logging (DB):**
```typescript
INSERT INTO events (user_id, party_id, event_type)
VALUES (userId, partyId, 'drink_edited')
```
- Każda pomyślna edycja drinka

---

## 8. Rozważania dotyczące wydajności

### 8.1. Database Query Optimization

**Indeksy wymagane:**
```sql
-- Istniejące (z migracji)
CREATE INDEX idx_drinks_party_id ON drinks(party_id);
CREATE INDEX idx_drinks_user_id ON drinks(user_id);
CREATE INDEX idx_drinks_order_sequence ON drinks(party_id, order_sequence);

-- Do dodania (jeśli nie istnieją)
CREATE INDEX idx_baccalculations_drink_id ON baccalculations(drink_id);
CREATE INDEX idx_alerts_party_active ON alerts(party_id, is_active);
```

**Query patterns:**
- Use `maybeSingle()` zamiast `single()` dla optional results
- Use `select('*')` tylko gdy potrzebne wszystkie pola
- Batch queries gdzie możliwe

### 8.2. Transaction Management

**Single Transaction Scope:**
```typescript
// Wszystkie write operations w jednej transakcji:
BEGIN TRANSACTION
  1. UPDATE drink
  2. UPDATE BAC calculation
  3. UPDATE party stats
  4. UPDATE/INSERT alerts
  5. INSERT event log
COMMIT
```

**Isolation Level:**
- `READ COMMITTED` (default Postgres) - sufficient for this use case
- Consider `REPEATABLE READ` if concurrent edits are frequent

### 8.3. Caching Strategy

**User Threshold:**
```typescript
// Cache threshold in memory for 5 minutes
const thresholdCache = new Map<string, { value: number, timestamp: number }>();
```

**Party Data:**
- No caching needed - always fresh data required
- BAC calculations must be real-time

### 8.4. Response Size Optimization

**Minimize payload:**
- Return tylko active alerts (not all alerts)
- Return tylko updated drink (not all drinks)
- Use projection in SELECT queries

**Estimated response size:**
- Average: ~1-2 KB
- Max: ~5 KB (with multiple alerts)

### 8.5. Bottleneck Mitigation

**Potential bottlenecks:**
1. **BAC recalculation** - only one drink to recalculate (last one)
2. **Party stats update** - simple aggregation
3. **Alert re-evaluation** - check only current BAC against threshold

**Optimization strategies:**
- Use database triggers for auto-updating party stats
- Denormalize total_drinks_count and total_ml_consumed
- Use materialized views for complex aggregations (future)

### 8.6. Concurrent Request Handling

**Race conditions:**
- Problem: Ten sam użytkownik wykonuje równoczesne edycje z różnych urządzeń/sesji (np. podwójne kliknięcie, dwie otwarte karty przeglądarki)
- Uwaga: Każdy drink należy tylko do jednego użytkownika, więc nie ma ryzyka konfliktu między różnymi użytkownikami
- Solution: Database transaction + row-level locking
- Mitigation: Check `edit_count` before update

```typescript
UPDATE drinks 
SET volume_ml = $1, 
    abv_percent = $2,
    edit_count = edit_count + 1,
    edited_at = NOW()
WHERE id = $3 
  AND edit_count = $4  -- Optimistic locking
RETURNING *;
```

### 8.7. Monitoring Metrics

**Key metrics to track:**
- Average response time (target: <500ms)
- P95 response time (target: <1000ms)
- Error rate (target: <1%)
- Database query time
- Transaction commit time

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie walidacji Zod
**Plik:** `src/lib/validation/drink.validation.ts`

```typescript
// Dodać do istniejącego pliku:
export const UpdateDrinkParamsSchema = z.object({
  partyId: z.string().regex(/^\d+$/, "Party ID must be a number").transform(Number),
  drinkId: z.string().regex(/^\d+$/, "Drink ID must be a number").transform(Number)
});

export const UpdateDrinkBodySchema = z.object({
  volume_ml: z.number()
    .int("volume_ml must be an integer")
    .min(1, "volume_ml must be at least 1")
    .max(5000, "volume_ml must be at most 5000"),
  abv_percent: z.number()
    .min(0.1, "abv_percent must be at least 0.1")
    .max(100, "abv_percent must be at most 100")
});
```

**Test:**
- Walidacja poprawnych wartości
- Walidacja wartości poza zakresem
- Walidacja nieprawidłowych typów

---

### Krok 2: Implementacja funkcji service layer
**Plik:** `src/lib/services/drink.service.ts`

**2.1. Funkcja pomocnicza - sprawdzenie czy drink jest ostatni:**
```typescript
export async function validateDrinkIsLast(
  supabase: SupabaseClient,
  partyId: number,
  drinkId: number,
  currentOrderSequence: number
): Promise<{ valid: boolean; error?: { code: string; message: string } }> {
  const { data: maxOrderData, error } = await supabase
    .from("drinks")
    .select("order_sequence")
    .eq("party_id", partyId)
    .order("order_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logError("Failed to get max order_sequence", { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  if (!maxOrderData || currentOrderSequence !== maxOrderData.order_sequence) {
    return {
      valid: false,
      error: {
        code: "NOT_LAST_DRINK",
        message: `Only the last drink in the party can be edited. This drink has order_sequence ${currentOrderSequence}, but the last drink has order_sequence ${maxOrderData?.order_sequence || "unknown"}.`
      }
    };
  }

  return { valid: true };
}
```

**2.2. Główna funkcja updateLastDrink:**
```typescript
export async function updateLastDrink(
  supabase: SupabaseClient,
  partyId: number,
  drinkId: number,
  userId: string,
  command: UpdateDrinkCommand
): Promise<UpdateDrinkResponseDTO> {
  // 1. Get and validate party
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("*")
    .eq("id", partyId)
    .maybeSingle();

  if (partyError) {
    logError("Failed to get party", { partyId, error: partyError.message });
    throw new Error(`Database error: ${partyError.message}`);
  }

  const partyValidation = validatePartyForDrink(party, userId);
  if (!partyValidation.valid) {
    throw {
      status: partyValidation.status,
      error: partyValidation.error
    };
  }

  // 2. Get drink
  const { data: drink, error: drinkError } = await supabase
    .from("drinks")
    .select("*")
    .eq("id", drinkId)
    .eq("party_id", partyId)
    .maybeSingle();

  if (drinkError) {
    logError("Failed to get drink", { drinkId, partyId, error: drinkError.message });
    throw new Error(`Database error: ${drinkError.message}`);
  }

  if (!drink) {
    throw {
      status: 404,
      error: {
        code: "DRINK_NOT_FOUND",
        message: "Drink not found in this party"
      }
    };
  }

  // 3. Validate drink is last
  const lastDrinkValidation = await validateDrinkIsLast(
    supabase,
    partyId,
    drinkId,
    drink.order_sequence
  );

  if (!lastDrinkValidation.valid) {
    throw {
      status: 409,
      error: lastDrinkValidation.error
    };
  }

  // 4. Generate warnings
  const warnings: DrinkValidationWarning[] = [];
  const volumeWarning = checkUnrealisticVolume(command.volume_ml);
  if (volumeWarning) {
    warnings.push(volumeWarning);
  }

  // 5. Prepare original_values if first edit
  let originalValues: Json | null = drink.original_values;
  if (drink.edit_count === 0) {
    originalValues = {
      volume_ml_before: drink.volume_ml,
      abv_percent_before: drink.abv_percent
    };
  }

  // 6. Update drink
  const { data: updatedDrink, error: updateError } = await supabase
    .from("drinks")
    .update({
      volume_ml: command.volume_ml,
      abv_percent: command.abv_percent,
      original_values: originalValues,
      edited_at: new Date().toISOString(),
      edit_count: drink.edit_count + 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", drinkId)
    .select()
    .single();

  if (updateError) {
    logError("Failed to update drink", { drinkId, error: updateError.message });
    throw new Error(`Database error: ${updateError.message}`);
  }

  // 7. Recalculate BAC for this drink
  const profileSnapshot = party.profile_snapshot as ProfileSnapshot;
  
  // Get all drinks for party to calculate cumulative alcohol
  const { data: allDrinks, error: allDrinksError } = await supabase
    .from("drinks")
    .select("*")
    .eq("party_id", partyId)
    .order("consumed_at", { ascending: true });

  if (allDrinksError) {
    logError("Failed to get all drinks", { partyId, error: allDrinksError.message });
    throw new Error(`Database error: ${allDrinksError.message}`);
  }

  // Calculate cumulative alcohol up to this drink
  let cumulativeAlcohol = 0;
  const drinkIndex = allDrinks.findIndex(d => d.id === drinkId);
  
  for (let i = 0; i <= drinkIndex; i++) {
    const d = allDrinks[i];
    cumulativeAlcohol += calculateAlcoholGrams(d.volume_ml, d.abv_percent);
  }

  // Calculate time elapsed from party start
  const consumedAt = new Date(updatedDrink.consumed_at);
  const startedAt = new Date(party.started_at);
  const timeElapsedMinutes = (consumedAt.getTime() - startedAt.getTime()) / (1000 * 60);
  const timeElapsedHours = timeElapsedMinutes / 60;

  // Calculate BAC
  const calculatedBAC = calculateBAC(
    cumulativeAlcohol,
    profileSnapshot,
    timeElapsedHours
  );

  const metabolizedAlcohol = timeElapsedHours * DEFAULT_METABOLIZATION_RATE;

  // Update existing BAC calculation
  const { data: bacCalculation, error: bacError } = await supabase
    .from("baccalculations")
    .update({
      calculated_bac: calculatedBAC,
      calculation_timestamp: new Date().toISOString(),
      time_since_first_drink_minutes: Math.round(timeElapsedMinutes),
      metabolized_alcohol_g: metabolizedAlcohol
    })
    .eq("drink_id", drinkId)
    .select()
    .single();

  if (bacError) {
    logError("Failed to update BAC calculation", { drinkId, error: bacError.message });
    throw new Error(`Database error: ${bacError.message}`);
  }

  // 8. Update party statistics
  const totalMlConsumed = allDrinks.reduce((sum, d) => {
    return sum + (d.id === drinkId ? updatedDrink.volume_ml : d.volume_ml);
  }, 0);

  // Get max BAC from all calculations
  const { data: maxBacData } = await supabase
    .from("baccalculations")
    .select("calculated_bac")
    .eq("party_id", partyId)
    .order("calculated_bac", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("parties")
    .update({
      bac_estimate_max: maxBacData?.calculated_bac || calculatedBAC,
      total_ml_consumed: totalMlConsumed,
      updated_at: new Date().toISOString()
    })
    .eq("id", partyId);

  // 9. Re-evaluate alerts
  const userThreshold = await getUserThreshold(supabase, userId);
  const approachingThreshold = userThreshold * APPROACHING_THRESHOLD_MULTIPLIER;

  // Deactivate old alerts
  await supabase
    .from("alerts")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("is_active", true);

  // Create new alerts if needed
  const activeAlerts: Alert[] = [];
  
  if (calculatedBAC >= userThreshold) {
    const { data: alert } = await supabase
      .from("alerts")
      .insert({
        party_id: partyId,
        user_id: userId,
        alert_type: "exceeded_threshold",
        is_active: true,
        bac_at_alert: calculatedBAC,
        triggered_at: new Date().toISOString(),
        last_alert_sent_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (alert) activeAlerts.push(alert);
  } else if (calculatedBAC >= approachingThreshold) {
    const { data: alert } = await supabase
      .from("alerts")
      .insert({
        party_id: partyId,
        user_id: userId,
        alert_type: "approaching_threshold",
        is_active: true,
        bac_at_alert: calculatedBAC,
        triggered_at: new Date().toISOString(),
        last_alert_sent_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (alert) activeAlerts.push(alert);
  }

  // 10. Log event
  await logEvent(supabase, {
    user_id: userId,
    party_id: partyId,
    event_type: "drink_edited"
  });

  // 11. Format response
  return {
    drink: {
      ...updatedDrink,
      created_at: updatedDrink.created_at,
      updated_at: updatedDrink.updated_at
    },
    bac_calculation: {
      ...bacCalculation,
      calculation_timestamp: bacCalculation.calculation_timestamp,
      created_at: bacCalculation.created_at,
      user_profile_snapshot: bacCalculation.user_profile_snapshot as ProfileSnapshot
    },
    warnings,
    active_alerts: activeAlerts.map(alert => ({
      ...alert,
      created_at: alert.created_at,
      updated_at: alert.updated_at
    }))
  };
}
```

**Test:**
- Update ostatniego drinka
- Sprawdzenie zachowania original_values
- Sprawdzenie increment edit_count
- Sprawdzenie przeliczenia BAC
- Sprawdzenie update party stats
- Sprawdzenie re-ewaluacji alerts

---

### Krok 3: Utworzenie endpoint handler
**Plik:** `src/pages/api/parties/[id]/drinks/[drinkId].ts`

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { UpdateDrinkParamsSchema, UpdateDrinkBodySchema } from "../../../../lib/validation/drink.validation";
import { updateLastDrink } from "../../../../lib/services/drink.service";
import { logError, logInfo } from "../../../../lib/logger";

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Auth check
    const supabase = locals.supabase;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required"
        }
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Validate path params
    let partyId: number;
    let drinkId: number;
    
    try {
      const validatedParams = UpdateDrinkParamsSchema.parse({
        partyId: params.id,
        drinkId: params.drinkId
      });
      partyId = validatedParams.partyId;
      drinkId = validatedParams.drinkId;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors[0].message,
            field: error.errors[0].path[0],
            value: error.errors[0].input
          }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw error;
    }

    // 3. Validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON"
        }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let command: z.infer<typeof UpdateDrinkBodySchema>;
    try {
      command = UpdateDrinkBodySchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors[0].message,
            field: error.errors[0].path[0],
            value: body[error.errors[0].path[0]]
          }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw error;
    }

    // 4. Call service layer
    const result = await updateLastDrink(
      supabase,
      partyId,
      drinkId,
      user.id,
      command
    );

    logInfo("Drink updated successfully", {
      userId: user.id,
      partyId,
      drinkId,
      newBAC: result.bac_calculation.calculated_bac
    });

    // 5. Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    // Handle service layer errors
    if (error.status && error.error) {
      return new Response(JSON.stringify({ error: error.error }), {
        status: error.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle unexpected errors
    logError("Unexpected error in update drink endpoint", {
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
```

**Test:**
- PUT request z poprawnymi danymi
- Sprawdzenie wszystkich error cases (400, 401, 403, 404, 409, 422)
- Sprawdzenie response structure

---

### Krok 5: Dokumentacja i finalizacja

**5.1. Aktualizacja API documentation**
- Dodać endpoint do API docs
- Dodać przykłady request/response
- Dodać error codes

**5.2. Aktualizacja CHANGELOG**
- Dodać entry dla nowej funkcjonalności

**5.3. Code review checklist:**
- [ ] Walidacja Zod działa poprawnie
- [ ] Service layer handler errors properly
- [ ] Endpoint zwraca poprawne status codes
- [ ] RLS policies działają
- [ ] Logging jest odpowiedni
- [ ] Performance jest akceptowalna
- [ ] Documentation jest kompletna

**5.4. Deploy checklist:**
- [ ] Database migrations applied (jeśli potrzebne nowe indeksy)
- [ ] Environment variables set
- [ ] Monitoring alerts configured
- [ ] Rate limiting configured

---

## 10. Podsumowanie

Endpoint `PUT /api/parties/:partyId/drinks/:drinkId` umożliwia edycję ostatniego napoju w trwającej imprezie z pełną walidacją, przeliczeniem BAC i aktualizacją statystyk. Implementacja składa się z:

1. **Walidacji wielopoziomowej:** Zod schema → Business logic → Database constraints
2. **Service layer:** Funkcja `updateLastDrink()` w `drink.service.ts`
3. **Endpoint handler:** `PUT` handler w `src/pages/api/parties/[id]/drinks/[drinkId].ts`
4. **Bezpieczeństwo:** Uwierzytelnianie + Autoryzacja + RLS
5. **Obsługa błędów:** Comprehensive error handling z appropriate status codes
6. **Performance:** Database transaction + optimized queries + caching strategy

**Szacowany czas implementacji:** 4-6 godzin
**Złożoność:** Średnia (wykorzystuje istniejące funkcje service layer)
