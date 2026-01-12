# API Endpoint Implementation Plan: GET /api/parties/:id

## 1. Przegląd punktu końcowego

Endpoint `GET /api/parties/:id` służy do pobierania szczegółowych informacji o konkretnej sesji imprezowej użytkownika. Zwraca kompletne dane imprezy wraz z:
- Wszystkimi napojami uporządkowanymi chronologicznie
- Obliczeniami BAC dla każdego napoju
- Bieżącym poziomem BAC (dla trwających imprez)
- Aktywnymi alertami
- Aktualnym progiem BAC użytkownika
- Snapshot profilu użytkownika z momentu rozpoczęcia imprezy

Ten endpoint odpowiada za User Story US-009 (przeglądanie historii imprez) i jest kluczowy dla wyświetlania szczegółowego widoku pojedynczej imprezy w aplikacji.

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/parties/:id
```

### Parametry

#### Parametry ścieżki (wymagane):
- **id** (bigint/number): Identyfikator imprezy do pobrania
  - Musi być dodatnią liczbą całkowitą
  - Walidacja: `id > 0`

#### Nagłówki (wymagane):
- **Authorization**: `Bearer {access_token}`
  - Token JWT z Supabase Auth
  - Musi być aktywny i nie wygasły

#### Parametry query (opcjonalne):
Brak - endpoint nie przyjmuje parametrów query

#### Request Body
Nie dotyczy - endpoint GET nie przyjmuje body

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects) z `src/types.ts`

Endpoint wykorzystuje następujące typy zdefiniowane w `src/types.ts`:

**Główne DTOs:**
- `PartyDetailDTO` - główny DTO odpowiedzi (extends `PartyDTO` z dodatkowymi polami: `drinks`, `current_bac`, `active_alerts`)
- `PartyDTO` - podstawowe dane imprezy
- `DrinkWithBACDTO` - napój z powiązanym obliczeniem BAC
- `DrinkDTO` - podstawowe dane napoju
- `BACCalculationDTO` - obliczenie BAC dla napoju
- `AlertDTO` - dane alertu
- `ProfileSnapshot` - snapshot profilu użytkownika

**Typy pomocnicze:**
- `PartyStatus` - `"ongoing" | "closed"`
- `AlertType` - `"approaching_threshold" | "exceeded_threshold"`
- `Gender` - `"M" | "F"`

**Uwaga:** Wszystkie powyższe typy są już zdefiniowane w `src/types.ts` zgodnie z dokumentacją API. Jeśli którykolwiek z typów brakuje, należy go dodać zgodnie z [api-plan.md](.ai/api-plan.md).

### Validation Schemas (Zod)

```typescript
// Walidacja parametru ścieżki
const PartyIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
```

### Types używane wewnętrznie

```typescript
type PartyStatus = "ongoing" | "closed";
type AlertType = "approaching_threshold" | "exceeded_threshold";
type Gender = "M" | "F";
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "id": 42,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2026-01-12T18:30:00.000Z",
  "ended_at": "2026-01-12T23:45:00.000Z",
  "status": "closed",
  "profile_snapshot": {
    "height_cm": 180,
    "weight_kg": 75.5,
    "gender": "M",
    "captured_at": "2026-01-12T18:30:00.000Z"
  },
  "bac_estimate_max": 0.15,
  "total_drinks_count": 5,
  "total_ml_consumed": 2500,
  "blackout_marked": false,
  "blackout_marked_at": null,
  "created_at": "2026-01-12T18:30:00.000Z",
  "updated_at": "2026-01-12T23:45:00.000Z",
  "drinks": [
    {
      "id": 101,
      "party_id": 42,
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "volume_ml": 500,
      "abv_percent": 5.0,
      "consumed_at": "2026-01-12T18:35:00.000Z",
      "original_values": null,
      "edited_at": null,
      "edit_count": 0,
      "order_sequence": 1,
      "created_at": "2026-01-12T18:35:00.000Z",
      "updated_at": "2026-01-12T18:35:00.000Z",
      "bac_calculation": {
        "id": 201,
        "party_id": 42,
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "drink_id": 101,
        "calculated_bac": 0.03,
        "calculation_timestamp": "2026-01-12T18:35:00.000Z",
        "algorithm_version": "Widmark v1",
        "user_profile_snapshot": {
          "height_cm": 180,
          "weight_kg": 75.5,
          "gender": "M",
          "captured_at": "2026-01-12T18:30:00.000Z"
        },
        "time_since_first_drink_minutes": 5,
        "metabolized_alcohol_g": 0.0,
        "created_at": "2026-01-12T18:35:00.000Z"
      }
    }
  ],
  "current_bac": {
    "id": 205,
    "party_id": 42,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "drink_id": 105,
    "calculated_bac": 0.15,
    "calculation_timestamp": "2026-01-12T23:30:00.000Z",
    "algorithm_version": "Widmark v1",
    "user_profile_snapshot": {
      "height_cm": 180,
      "weight_kg": 75.5,
      "gender": "M",
      "captured_at": "2026-01-12T18:30:00.000Z"
    },
    "time_since_first_drink_minutes": 295,
    "metabolized_alcohol_g": 12.5,
    "created_at": "2026-01-12T23:30:00.000Z"
  },
  "active_alerts": [
    {
      "id": 301,
      "party_id": 42,
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "alert_type": "exceeded_threshold",
      "is_active": true,
      "bac_at_alert": 0.13,
      "triggered_at": "2026-01-12T22:15:00.000Z",
      "last_alert_sent_at": "2026-01-12T22:15:00.000Z",
      "created_at": "2026-01-12T22:15:00.000Z",
      "updated_at": "2026-01-12T22:15:00.000Z"
    }
  ]
}
```

### Błąd walidacji (400 Bad Request)

```json
{
  "error": "INVALID_PARTY_ID",
  "message": "Party ID must be a positive integer",
  "details": {
    "field": "id",
    "value": "-5"
  }
}
```

### Nieautoryzowany (401 Unauthorized)

```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid authentication token"
}
```

### Brak dostępu (403 Forbidden)

```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this party"
}
```

### Nie znaleziono (404 Not Found)

```json
{
  "error": "PARTY_NOT_FOUND",
  "message": "Party with ID 42 does not exist"
}
```

### Błąd serwera (500 Internal Server Error)

```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred while fetching party details",
  "details": "Database query failed"
}
```

## 5. Przepływ danych

### Diagram przepływu

```
1. Request → Astro API Endpoint
   ↓
2. Middleware → Walidacja Auth Token (Supabase)
   ↓
3. Endpoint Handler → Walidacja parametru :id (Zod)
   ↓
4. Service Layer → getPartyDetails(supabase, userId, partyId)
   ↓
5. Database Queries (Supabase):
   a. Fetch party by ID
   b. Verify party.user_id === userId (autoryzacja)
   c. Fetch all drinks for party (ordered by consumed_at)
   d. Fetch BAC calculations for each drink
   e. Fetch active alerts (where is_active = true)
   f. Get most recent BAC calculation (current_bac)
   ↓
6. Data Transformation → Konwersja do PartyDetailDTO
   ↓
7. Response → JSON 200 OK
```

### Szczegółowy przepływ w Service Layer

```typescript
async function getPartyDetails(
  supabase: SupabaseClient,
  userId: string,
  partyId: number
): Promise<PartyDetailDTO> {
  
  // Krok 1: Pobierz imprezę
  const party = await fetchParty(supabase, partyId);
  
  if (!party) {
    throw new Error("PARTY_NOT_FOUND");
  }
  
  // Krok 2: Weryfikacja własności
  if (party.user_id !== userId) {
    throw new Error("PARTY_FORBIDDEN");
  }
  
  // Krok 3: Pobierz napoje z BAC (w jednym query używając join)
  const drinksWithBAC = await fetchDrinksWithBAC(supabase, partyId);
  
  // Krok 4: Pobierz aktywe alerty
  const activeAlerts = await fetchActiveAlerts(supabase, partyId);
  
  // Krok 5: Znajdź najnowsze obliczenie BAC
  const currentBAC = findLatestBACCalculation(drinksWithBAC);
  
  // Krok 6: Złóż response DTO
  return assemblePartyDetailDTO(
    party,
    drinksWithBAC,
    currentBAC,
    activeAlerts
  );
}
```

### Interakcje z bazą danych

#### Query 1: Fetch Party
```sql
SELECT * FROM parties WHERE id = $1
```

#### Query 2: Fetch Drinks with BAC Calculations
```sql
SELECT 
  d.*,
  b.id as bac_id,
  b.calculated_bac,
  b.calculation_timestamp,
  b.algorithm_version,
  b.user_profile_snapshot,
  b.time_since_first_drink_minutes,
  b.metabolized_alcohol_g,
  b.created_at as bac_created_at
FROM drinks d
LEFT JOIN baccalculations b ON b.drink_id = d.id
WHERE d.party_id = $1
ORDER BY d.consumed_at ASC
```

#### Query 3: Fetch Active Alerts
```sql
SELECT * FROM alerts 
WHERE party_id = $1 AND is_active = true
ORDER BY triggered_at DESC
```

### Optymalizacja zapytań

Można rozważyć optymalizację poprzez wykonanie wszystkich zapytań równolegle:

```typescript
const [party, drinksWithBAC, activeAlerts] = await Promise.all([
  fetchParty(supabase, partyId),
  fetchDrinksWithBAC(supabase, partyId),
  fetchActiveAlerts(supabase, partyId)
]);
```

Jednak należy najpierw sprawdzić czy party istnieje i czy użytkownik ma do niego dostęp, zanim wykonamy pozostałe zapytania (optymalizacja dla scenariuszy błędów).

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)

1. **Token JWT validation**:
   - Middleware Astro weryfikuje token z Supabase Auth
   - Token musi być obecny w nagłówku `Authorization: Bearer {token}`
   - Token musi być aktywny (nie wygasły)
   - Middleware przypisuje `context.locals.supabase` i `context.locals.user`

2. **Implementacja w middleware**:
```typescript
// src/middleware/index.ts
export const onRequest = async (context, next) => {
  const supabase = createSupabaseClient(
    context.request.headers.get('authorization')
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  context.locals.supabase = supabase;
  context.locals.user = user;
  
  return next();
};
```

### Autoryzacja (Authorization)

1. **Weryfikacja własności zasobu**:
   - Po pobraniu party z bazy, sprawdź czy `party.user_id === context.locals.user.id`
   - Jeśli nie pasuje → zwróć 403 Forbidden
   - Nie ujawniaj informacji o istnieniu party (użyj generycznego komunikatu)

2. **Row Level Security (RLS)**:
   - Polityki RLS w Supabase automatycznie filtrują wyniki
   - Dodatkowa warstwa obrony przed nieautoryzowanym dostępem
   - Polityka dla parties: `user_id = auth.uid()`

### Walidacja danych wejściowych

1. **Walidacja parametru :id**:
```typescript
const PartyIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// W endpoint handler:
const validation = PartyIdParamSchema.safeParse({ id: params.id });
if (!validation.success) {
  return new Response(
    JSON.stringify({
      error: 'INVALID_PARTY_ID',
      message: 'Party ID must be a positive integer',
      details: validation.error.issues
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
```

2. **SQL Injection prevention**:
   - Używamy Supabase SDK, które automatycznie parametryzuje zapytania
   - Nie konstruujemy surowego SQL z input użytkownika

### Bezpieczeństwo danych

1. **Dane wrażliwe**:
   - Endpoint zwraca tylko dane użytkownika (po weryfikacji właściciela)
   - Profile snapshot nie zawiera danych osobowych poza parametrami fizycznymi
   - user_id jest UUID (nie ujawnia informacji o liczbie użytkowników)

2. **Rate limiting**:
   - Rozważyć implementację rate limiting na poziomie middleware
   - Supabase może mieć własne limity (sprawdzić w konfiguracji)
   - W przyszłości: Redis dla distributed rate limiting

### Nagłówki bezpieczeństwa

```typescript
const securityHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};
```

## 7. Obsługa błędów

### Hierarchia sprawdzania błędów (w kolejności)

1. **Walidacja parametru (400)**
2. **Uwierzytelnienie (401)** 
3. **Sprawdzenie istnienia (404)**
4. **Autoryzacja (403)**
5. **Błędy bazy danych (500)**

### Szczegółowe scenariusze błędów

#### 1. Nieprawidłowy parametr ID (400 Bad Request)

**Warunki:**
- `id` nie jest liczbą: `/api/parties/abc`
- `id` jest ujemne lub zero: `/api/parties/-5` lub `/api/parties/0`
- `id` jest float: `/api/parties/42.5`

**Odpowiedź:**
```json
{
  "error": "INVALID_PARTY_ID",
  "message": "Party ID must be a positive integer",
  "details": {
    "field": "id",
    "value": "abc",
    "expected": "positive integer"
  }
}
```

**Implementacja:**
```typescript
const validation = PartyIdParamSchema.safeParse({ id: params.id });
if (!validation.success) {
  logInfo('Invalid party ID parameter', { 
    partyId: params.id, 
    errors: validation.error.issues 
  });
  
  return new Response(
    JSON.stringify({
      error: 'INVALID_PARTY_ID',
      message: 'Party ID must be a positive integer',
      details: validation.error.issues[0]
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
```

#### 2. Brak tokenu lub nieprawidłowy token (401 Unauthorized)

**Warunki:**
- Brak nagłówka `Authorization`
- Token wygasły
- Token nieprawidłowy
- Token anulowany

**Odpowiedź:**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid authentication token"
}
```

**Implementacja:**
Obsługiwane w middleware - jeśli `context.locals.user` jest null, znaczy że middleware już zwróciło 401.

#### 3. Impreza nie istnieje (404 Not Found)

**Warunki:**
- Party z danym ID nie istnieje w bazie
- Party zostało usunięte (soft delete w przyszłości)

**Odpowiedź:**
```json
{
  "error": "PARTY_NOT_FOUND",
  "message": "Party with the specified ID does not exist"
}
```

**Uwaga:** Nie ujawniamy szczegółów czy party istnieje ale należy do innego użytkownika - zawsze zwracamy 404 w obu przypadkach (security by obscurity).

**Implementacja:**
```typescript
const party = await fetchParty(supabase, partyId);

if (!party) {
  logInfo('Party not found', { partyId, userId });
  
  return new Response(
    JSON.stringify({
      error: 'PARTY_NOT_FOUND',
      message: 'Party with the specified ID does not exist'
    }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
```

#### 4. Brak dostępu do imprezy (403 Forbidden)

**Warunki:**
- Party istnieje ale `party.user_id !== authenticated_user_id`
- Użytkownik próbuje uzyskać dostęp do imprezy innego użytkownika

**Odpowiedź:**
```json
{
  "error": "PARTY_FORBIDDEN",
  "message": "You do not have permission to access this party"
}
```

**Implementacja:**
```typescript
if (party.user_id !== userId) {
  logInfo('Unauthorized party access attempt', { 
    partyId, 
    partyUserId: party.user_id, 
    requestingUserId: userId 
  });
  
  return new Response(
    JSON.stringify({
      error: 'PARTY_FORBIDDEN',
      message: 'You do not have permission to access this party'
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Alternatywa:** Zwracać 404 zamiast 403 aby nie ujawniać istnienia party (lepsze bezpieczeństwo):
```typescript
if (party.user_id !== userId) {
  // Loguj jako security event
  logInfo('Unauthorized party access attempt', { 
    partyId, 
    requestingUserId: userId 
  });
  
  // Zwróć 404 zamiast 403 (security by obscurity)
  return new Response(
    JSON.stringify({
      error: 'PARTY_NOT_FOUND',
      message: 'Party with the specified ID does not exist'
    }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
```

#### 5. Błąd bazy danych (500 Internal Server Error)

**Warunki:**
- Błąd połączenia z bazą danych
- Timeout zapytania
- Constraint violation (nie powinno się zdarzyć przy GET)
- Nieoczekiwany błąd podczas przetwarzania

**Odpowiedź:**
```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred while fetching party details"
}
```

**Implementacja:**
```typescript
try {
  const partyDetails = await getPartyDetails(
    supabase,
    userId,
    partyId
  );
  
  return new Response(
    JSON.stringify(partyDetails),
    { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
} catch (error) {
  logError('Failed to fetch party details', {
    partyId,
    userId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  
  // Nie ujawniaj szczegółów błędu użytkownikowi
  return new Response(
    JSON.stringify({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while fetching party details'
    }),
    { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}
```

### Logging strategia

```typescript
// Success
logInfo('Party details fetched successfully', { 
  partyId, 
  userId, 
  drinksCount: drinks.length,
  hasActiveAlerts: activeAlerts.length > 0
});

// Validation errors (400)
logInfo('Invalid party ID', { partyId: params.id, userId });

// Not found (404)
logInfo('Party not found', { partyId, userId });

// Forbidden (403) - jako security event
logInfo('Unauthorized party access attempt', { 
  partyId, 
  requestingUserId: userId 
});

// Server errors (500)
logError('Database query failed', { 
  partyId, 
  userId, 
  error: error.message,
  query: 'fetchPartyDetails'
});
```

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

1. **Wiele zapytań do bazy danych**:
   - Zapytanie o party
   - Zapytanie o drinks
   - Zapytanie o baccalculations (jeśli osobno)
   - Zapytanie o alerts
   - **Optymalizacja:** Użyj JOIN lub Supabase select z zagnieżdżonymi relacjami

2. **Duża liczba napojów**:
   - Impreza może mieć dziesiątki lub setki napojów (unlikely, ale możliwe)
   - **Optymalizacja:** Brak paginacji dla drinks (nie jest w wymaganiach), ale monitorować rozmiar response

3. **JSON parsing profile_snapshot**:
   - JSONB w PostgreSQL jest efektywny, ale wciąż wymaga parsowania
   - **Optymalizacja:** Cache na poziomie aplikacji (jeśli potrzeba)

4. **Timestamp conversions**:
   - Każde pole timestamp wymaga konwersji do ISO string
   - **Optymalizacja:** Bulk conversion, unikać pojedynczych konwersji

### Strategie optymalizacji

#### 1. Użyj Supabase select z zagnieżdżonymi relacjami

```typescript
const { data: party, error } = await supabase
  .from('parties')
  .select(`
    *,
    drinks:drinks(
      *,
      bac_calculation:baccalculations(*)
    ),
    active_alerts:alerts!inner(*)
  `)
  .eq('id', partyId)
  .eq('active_alerts.is_active', true)
  .order('drinks.consumed_at', { ascending: true })
  .single();
```

**Zalety:**
- Jeden round-trip do bazy danych
- Automatyczne JOIN przez Supabase
- Mniej kodu do zarządzania

**Wady:**
- Bardziej skomplikowane zapytanie
- Trudniejsze debugowanie
- Potencjalnie większy transfer danych (jeśli są duplikaty)

#### 2. Parallel queries (jeśli nie używamy nested select)

```typescript
const [party, drinksWithBAC, activeAlerts] = await Promise.all([
  supabase.from('parties').select('*').eq('id', partyId).single(),
  supabase
    .from('drinks')
    .select('*, baccalculations(*)')
    .eq('party_id', partyId)
    .order('consumed_at', { ascending: true }),
  supabase
    .from('alerts')
    .select('*')
    .eq('party_id', partyId)
    .eq('is_active', true)
]);
```

**Zalety:**
- Równoległe wykonanie (szybsze niż sequential)
- Łatwiejsze do debugowania
- Mniejszy response size

**Wady:**
- Multiple round-trips (jeśli network latency jest wysoka)

**Rekomendacja:** Użyj podejścia z nested select dla maksymalnej wydajności.

#### 3. Indeksy bazy danych

Upewnij się, że istnieją następujące indeksy (powinny być w migrations):

```sql
-- Indeks dla party lookup
CREATE INDEX idx_parties_id ON parties(id);

-- Indeks dla drinks by party
CREATE INDEX idx_drinks_party_id ON drinks(party_id);
CREATE INDEX idx_drinks_consumed_at ON drinks(consumed_at);

-- Indeks dla BAC calculations
CREATE INDEX idx_baccalculations_drink_id ON baccalculations(drink_id);

-- Indeks dla active alerts
CREATE INDEX idx_alerts_party_active ON alerts(party_id, is_active);
```

#### 4. Response size optimization

```typescript
// Zamiast zwracać pełne snapshots dla każdego BAC calculation,
// można je pominąć jeśli są identyczne:
interface OptimizedBACCalculationDTO {
  // ... inne pola
  // user_profile_snapshot: omit if same as party.profile_snapshot
}
```

**Uwaga:** Nie implementować tej optymalizacji na początku - tylko jeśli response size stanie się problemem.

#### 5. Caching strategy (przyszłość)

Dla closed parties (status = 'closed'):
- Response nigdy się nie zmieni (immutable)
- Można cache'ować na poziomie CDN lub Redis
- Cache key: `party_detail:${partyId}`
- TTL: Infinite (lub bardzo długi, np. 30 dni)

```typescript
// Pseudo-code dla przyszłej implementacji
if (party.status === 'closed') {
  const cached = await redis.get(`party_detail:${partyId}`);
  if (cached) {
    return JSON.parse(cached);
  }
}

// ... fetch from DB

if (party.status === 'closed') {
  await redis.set(`party_detail:${partyId}`, JSON.stringify(result));
}
```

#### 6. Monitoring wydajności

```typescript
// Dodać timing metrics
const startTime = performance.now();

const partyDetails = await getPartyDetails(supabase, userId, partyId);

const duration = performance.now() - startTime;

logInfo('Party details fetched', { 
  partyId, 
  userId, 
  durationMs: duration,
  drinksCount: partyDetails.drinks.length 
});

// Alert jeśli query trwa dłużej niż 1s
if (duration > 1000) {
  logError('Slow query detected', { 
    partyId, 
    userId, 
    durationMs: duration 
  });
}
```

## 9. Kroki implementacji

### Krok 1: Utworzenie validation schema (Zod)

**Plik:** `src/lib/validation/party.validation.ts`

```typescript
// Dodać do istniejącego pliku:

import { z } from 'zod';

/**
 * Validation schema for party ID parameter
 */
export const PartyIdParamSchema = z.object({
  id: z.coerce.number().int().positive({
    message: 'Party ID must be a positive integer'
  })
});

export type PartyIdParam = z.infer<typeof PartyIdParamSchema>;
```

**Test:**
```typescript
// Weryfikacja:
// Valid: { id: "42" } -> { id: 42 }
// Valid: { id: 42 } -> { id: 42 }
// Invalid: { id: "abc" } -> Error
// Invalid: { id: -5 } -> Error
// Invalid: { id: 0 } -> Error
```

### Krok 2: Implementacja funkcji pomocniczych w service

**Plik:** `src/lib/services/party.service.ts`

```typescript
// Dodać na końcu pliku:

/**
 * Fetches party by ID
 * 
 * @param supabase - Supabase client instance
 * @param partyId - Party ID to fetch
 * @returns Party entity or null if not found
 * @throws Error if database query fails
 */
async function fetchParty(
  supabase: SupabaseClient, 
  partyId: number
): Promise<Party | null> {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .maybeSingle();
  
  if (error) {
    logError('Failed to fetch party', { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }
  
  return data;
}

/**
 * Fetches all drinks for a party with their BAC calculations
 * 
 * @param supabase - Supabase client instance
 * @param partyId - Party ID
 * @returns Array of drinks with BAC calculations
 * @throws Error if database query fails
 */
async function fetchDrinksWithBAC(
  supabase: SupabaseClient,
  partyId: number
): Promise<DrinkWithBACDTO[]> {
  const { data: drinks, error } = await supabase
    .from('drinks')
    .select(`
      *,
      baccalculations (*)
    `)
    .eq('party_id', partyId)
    .order('consumed_at', { ascending: true });
  
  if (error) {
    logError('Failed to fetch drinks with BAC', { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }
  
  if (!drinks) {
    return [];
  }
  
  // Transform to DrinkWithBACDTO format
  return drinks.map(drink => ({
    id: drink.id,
    party_id: drink.party_id,
    user_id: drink.user_id,
    volume_ml: drink.volume_ml,
    abv_percent: drink.abv_percent,
    consumed_at: new Date(drink.consumed_at).toISOString(),
    original_values: drink.original_values,
    edited_at: drink.edited_at ? new Date(drink.edited_at).toISOString() : null,
    edit_count: drink.edit_count,
    order_sequence: drink.order_sequence,
    created_at: drink.created_at ? new Date(drink.created_at).toISOString() : new Date().toISOString(),
    updated_at: drink.updated_at ? new Date(drink.updated_at).toISOString() : new Date().toISOString(),
    bac_calculation: drink.baccalculations && drink.baccalculations.length > 0 
      ? {
          id: drink.baccalculations[0].id,
          party_id: drink.baccalculations[0].party_id,
          user_id: drink.baccalculations[0].user_id,
          drink_id: drink.baccalculations[0].drink_id,
          calculated_bac: drink.baccalculations[0].calculated_bac,
          calculation_timestamp: new Date(drink.baccalculations[0].calculation_timestamp).toISOString(),
          algorithm_version: drink.baccalculations[0].algorithm_version,
          user_profile_snapshot: drink.baccalculations[0].user_profile_snapshot as unknown as ProfileSnapshot,
          time_since_first_drink_minutes: drink.baccalculations[0].time_since_first_drink_minutes,
          metabolized_alcohol_g: drink.baccalculations[0].metabolized_alcohol_g,
          created_at: new Date(drink.baccalculations[0].created_at).toISOString()
        }
      : null
  }));
}

/**
 * Fetches active alerts for a party
 * 
 * @param supabase - Supabase client instance
 * @param partyId - Party ID
 * @returns Array of active alerts
 * @throws Error if database query fails
 */
async function fetchActiveAlerts(
  supabase: SupabaseClient,
  partyId: number
): Promise<AlertDTO[]> {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('party_id', partyId)
    .eq('is_active', true)
    .order('triggered_at', { ascending: false });
  
  if (error) {
    logError('Failed to fetch active alerts', { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }
  
  if (!alerts) {
    return [];
  }
  
  return alerts.map(alert => ({
    id: alert.id,
    party_id: alert.party_id,
    user_id: alert.user_id,
    alert_type: alert.alert_type,
    is_active: alert.is_active,
    bac_at_alert: alert.bac_at_alert,
    triggered_at: new Date(alert.triggered_at).toISOString(),
    last_alert_sent_at: alert.last_alert_sent_at ? new Date(alert.last_alert_sent_at).toISOString() : null,
    created_at: alert.created_at ? new Date(alert.created_at).toISOString() : new Date().toISOString(),
    updated_at: alert.updated_at ? new Date(alert.updated_at).toISOString() : new Date().toISOString()
  }));
}

/**
 * Finds the most recent BAC calculation from drinks
 * 
 * @param drinksWithBAC - Array of drinks with BAC calculations
 * @returns Most recent BAC calculation or null if no calculations exist
 */
function findLatestBACCalculation(
  drinksWithBAC: DrinkWithBACDTO[]
): BACCalculationDTO | null {
  // Drinks are already ordered by consumed_at ascending
  // So the last drink's BAC is the most recent
  for (let i = drinksWithBAC.length - 1; i >= 0; i--) {
    if (drinksWithBAC[i].bac_calculation) {
      return drinksWithBAC[i].bac_calculation;
    }
  }
  
  return null;
}

/**
 * Gets detailed information about a specific party
 * 
 * Main business logic for GET /api/parties/:id endpoint.
 * Fetches party with all drinks, BAC calculations, and active alerts.
 * 
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's UUID
 * @param partyId - Party ID to fetch
 * @returns PartyDetailDTO with complete party information
 * @throws Error with specific codes: PARTY_NOT_FOUND, PARTY_FORBIDDEN
 */
export async function getPartyDetails(
  supabase: SupabaseClient,
  userId: string,
  partyId: number
): Promise<PartyDetailDTO> {
  logInfo('Fetching party details', { userId, partyId });
  
  // Step 1: Fetch party
  const party = await fetchParty(supabase, partyId);
  
  if (!party) {
    logInfo('Party not found', { partyId, userId });
    throw new Error('PARTY_NOT_FOUND');
  }
  
  // Step 2: Verify ownership
  if (party.user_id !== userId) {
    logInfo('Unauthorized party access attempt', { 
      partyId, 
      partyUserId: party.user_id,
      requestingUserId: userId 
    });
    // Return NOT_FOUND instead of FORBIDDEN for security
    throw new Error('PARTY_NOT_FOUND');
  }
  
  // Step 3: Fetch drinks with BAC calculations
  const drinksWithBAC = await fetchDrinksWithBAC(supabase, partyId);
  
  // Step 4: Fetch active alerts
  const activeAlerts = await fetchActiveAlerts(supabase, partyId);
  
  // Step 5: Find current BAC (most recent calculation)
  const currentBAC = findLatestBACCalculation(drinksWithBAC);
  
  logInfo('Party details fetched successfully', { 
    partyId, 
    userId,
    drinksCount: drinksWithBAC.length,
    hasCurrentBAC: currentBAC !== null,
    activeAlertsCount: activeAlerts.length
  });
  
  // Step 6: Assemble PartyDetailDTO
  const partyDetailDTO: PartyDetailDTO = {
    id: party.id,
    user_id: party.user_id,
    status: party.status,
    started_at: new Date(party.started_at).toISOString(),
    ended_at: party.ended_at ? new Date(party.ended_at).toISOString() : null,
    bac_estimate_max: party.bac_estimate_max,
    total_drinks_count: party.total_drinks_count,
    total_ml_consumed: party.total_ml_consumed,
    blackout_marked: party.blackout_marked,
    blackout_marked_at: party.blackout_marked_at 
      ? new Date(party.blackout_marked_at).toISOString() 
      : null,
    profile_snapshot: party.profile_snapshot as unknown as ProfileSnapshot,
    created_at: party.created_at 
      ? new Date(party.created_at).toISOString() 
      : new Date().toISOString(),
    updated_at: party.updated_at 
      ? new Date(party.updated_at).toISOString() 
      : new Date().toISOString(),
    drinks: drinksWithBAC,
    current_bac: currentBAC,
    active_alerts: activeAlerts
  };
  
  return partyDetailDTO;
}
```

### Krok 3: Weryfikacja typów w types.ts

**Plik:** `src/types.ts`

Sprawdź czy wszystkie wymagane typy są zdefiniowane:

**Wymagane typy (powinny już istnieć):**
- ✓ `PartyDetailDTO` - główny DTO odpowiedzi
- ✓ `DrinkWithBACDTO` - napój z BAC calculation
- ✓ `BACCalculationDTO` - obliczenie BAC
- ✓ `AlertDTO` - alert
- ✓ `PartyDTO` - podstawowe dane party
- ✓ `DrinkDTO` - podstawowe dane drink
- ✓ `ProfileSnapshot` - snapshot profilu
- ✓ `PartyStatus`, `AlertType`, `Gender` - typy enum

**Jeśli któryś typ brakuje:**
Dodaj go zgodnie z definicjami w [api-plan.md](.ai/api-plan.md). Wszystkie DTOs są szczegółowo opisane w tym dokumencie.

### Krok 4: Implementacja endpoint handlera

**Plik:** `src/pages/api/parties/[id].ts`

```typescript
/**
 * GET /api/parties/:id
 * 
 * Retrieves detailed information about a specific party.
 * Requires authentication and party ownership.
 */

import type { APIRoute } from 'astro';
import { getPartyDetails } from '../../../lib/services/party.service';
import { PartyIdParamSchema } from '../../../lib/validation/party.validation';
import { logError, logInfo } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const startTime = performance.now();
  
  try {
    // Step 1: Validate authentication (handled by middleware)
    const { supabase, user } = locals;
    
    if (!user || !supabase) {
      logInfo('Unauthenticated request to GET /api/parties/:id');
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication token'
        }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Step 2: Validate party ID parameter
    const validation = PartyIdParamSchema.safeParse({ id: params.id });
    
    if (!validation.success) {
      logInfo('Invalid party ID parameter', { 
        partyId: params.id, 
        userId: user.id,
        errors: validation.error.issues 
      });
      
      return new Response(
        JSON.stringify({
          error: 'INVALID_PARTY_ID',
          message: 'Party ID must be a positive integer',
          details: validation.error.issues[0]
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const partyId = validation.data.id;
    
    // Step 3: Get party details from service
    const partyDetails = await getPartyDetails(supabase, user.id, partyId);
    
    // Step 4: Log success and performance
    const duration = performance.now() - startTime;
    logInfo('Party details retrieved successfully', { 
      partyId, 
      userId: user.id,
      drinksCount: partyDetails.drinks.length,
      durationMs: Math.round(duration)
    });
    
    // Alert on slow queries
    if (duration > 1000) {
      logError('Slow query detected', { 
        partyId, 
        userId: user.id, 
        durationMs: Math.round(duration) 
      });
    }
    
    // Step 5: Return success response
    return new Response(
      JSON.stringify(partyDetails),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'X-Response-Time': `${Math.round(duration)}ms`
        } 
      }
    );
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Handle known errors
    if (error instanceof Error) {
      // Party not found
      if (error.message === 'PARTY_NOT_FOUND') {
        logInfo('Party not found', { 
          partyId: params.id, 
          userId: locals.user?.id 
        });
        
        return new Response(
          JSON.stringify({
            error: 'PARTY_NOT_FOUND',
            message: 'Party with the specified ID does not exist'
          }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Database errors and other unexpected errors
      logError('Failed to fetch party details', {
        partyId: params.id,
        userId: locals.user?.id,
        error: error.message,
        stack: error.stack,
        durationMs: Math.round(duration)
      });
      
      return new Response(
        JSON.stringify({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching party details'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Unknown error type
    logError('Unknown error in GET /api/parties/:id', {
      partyId: params.id,
      userId: locals.user?.id,
      error: String(error),
      durationMs: Math.round(duration)
    });
    
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching party details'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
        }
    );
  }
};
```

### Krok 5: Testowanie endpoint

#### Testy manualne (curl/Postman)

```bash
# 1. Test sukcesu (200 OK)
curl -X GET http://localhost:4321/api/parties/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 2. Test nieprawidłowego ID (400 Bad Request)
curl -X GET http://localhost:4321/api/parties/abc \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

curl -X GET http://localhost:4321/api/parties/-5 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Test braku autoryzacji (401 Unauthorized)
curl -X GET http://localhost:4321/api/parties/1

# 4. Test nie znalezionego party (404 Not Found)
curl -X GET http://localhost:4321/api/parties/99999 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 5. Test party innego użytkownika (404 Not Found - security by obscurity)
curl -X GET http://localhost:4321/api/parties/SOMEONE_ELSES_PARTY_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Test cases

1. **Happy path:**
   - Użytkownik zalogowany
   - Party ID prawidłowe
   - Party należy do użytkownika
   - Expected: 200 OK z pełnymi danymi

2. **Party bez napojów:**
   - Nowo utworzone party
   - Expected: 200 OK z pustą tablicą drinks

3. **Party zamknięte:**
   - Party ze statusem 'closed'
   - Expected: 200 OK z pełnymi danymi (current_bac może być null)

4. **Nieprawidłowe ID:**
   - ID = "abc", "-5", "0", "42.5"
   - Expected: 400 Bad Request

5. **Brak autoryzacji:**
   - Brak nagłówka Authorization
   - Expected: 401 Unauthorized

6. **Party nie istnieje:**
   - ID = 99999 (nie ma w bazie)
   - Expected: 404 Not Found

7. **Party innego użytkownika:**
   - ID istnieje ale user_id różni się
   - Expected: 404 Not Found (nie 403!)

### Krok 6: Sprawdzenie indeksów w bazie danych

**Plik:** `supabase/migrations/20260104120200_init_indexes.sql`

Sprawdź czy istnieją następujące indeksy:

```sql
-- Dla parties
CREATE INDEX IF NOT EXISTS idx_parties_user_id ON parties(user_id);

-- Dla drinks
CREATE INDEX IF NOT EXISTS idx_drinks_party_id ON drinks(party_id);
CREATE INDEX IF NOT EXISTS idx_drinks_consumed_at ON drinks(consumed_at);

-- Dla baccalculations
CREATE INDEX IF NOT EXISTS idx_baccalculations_drink_id ON baccalculations(drink_id);
CREATE INDEX IF NOT EXISTS idx_baccalculations_party_id ON baccalculations(party_id);

-- Dla alerts
CREATE INDEX IF NOT EXISTS idx_alerts_party_active ON alerts(party_id, is_active);
```

**Jeśli któryś brakuje, dodać nową migrację:**

```sql
-- supabase/migrations/20260112000000_add_party_detail_indexes.sql

-- Indeksy dla optymalizacji GET /api/parties/:id

CREATE INDEX IF NOT EXISTS idx_drinks_party_consumed 
ON drinks(party_id, consumed_at);

CREATE INDEX IF NOT EXISTS idx_baccalculations_drink 
ON baccalculations(drink_id);

CREATE INDEX IF NOT EXISTS idx_alerts_party_active 
ON alerts(party_id) 
WHERE is_active = true;
```

### Krok 7: Weryfikacja RLS policies

**Plik:** `supabase/migrations/20260104120300_init_rls_policies.sql`

Sprawdź czy istnieją policies dla endpointu GET:

```sql
-- Policy dla parties (read)
CREATE POLICY "Users can view their own parties"
ON parties FOR SELECT
USING (auth.uid() = user_id);

-- Policy dla drinks (read)
CREATE POLICY "Users can view drinks from their parties"
ON drinks FOR SELECT
USING (auth.uid() = user_id);

-- Policy dla baccalculations (read)
CREATE POLICY "Users can view their own BAC calculations"
ON baccalculations FOR SELECT
USING (auth.uid() = user_id);

-- Policy dla alerts (read)
CREATE POLICY "Users can view their own alerts"
ON alerts FOR SELECT
USING (auth.uid() = user_id);
```

**Jeśli któraś policy brakuje, dodać w nowej migracji.**

### Krok 8: Dokumentacja i komentarze

1. **Dodać JSDoc do wszystkich funkcji** (zrobione w Kroku 2)

2. **Zaktualizować README.md** z przykładem użycia:

```markdown
### GET /api/parties/:id

Retrieves detailed information about a specific party.

**Request:**
```bash
GET /api/parties/42
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "id": 42,
  "user_id": "...",
  "status": "closed",
  ...
}
```

**Error Responses:**
- `400` - Invalid party ID
- `401` - Unauthorized
- `404` - Party not found
- `500` - Internal server error
```

3. **Dodać przykład do Postman collection** (jeśli istnieje)

### Krok 9: Monitoring i alerting (opcjonalnie)

```typescript
// W przyszłości: Dodać metryki do systemu monitoringu

// src/lib/metrics.ts (nowy plik)
export function recordAPICall(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number
) {
  // Wysłać do Prometheus/DataDog/etc.
  console.log(`[METRIC] ${method} ${endpoint} ${statusCode} ${durationMs}ms`);
}

// W endpoint handler:
recordAPICall('/api/parties/:id', 'GET', 200, duration);
```

### Krok 10: Code review checklist

Przed mergem, sprawdź:

- [ ] Wszystkie error scenariusze są obsłużone
- [ ] Validation działa poprawnie (testy z nieprawidłowymi danymi)
- [ ] Authorization jest sprawdzana (nie można uzyskać dostępu do party innego użytkownika)
- [ ] Logging jest kompletny (success, errors, performance)
- [ ] Performance jest akceptowalna (< 1s dla typowych przypadków)
- [ ] Kod jest zgodny z guidelines (early returns, guard clauses)
- [ ] JSDoc jest kompletna dla wszystkich publicznych funkcji
- [ ] Typy TypeScript są poprawne (brak any)
- [ ] RLS policies są aktywne
- [ ] Indeksy są utworzone
- [ ] Testy manualne przeszły
- [ ] Brak sekretów w kodzie
- [ ] Error messages nie ujawniają wrażliwych informacji

### Krok 11: Deployment

1. **Sprawdź environment variables:**
```bash
# .env
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

2. **Run migrations:**
```bash
npx supabase db push
```

3. **Deploy aplikacji:**
```bash
npm run build
# Deploy do DigitalOcean/Vercel/etc.
```

4. **Smoke test po deployu:**
```bash
curl -X GET https://production-url.com/api/parties/1 \
  -H "Authorization: Bearer PROD_TOKEN"
```

---

## Podsumowanie

Ten plan implementacji obejmuje:
- ✅ Walidację danych wejściowych (Zod)
- ✅ Logikę biznesową w service layer
- ✅ Prawidłową obsługę błędów
- ✅ Autoryzację i uwierzytelnianie
- ✅ Optymalizację wydajności (nested queries)
- ✅ Logging i monitoring
- ✅ Bezpieczeństwo (RLS, input validation)
- ✅ Szczegółowe testy manualne
- ✅ Dokumentację kodu

Endpoint jest gotowy do implementacji zgodnie z best practices dla Astro 5 + Supabase stack.
