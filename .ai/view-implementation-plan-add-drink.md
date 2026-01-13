# API Endpoint Implementation Plan: Add Drink to Party

## 1. Przegląd punktu końcowego

Endpoint `POST /api/parties/:partyId/drinks` służy do dodawania nowego wpisu napoju alkoholowego do trwającej sesji imprezowej użytkownika. Po dodaniu drinka system automatycznie:
- Waliduje dane wejściowe pod kątem ograniczeń biznesowych
- Oblicza aktualny poziom BAC (Blood Alcohol Content) używając formuły Widmarka
- Sprawdza i generuje ostrzeżenia o nierealistycznych wartościach lub szybkiej konsumpcji
- Tworzy alerty o zbliżaniu się lub przekroczeniu progu BAC
- Aktualizuje statystyki imprezy (cached fields)
- Loguje zdarzenia do tabeli Events

Endpoint realizuje user stories: US-005 (Dodawanie napojów), US-012 (Wykrywanie nierealistycznych wartości), US-016 (Ostrzeżenia o szybkiej konsumpcji), US-017 (System alertów).

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
`/api/parties/:partyId/drinks`

### Path Parameters
- **partyId** (bigint, wymagany) - ID sesji imprezowej, do której dodawany jest napój

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Request Body
```typescript
{
  volume_ml: number,           // Wymagane: objętość napoju w ml (>0, ≤5000)
  abv_percent: number,         // Wymagane: zawartość alkoholu w % (0.1-100)
  consumed_at?: string,        // Opcjonalne: timestamp konsumpcji (ISO 8601), domyślnie: now
  confirm_warnings?: boolean   // Opcjonalne: potwierdzenie ostrzeżeń walidacyjnych
}
```

### Przykładowe żądanie
```json
{
  "volume_ml": 500,
  "abv_percent": 5.2,
  "consumed_at": "2026-01-12T20:30:00Z"
}
```

## 3. Wykorzystywane typy

**WAŻNE**: Wszystkie typy powinny być importowane z `src/types.ts`. NIE tworzyć duplikatów ani nowych definicji typów, jeśli już istnieją w types.ts.

```typescript
// Prawidłowy import typów
import type {
  AddDrinkCommand,
  AddDrinkResponseDTO,
  DrinkDTO,
  BACCalculationDTO,
  DrinkValidationWarning,
  AlertDTO,
  ProfileSnapshot,
  APIError,
  ValidationWarningResponse,
  Party,
  Drink,
  BACCalculation,
  Alert,
  Event,
  UserProfile,
  UserThreshold
} from '@/types';

// Database types
import type { Tables } from '@/db/database.types';
```

### Command Models
- **AddDrinkCommand** - struktura request body (z types.ts)

### Response DTOs
- **AddDrinkResponseDTO** - główna struktura odpowiedzi (z types.ts)
- **DrinkDTO** - reprezentacja utworzonego drinka (z types.ts)
- **BACCalculationDTO** - wynik kalkulacji BAC (z types.ts)
- **DrinkValidationWarning** - ostrzeżenia walidacyjne (z types.ts)
- **AlertDTO** - aktywne alerty (z types.ts)
- **ProfileSnapshot** - snapshot profilu użytkownika (z types.ts)

### Error Types
- **APIError** - standardowy format błędu (z types.ts)
- **ValidationWarningResponse** - odpowiedź z ostrzeżeniami 422 (z types.ts)

### Database Entity Types (z types.ts)
- **Party** = Tables<"parties">
- **Drink** = Tables<"drinks">
- **BACCalculation** = Tables<"baccalculations">
- **Alert** = Tables<"alerts">
- **Event** = Tables<"events">
- **UserProfile** = Tables<"userprofiles">
- **UserThreshold** = Tables<"userthresholds">

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)
```json
{
  "drink": {
    "id": 123,
    "party_id": 456,
    "user_id": "uuid-string",
    "volume_ml": 500,
    "abv_percent": 5.2,
    "consumed_at": "2026-01-12T20:30:00Z",
    "order_sequence": 3,
    "edit_count": 0,
    "created_at": "2026-01-12T20:30:15Z",
    "updated_at": "2026-01-12T20:30:15Z"
  },
  "bac_calculation": {
    "id": 789,
    "party_id": 456,
    "user_id": "uuid-string",
    "drink_id": 123,
    "calculated_bac": 0.05,
    "calculation_timestamp": "2026-01-12T20:30:15Z",
    "algorithm_version": "Widmark v1",
    "user_profile_snapshot": {
      "height_cm": 180,
      "weight_kg": 75.5,
      "gender": "M",
      "captured_at": "2026-01-12T20:00:00Z"
    },
    "time_since_first_drink_minutes": 30,
    "metabolized_alcohol_g": 2.5,
    "created_at": "2026-01-12T20:30:15Z"
  },
  "warnings": [
    {
      "code": "fast_consumption",
      "message": "Napój dodany w krótkim czasie od poprzedniego (< 15 minut)",
      "field": "consumed_at",
      "value": 10
    }
  ],
  "active_alerts": [
    {
      "id": 101,
      "party_id": 456,
      "user_id": "uuid-string",
      "alert_type": "approaching_threshold",
      "is_active": true,
      "bac_at_alert": 0.05,
      "triggered_at": "2026-01-12T20:30:15Z",
      "last_alert_sent_at": "2026-01-12T20:30:15Z",
      "created_at": "2026-01-12T20:30:15Z",
      "updated_at": "2026-01-12T20:30:15Z"
    }
  ]
}
```

### Kody statusu błędów
- **400 Bad Request** - nieprawidłowe wartości, party zamknięte, consumed_at poza zakresem
- **401 Unauthorized** - brak lub nieprawidłowy token
- **403 Forbidden** - party należy do innego użytkownika
- **404 Not Found** - party nie istnieje
- **422 Unprocessable Entity** - ostrzeżenia walidacyjne wymagają potwierdzenia
- **500 Internal Server Error** - błąd serwera

### Przykładowe odpowiedzi błędów

**400 Bad Request:**
```json
{
  "error": {
    "code": "PARTY_CLOSED",
    "message": "Nie można dodać napoju do zamkniętej imprezy"
  }
}
```

**422 Unprocessable Entity:**
```json
{
  "warnings": [
    {
      "code": "unrealistic_volume",
      "message": "Podana objętość (2500ml) przekracza realistyczną wartość dla pojedynczego napoju",
      "field": "volume_ml",
      "value": 2500
    }
  ],
  "requires_confirmation": true
}
```

## 5. Przepływ danych

### 1. Walidacja żądania
```
Client → API Endpoint → Zod Schema Validation
                     ↓
                Authentication Check (Supabase middleware)
                     ↓
                Parse & validate partyId
```

### 2. Pobieranie danych kontekstu
```
API → Supabase → SELECT party WHERE id = partyId
             ↓
         Check party exists (404)
         Check party.user_id === auth.user_id (403)
         Check party.status === 'ongoing' (400)
             ↓
         SELECT current threshold WHERE user_id = auth.user_id AND is_current = true
             ↓
         SELECT last drink WHERE party_id = partyId ORDER BY consumed_at DESC LIMIT 1
```

### 3. Walidacja biznesowa
```
Validate consumed_at in party timeframe
    ↓
Check unrealistic volume (>2000ml) → Warning
    ↓
Check fast consumption (time since last drink < threshold) → Warning
    ↓
If warnings exist AND !confirm_warnings → Return 422
```

### 4. Tworzenie rekordu Drink
```
Calculate order_sequence (MAX(order_sequence) + 1)
    ↓
INSERT INTO Drinks (party_id, user_id, volume_ml, abv_percent, consumed_at, order_sequence)
    ↓
Return created drink
```

### 5. Kalkulacja BAC
```
Fetch profile_snapshot from party
    ↓
Calculate alcohol_grams = (volume_ml * abv_percent * 0.789) / 100
  Note: 0.789 g/ml to gęstość etanolu (stała fizyczna)
    ↓
Calculate total_alcohol_consumed (sum from all drinks in party)
    ↓
Apply Widmark formula:
  - r = gender === 'M' ? 0.68 : 0.55
  - bac = (total_alcohol_g / (weight_kg * r * 1000)) * 100
    ↓
Calculate metabolized_alcohol (time_elapsed * metabolization_rate)
    ↓
adjusted_bac = bac - metabolized_alcohol
    ↓
INSERT INTO BACCalculations
```

### 6. Zarządzanie alertami
```
Compare calculated_bac with threshold_bac
    ↓
If bac >= 0.90 * threshold:
  - CREATE or UPDATE alert (approaching_threshold)
    ↓
If bac >= threshold:
  - CREATE or UPDATE alert (exceeded_threshold)
    ↓
Return active alerts for party
```

### 7. Aktualizacja statystyk Party
```
UPDATE Parties SET
  total_drinks_count = total_drinks_count + 1,
  total_ml_consumed = total_ml_consumed + volume_ml,
  bac_estimate_max = GREATEST(bac_estimate_max, calculated_bac)
WHERE id = partyId
```

### 8. Logowanie zdarzeń
```
INSERT INTO Events (user_id, party_id, event_type)
VALUES (auth.user_id, partyId, 'drink_added')
    ↓
If fast_consumption warning:
  INSERT INTO Events (event_type = 'fast_consumption_warning')
```

### 9. Zwrócenie odpowiedzi
```
Build AddDrinkResponseDTO {
  drink,
  bac_calculation,
  warnings,
  active_alerts
}
    ↓
Return 201 Created
```

## 6. Względy bezpieczeństwa

### Authentication
- **Bearer Token**: Wymagany w nagłówku Authorization
- **Middleware**: Supabase middleware w `src/middleware/index.ts` weryfikuje token
- **Context**: Użytkownik dostępny przez `context.locals.user`
- **Error handling**: 401 jeśli token brakuje lub jest nieprawidłowy

### Authorization
- **Ownership check**: Sprawdzenie `party.user_id === authenticated_user.id`
- **RLS Policies**: Supabase Row Level Security na wszystkich tabelach
  - Drinks: user_id musi być równy auth.uid()
  - BACCalculations: user_id musi być równy auth.uid()
  - Alerts: user_id musi być równy auth.uid()
  - Events: user_id musi być równy auth.uid()
- **Error handling**: 403 jeśli użytkownik nie jest właścicielem party

### Input Validation
- **Schema validation**: Zod schema dla wszystkich pól request body
- **Type safety**: TypeScript types dla wszystkich struktur danych
- **Business rules**: Dodatkowa walidacja biznesowa w service layer
- **Sanitization**: Automatyczna przez Supabase SDK (parametryzowane queries)

### SQL Injection Protection
- **Supabase SDK**: Używamy metod SDK, które automatycznie parametryzują queries
- **No raw SQL**: Unikamy surowych stringów SQL w kodzie aplikacji

### Data Integrity
- **Database constraints**: CHECK constraints na volume_ml, abv_percent
- **Foreign keys**: CASCADE DELETE dla zachowania integralności
- **Transactions**: Użycie transakcji dla operacji wielokrokowych (drink + bac + alerts + events)

### Rate Limiting
- **Recommendation**: Rozważyć implementację rate limiting (np. max 50 drinks/hour per user)
- **Not in spec**: Nie wymienione w specyfikacji, ale dobra praktyka

### Denial of Service Protection
- **Input limits**: volume_ml ≤ 5000, abv_percent ≤ 100
- **Validation**: Wczesne odrzucanie nieprawidłowych danych
- **Resource limits**: Kontrola rozmiaru response (nie zwracamy wszystkich drinks, tylko preview)

## 7. Obsługa błędów

### 400 Bad Request

**Scenariusz 1: Nieprawidłowe wartości pól**
```typescript
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "volume_ml musi być większe od 0 i nie większe niż 5000",
    "details": { "field": "volume_ml", "value": 6000 }
  }
}
```

**Scenariusz 2: Party zamknięte**
```typescript
{
  "error": {
    "code": "PARTY_CLOSED",
    "message": "Nie można dodać napoju do zamkniętej imprezy"
  }
}
```

**Scenariusz 3: consumed_at poza zakresem party**
```typescript
{
  "error": {
    "code": "INVALID_TIMESTAMP",
    "message": "consumed_at musi być w zakresie czasu trwania imprezy",
    "details": {
      "consumed_at": "2026-01-12T18:00:00Z",
      "party_started_at": "2026-01-12T20:00:00Z"
    }
  }
}
```

### 401 Unauthorized

**Scenariusz: Brak tokenu lub token nieprawidłowy**
```typescript
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Brak autoryzacji. Wymagany prawidłowy token."
  }
}
```

### 403 Forbidden

**Scenariusz: Party należy do innego użytkownika**
```typescript
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Brak uprawnień do dodania napoju do tej imprezy"
  }
}
```

### 404 Not Found

**Scenariusz: Party nie istnieje**
```typescript
{
  "error": {
    "code": "PARTY_NOT_FOUND",
    "message": "Impreza o podanym ID nie istnieje",
    "details": { "party_id": 999 }
  }
}
```

### 422 Unprocessable Entity

**Scenariusz: Ostrzeżenia wymagają potwierdzenia**
```typescript
{
  "warnings": [
    {
      "code": "unrealistic_volume",
      "message": "Podana objętość przekracza 2000ml. Czy jesteś pewien?",
      "field": "volume_ml",
      "value": 2500
    },
    {
      "code": "fast_consumption",
      "message": "Napój dodany w czasie krótszym niż 15 minut od poprzedniego",
      "field": "consumed_at",
      "value": 10
    }
  ],
  "requires_confirmation": true
}
```

**Obsługa**: Client powinien ponownie wysłać request z `confirm_warnings: true`

### 500 Internal Server Error

**Scenariusz: Błąd bazy danych lub nieoczekiwany błąd**
```typescript
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później."
  }
}
```

**Logging**: Szczegóły błędu logowane przez logger.ts

### Error Handling Strategy

1. **Try-catch blocks**: Wszystkie operacje bazodanowe w try-catch
2. **Early returns**: Walidacja na początku funkcji z wczesnymi returnami
3. **Centralized error handling**: Middleware dla spójnej obsługi błędów
4. **Logging**: Wszystkie błędy 5xx logowane do konsoli/pliku
5. **User-friendly messages**: Błędy klienckie (4xx) z czytelnymi komunikatami

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

1. **Multiple database queries**
   - Pobieranie party, threshold, last drink
   - Solution: Użycie pojedynczego query z JOIN gdzie możliwe

2. **BAC calculation complexity**
   - Sumowanie wszystkich drinks w party
   - Solution: Cache total_alcohol w party lub BACCalculations

3. **Alert checking**
   - Query do pobrania aktywnych alertów
   - Solution: Indeks na (party_id, is_active, alert_type)

4. **Sequential operations**
   - Drink → BAC → Alerts → Events → Update stats
   - Solution: Rozważyć transaction z batch operations

### Strategie optymalizacji

**1. Database Indexes**
```sql
-- Już istniejące (z migracji):
CREATE INDEX idx_drinks_party_id ON Drinks(party_id);
CREATE INDEX idx_drinks_consumed_at ON Drinks(consumed_at);
CREATE INDEX idx_baccalculations_party_id ON BACCalculations(party_id);
CREATE INDEX idx_alerts_party_active ON Alerts(party_id, is_active);
```

**2. Query optimization**
- Użycie SELECT specific columns zamiast SELECT *
- Użycie LIMIT 1 dla last drink query
- Single transaction dla wszystkich write operations

**3. Caching**
- Party cached fields (total_drinks_count, total_ml_consumed, bac_estimate_max)
- Profile snapshot w party (nie trzeba joinować UserProfiles)
- Current threshold cache (aktualizowany tylko przy zmianie progu)

**4. Batch operations**
```typescript
// Zamiast:
await insertDrink();
await insertBAC();
await insertAlert();
await insertEvent();
await updateParty();

// Użyć transakcji:
await supabase.rpc('add_drink_transaction', {
  // All operations in single DB round-trip
});
```

**5. Response optimization**
- Nie zwracamy wszystkich drinks w response (tylko nowo utworzony)
- Nie zwracamy historii BAC (tylko aktualna kalkulacja)
- Active alerts filtrowane po stronie DB (is_active = true)

**6. Monitoring**
- Log execution time dla każdego kroku
- Alert jeśli request trwa > 2s
- Metrics dla BAC calculation time

### Performance targets

- **Response time**: < 500ms dla 95% requestów
- **BAC calculation**: < 100ms
- **Database operations**: < 300ms łącznie
- **Total request time**: < 1s max

### Scalability considerations

1. **Horizontal scaling**: Stateless API endpoints (można łatwo skalować)
2. **Database connection pooling**: Supabase SDK zarządza poolem
3. **Read replicas**: Rozważyć dla heavy read operations (historia)
4. **Background jobs**: Rozważyć async processing dla events/alerts (future)

## 9. Etapy implementacji

### Krok 1: Przygotowanie warstwy walidacji

**ZASADA**: Używaj typów z `src/types.ts` - nie twórz duplikatów!

**1.1 Utworzyć Zod schema dla AddDrinkCommand**
- Lokalizacja: `src/lib/validation/drink.validation.ts`
- Schema dla request body z regułami walidacji
- Export schemy do użycia w endpoint
- **Typ AddDrinkCommand już istnieje w types.ts - użyj go!**

```typescript
// src/lib/validation/drink.validation.ts
import { z } from 'zod';
import type { AddDrinkCommand } from '@/types'; // Import typu z types.ts

export const addDrinkSchema = z.object({
  volume_ml: z.number().int().min(1).max(5000),
  abv_percent: z.number().min(0.1).max(100),
  consumed_at: z.string().datetime().optional(),
  confirm_warnings: z.boolean().optional()
}) satisfies z.ZodType<AddDrinkCommand>; // Zapewnia zgodność ze zdefiniowanym typem
```

**1.2 Utworzyć helper functions dla business validation**
- Funkcja sprawdzająca nierealistyczne wartości (>2000ml)
- Funkcja sprawdzająca szybką konsumpcję
- **Używaj typu DrinkValidationWarning z types.ts**

```typescript
import type { DrinkValidationWarning, Party, Drink } from '@/types';

export function checkUnrealisticVolume(volume_ml: number): DrinkValidationWarning | null {
  // Implementation...
}

export function checkFastConsumption(
  consumed_at: string,
  lastDrink: Drink | null
): DrinkValidationWarning | null {
  // Implementation...
}
```

### Krok 2: Implementacja service layer

**ZASADA**: Wszystkie service functions muszą używać typów z `src/types.ts`

**2.1 Utworzyć drink.service.ts**
- Lokalizacja: `src/lib/services/drink.service.ts`
- **Importuj typy**: `Drink`, `Party`, `DrinkValidationWarning`, `AddDrinkCommand` z types.ts
- Funkcje:
  - `createDrink(supabase, partyId, userId, drinkData)` - tworzy drink
  - `checkDrinkWarnings(drinkData, party, lastDrink)` - sprawdza ostrzeżenia walidacyjne:
    * Sprawdza czy consumed_at jest w zakresie czasu party
    * Wykrywa nierealistyczne wartości (>2000ml) - US-012
    * Wykrywa szybką konsumpcję (<15 min od ostatniego drinka) - US-016
    * Zwraca tablicę ostrzeżeń DrinkValidationWarning[]
  - `getLastDrink(supabase, partyId)` - pobiera ostatni drink
  - `getDrinkById(supabase, drinkId)` - pobiera drink po ID

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { Drink, Party, DrinkValidationWarning, AddDrinkCommand } from '@/types';

export async function createDrink(
  supabase: SupabaseClient,
  partyId: number,
  userId: string,
  drinkData: AddDrinkCommand
): Promise<Drink> {
  // Implementation...
}
```

**2.2 Utworzyć bac.service.ts**
- Lokalizacja: `src/lib/services/bac.service.ts`
- **Importuj typy**: `BACCalculation`, `ProfileSnapshot`, `Drink` z types.ts
- Funkcje:
  - `calculateBAC(profileSnapshot, drinks, currentTime)` - Widmark formula
  - `createBACCalculation(supabase, calculation)` - zapisuje obliczenie
  - `getTotalAlcoholConsumed(drinks)` - sumuje alkohol
  - `getMetabolizedAlcohol(timeSinceFirstDrink, gender)` - oblicza zmetabolizowany alkohol

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { BACCalculation, ProfileSnapshot, Drink, Gender } from '@/types';

export function calculateBAC(
  profileSnapshot: ProfileSnapshot,
  drinks: Drink[],
  currentTime: Date
): number {
  // Implementation...
}
```

**2.3 Utworzyć alert.service.ts**
- Lokalizacja: `src/lib/services/alert.service.ts`
- **Importuj typy**: `Alert`, `AlertDTO` z types.ts
- Funkcje:
  - `checkAndCreateAlerts(supabase, partyId, userId, currentBAC, threshold)` - sprawdza progi
  - `getActiveAlerts(supabase, partyId)` - pobiera aktywne alerty
  - `updateAlert(supabase, alertId, data)` - aktualizuje alert

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { Alert, AlertDTO } from '@/types';

export async function getActiveAlerts(
  supabase: SupabaseClient,
  partyId: number
): Promise<Alert[]> {
  // Implementation...
}
```

**2.4 Utworzyć event.service.ts**
- Lokalizacja: `src/lib/services/event.service.ts`
- **Importuj typy**: `Event`, `EventType` z types.ts
- Funkcje:
  - `logEvent(supabase, userId, partyId, eventType)` - loguje zdarzenie
  - `logDrinkAdded(supabase, userId, partyId)` - helper dla drink_added
  - `logFastConsumption(supabase, userId, partyId)` - helper dla fast_consumption_warning

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { Event, EventType } from '@/types';

export async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  partyId: number,
  eventType: EventType
): Promise<void> {
  // Implementation...
}
```

**2.5 Rozszerzyć party.service.ts**
- **Importuj typy**: `Party`, `PartyDTO` z types.ts
- Funkcje do dodania:
  - `updatePartyStatistics(supabase, partyId, drinkVolume, bacValue)` - aktualizuje cached fields
  - `getPartyWithContext(supabase, partyId, userId)` - pobiera party z weryfikacją ownership

```typescript
import type { SupabaseClient } from '@/db/supabase.client';
import type { Party } from '@/types';

export async function getPartyWithContext(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<Party | null> {
  // Implementation...
}
```

### Krok 3: Implementacja endpoint handler

**ZASADA**: Handler musi używać typów z `src/types.ts` dla wszystkich request/response struktur

**3.1 Utworzyć plik endpoint**
- Lokalizacja: `src/pages/api/parties/[id]/drinks.ts`
- Export: `export const prerender = false;`
- Handler: `export async function POST(context: APIContext)`

**3.2 Struktura handlera**

```typescript
import type { APIContext } from 'astro';
import type { 
  AddDrinkCommand, 
  AddDrinkResponseDTO, 
  APIError,
  ValidationWarningResponse 
} from '@/types'; // WSZYSTKIE typy z types.ts!
import { addDrinkSchema } from '@/lib/validation/drink.validation';

export const prerender = false;

export async function POST(context: APIContext) {
  try {
    // 1. Authentication check
    const user = context.locals.user;
    if (!user) {
      return new Response(JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: '...' }
      }), { status: 401 });
    }

    // 2. Parse and validate partyId
    const partyId = parseInt(context.params.id);
    if (isNaN(partyId)) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_PARTY_ID', message: '...' }
      }), { status: 400 });
    }

    // 3. Parse and validate request body
    const body = await context.request.json();
    const validation = addDrinkSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_INPUT', message: '...', details: validation.error }
      }), { status: 400 });
    }

    const drinkData = validation.data;
    const supabase = context.locals.supabase;

    // 4. Fetch party with ownership check
    const party = await getPartyWithContext(supabase, partyId, user.id);
    if (!party) {
      return new Response(JSON.stringify({
        error: { code: 'PARTY_NOT_FOUND', message: '...' }
      }), { status: 404 });
    }
    if (party.user_id !== user.id) {
      return new Response(JSON.stringify({
        error: { code: 'FORBIDDEN', message: '...' }
      }), { status: 403 });
    }
    if (party.status !== 'ongoing') {
      return new Response(JSON.stringify({
        error: { code: 'PARTY_CLOSED', message: '...' }
      }), { status: 400 });
    }

    // 5. Business validation
    const lastDrink = await getLastDrink(supabase, partyId);
    const warnings = await checkDrinkWarnings(drinkData, party, lastDrink);
    
    if (warnings.length > 0 && !drinkData.confirm_warnings) {
      return new Response(JSON.stringify({
        warnings,
        requires_confirmation: true
      }), { status: 422 });
    }

    // 6. Create drink (transaction start)
    const drink = await createDrink(supabase, partyId, user.id, drinkData);

    // 7. Calculate BAC
    const allDrinks = await getAllPartyDrinks(supabase, partyId);
    const bacCalculation = await calculateAndSaveBAC(
      supabase,
      party.profile_snapshot,
      allDrinks,
      drink,
      partyId,
      user.id
    );

    // 8. Check and create alerts
    const threshold = await getCurrentThreshold(supabase, user.id);
    await checkAndCreateAlerts(
      supabase,
      partyId,
      user.id,
      bacCalculation.calculated_bac,
      threshold.threshold_bac
    );
    const activeAlerts = await getActiveAlerts(supabase, partyId);

    // 9. Update party statistics
    await updatePartyStatistics(
      supabase,
      partyId,
      drink.volume_ml,
      bacCalculation.calculated_bac
    );

    // 10. Log events
    await logDrinkAdded(supabase, user.id, partyId);
    if (warnings.some(w => w.code === 'fast_consumption')) {
      await logFastConsumption(supabase, user.id, partyId);
    }

    // 11. Build and return response
    const response: AddDrinkResponseDTO = {
      drink: mapToDrinkDTO(drink),
      bac_calculation: mapToBACDTO(bacCalculation),
      warnings,
      active_alerts: activeAlerts.map(mapToAlertDTO)
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Error adding drink:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Wystąpił nieoczekiwany błąd'
      }
    }), { status: 500 });
  }
}
```

### Krok 4: Implementacja mapperów DTO

**ZASADA**: Mappery konwertują typy database na typy DTO z `src/types.ts`

**4.1 Utworzyć mapper functions**
- Lokalizacja: `src/lib/mappers/drink.mapper.ts` (nowy plik)
- **Wszystkie typy DTO już są w types.ts - użyj ich!**
- Funkcje:
  - `mapToDrinkDTO(drink: Tables<'drinks'>): DrinkDTO`
  - `mapToBACDTO(bac: Tables<'baccalculations'>): BACCalculationDTO`
  - `mapToAlertDTO(alert: Tables<'alerts'>): AlertDTO`

```typescript
import type { Tables } from '@/db/database.types';
import type { DrinkDTO, BACCalculationDTO, AlertDTO, ProfileSnapshot } from '@/types';

export function mapToDrinkDTO(drink: Tables<'drinks'>): DrinkDTO {
  return {
    id: drink.id,
    party_id: drink.party_id,
    user_id: drink.user_id,
    volume_ml: drink.volume_ml,
    abv_percent: Number(drink.abv_percent),
    consumed_at: drink.consumed_at,
    order_sequence: drink.order_sequence,
    edit_count: drink.edit_count,
    original_values: drink.original_values,
    edited_at: drink.edited_at,
    created_at: drink.created_at,
    updated_at: drink.updated_at
  };
}

export function mapToBACDTO(bac: Tables<'baccalculations'>): BACCalculationDTO {
  return {
    id: bac.id,
    party_id: bac.party_id,
    user_id: bac.user_id,
    drink_id: bac.drink_id,
    calculated_bac: Number(bac.calculated_bac),
    calculation_timestamp: bac.calculation_timestamp,
    algorithm_version: bac.algorithm_version,
    user_profile_snapshot: bac.user_profile_snapshot as ProfileSnapshot,
    time_since_first_drink_minutes: bac.time_since_first_drink_minutes,
    metabolized_alcohol_g: bac.metabolized_alcohol_g ? Number(bac.metabolized_alcohol_g) : null,
    created_at: bac.created_at
  };
}

export function mapToAlertDTO(alert: Tables<'alerts'>): AlertDTO {
  return {
    id: alert.id,
    party_id: alert.party_id,
    user_id: alert.user_id,
    alert_type: alert.alert_type,
    is_active: alert.is_active,
    bac_at_alert: Number(alert.bac_at_alert),
    triggered_at: alert.triggered_at,
    last_alert_sent_at: alert.last_alert_sent_at,
    created_at: alert.created_at,
    updated_at: alert.updated_at
  };
}
```

**4.2 Konwersja typów**
- Database timestamp (już string w ISO) → ISO string (bez zmian)
- JSONB → typed objects (ProfileSnapshot z types.ts)
- Decimal → number (Number() conversion)

### Krok 5: Implementacja logiki BAC (Widmark formula)

**5.1 Formuła Widmarka**

```typescript
function calculateBAC(
  profileSnapshot: ProfileSnapshot,
  totalAlcoholGrams: number,
  timeSinceFirstDrinkMinutes: number
): number {
  const { weight_kg, gender } = profileSnapshot;
  
  // r (distribution ratio): M=0.68, F=0.55
  const r = gender === 'M' ? 0.68 : 0.55;
  
  // BAC = (alcohol_g / (weight_kg * r * 1000)) * 100
  const bac = (totalAlcoholGrams / (weight_kg * r * 1000)) * 100;
  
  // Metabolization: ~0.15g/hour per kg body weight
  const metabolizationRate = 0.15; // g/hour/kg
  const hoursElapsed = timeSinceFirstDrinkMinutes / 60;
  const metabolizedAlcohol = metabolizationRate * weight_kg * hoursElapsed;
  
  // Adjusted BAC
  const adjustedBAC = Math.max(0, bac - (metabolizedAlcohol / (weight_kg * r * 1000)) * 100);
  
  return Math.round(adjustedBAC * 100) / 100; // Round to 2 decimals
}
```

**5.2 Obliczanie alkoholu w gramach**

```typescript
function calculateAlcoholGrams(volume_ml: number, abv_percent: number): number {
  // Stała 0.789 to gęstość etanolu w g/ml w temp. pokojowej (~20°C)
  // alcohol_g = volume_ml * (abv_percent / 100) * density_of_ethanol
  return (volume_ml * (abv_percent / 100) * 0.789);
}
```

### Krok 6: Implementacja logiki alertów

**6.1 Sprawdzanie progów**

```typescript
async function checkAndCreateAlerts(
  supabase: SupabaseClient,
  partyId: number,
  userId: string,
  currentBAC: number,
  thresholdBAC: number
): Promise<void> {
  const approachingThreshold = thresholdBAC * 0.90;
  
  // Check approaching threshold
  if (currentBAC >= approachingThreshold && currentBAC < thresholdBAC) {
    await upsertAlert(supabase, {
      party_id: partyId,
      user_id: userId,
      alert_type: 'approaching_threshold',
      bac_at_alert: currentBAC,
      triggered_at: new Date().toISOString(),
      is_active: true
    });
  }
  
  // Check exceeded threshold
  if (currentBAC >= thresholdBAC) {
    await upsertAlert(supabase, {
      party_id: partyId,
      user_id: userId,
      alert_type: 'exceeded_threshold',
      bac_at_alert: currentBAC,
      triggered_at: new Date().toISOString(),
      is_active: true
    });
  }
}
```

**6.2 Upsert alert (create or update)**

```typescript
async function upsertAlert(
  supabase: SupabaseClient,
  alertData: Partial<Tables<'alerts'>>
): Promise<void> {
  // Try to find existing alert
  const { data: existing } = await supabase
    .from('alerts')
    .select('*')
    .eq('party_id', alertData.party_id)
    .eq('alert_type', alertData.alert_type)
    .eq('is_active', true)
    .single();
  
  if (existing) {
    // Update existing alert
    await supabase
      .from('alerts')
      .update({
        bac_at_alert: alertData.bac_at_alert,
        last_alert_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new alert
    await supabase
      .from('alerts')
      .insert(alertData);
  }
}
```

### Krok 7: Implementacja walidacji biznesowej

**Funkcja `checkDrinkWarnings` agreguje wszystkie business validation rules i zwraca ostrzeżenia.**

Różnica między walidacją techniczną (Zod) a biznesową:
- **Walidacja techniczna (Zod)**: Sprawdza format i zakresy wartości → błąd 400
- **Walidacja biznesowa**: Sprawdza logikę biznesową → ostrzeżenia 422 (wymagają potwierdzenia)

```typescript
import type { DrinkValidationWarning, Party, Drink, AddDrinkCommand } from '@/types';

export function checkDrinkWarnings(
  drinkData: AddDrinkCommand,
  party: Party,
  lastDrink: Drink | null
): DrinkValidationWarning[] {
  const warnings: DrinkValidationWarning[] = [];
  
  // 1. Sprawdź consumed_at w zakresie party
  const timeWarning = validateConsumedAt(drinkData.consumed_at || new Date().toISOString(), party);
  if (timeWarning) warnings.push(timeWarning);
  
  // 2. Sprawdź nierealistyczną objętość (US-012)
  const volumeWarning = checkUnrealisticVolume(drinkData.volume_ml);
  if (volumeWarning) warnings.push(volumeWarning);
  
  // 3. Sprawdź szybką konsumpcję (US-016)
  const fastConsumptionWarning = checkFastConsumption(
    drinkData.consumed_at || new Date().toISOString(),
    lastDrink
  );
  if (fastConsumptionWarning) warnings.push(fastConsumptionWarning);
  
  return warnings;
}
```

**7.1 Walidacja consumed_at**

```typescript
function validateConsumedAt(
  consumed_at: string,
  party: Party
): DrinkValidationWarning | null {
  const consumedDate = new Date(consumed_at);
  const startedDate = new Date(party.started_at);
  
  if (consumedDate < startedDate) {
    return {
      code: 'INVALID_TIMESTAMP',
      message: 'consumed_at nie może być wcześniejszy niż rozpoczęcie imprezy',
      field: 'consumed_at',
      value: consumed_at
    };
  }
  
  if (party.ended_at) {
    const endedDate = new Date(party.ended_at);
    if (consumedDate > endedDate) {
      return {
        code: 'INVALID_TIMESTAMP',
        message: 'consumed_at nie może być późniejszy niż zakończenie imprezy',
        field: 'consumed_at',
        value: consumed_at
      };
    }
  }
  
  return null;
}
```

**7.2 Walidacja nierealistycznych wartości (US-012)**

```typescript
function checkUnrealisticVolume(volume_ml: number): DrinkValidationWarning | null {
  const UNREALISTIC_THRESHOLD = 2000; // ml
  
  if (volume_ml > UNREALISTIC_THRESHOLD) {
    return {
      code: 'unrealistic_volume',
      message: `Podana objętość (${volume_ml}ml) przekracza realistyczną wartość dla pojedynczego napoju (${UNREALISTIC_THRESHOLD}ml)`,
      field: 'volume_ml',
      value: volume_ml
    };
  }
  
  return null;
}
```

**7.3 Walidacja szybkiej konsumpcji (US-016)**

```typescript
function checkFastConsumption(
  consumed_at: string,
  lastDrink: Drink | null,
  threshold_minutes: number = 15
): DrinkValidationWarning | null {
  if (!lastDrink) return null;
  
  const currentTime = new Date(consumed_at);
  const lastTime = new Date(lastDrink.consumed_at);
  const diffMinutes = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60);
  
  if (diffMinutes < threshold_minutes) {
    return {
      code: 'fast_consumption',
      message: `Napój dodany w czasie krótszym niż ${threshold_minutes} minut od poprzedniego (${Math.round(diffMinutes)} min)`,
      field: 'consumed_at',
      value: Math.round(diffMinutes)
    };
  }
  
  return null;
}
```

### Krok 8: Implementacja aktualizacji statystyk Party

**8.1 Update cached fields**

```typescript
async function updatePartyStatistics(
  supabase: SupabaseClient,
  partyId: number,
  drinkVolume: number,
  bacValue: number
): Promise<void> {
  // Use RPC for atomic update with increment
  await supabase.rpc('update_party_statistics', {
    p_party_id: partyId,
    p_volume_ml: drinkVolume,
    p_bac_value: bacValue
  });
  
  // Alternative: regular update query
  // const { data: currentParty } = await supabase
  //   .from('parties')
  //   .select('total_drinks_count, total_ml_consumed, bac_estimate_max')
  //   .eq('id', partyId)
  //   .single();
  
  // await supabase
  //   .from('parties')
  //   .update({
  //     total_drinks_count: (currentParty.total_drinks_count || 0) + 1,
  //     total_ml_consumed: (currentParty.total_ml_consumed || 0) + drinkVolume,
  //     bac_estimate_max: Math.max(currentParty.bac_estimate_max || 0, bacValue),
  //     updated_at: new Date().toISOString()
  //   })
  //   .eq('id', partyId);
}
```

**8.2 Database function (opcjonalnie, do migracji)**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_update_party_stats_function.sql
CREATE OR REPLACE FUNCTION update_party_statistics(
  p_party_id BIGINT,
  p_volume_ml INT,
  p_bac_value DECIMAL(4, 2)
)
RETURNS VOID AS $$
BEGIN
  UPDATE Parties
  SET
    total_drinks_count = COALESCE(total_drinks_count, 0) + 1,
    total_ml_consumed = COALESCE(total_ml_consumed, 0) + p_volume_ml,
    bac_estimate_max = GREATEST(COALESCE(bac_estimate_max, 0), p_bac_value),
    updated_at = NOW()
  WHERE id = p_party_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Krok 9: Testing

**Manual testing z Postman**
- Prepare test data (user, party, profile)
- Test happy path
- Test all error scenarios
- Test warning scenarios
- Verify BAC calculations
- Verify alerts creation

### Krok 10: Dokumentacja

**10.1 Code comments**
- JSDoc dla wszystkich public functions
- Inline comments dla złożonej logiki (np. Widmark formula)

**10.2 API documentation**
- Update OpenAPI spec (jeśli istnieje)
- Przykłady request/response w dokumentacji

**10.3 README updates**
- Dodać informacje o endpoint do API docs
- Dodać przykłady użycia

### Krok 11: Deployment checklist

- [ ] Wszystkie testy przechodzą
- [ ] Code review przeprowadzony
- [ ] Migracje bazy danych wykonane (jeśli potrzebne)
- [ ] Environment variables skonfigurowane
- [ ] Monitoring i logging skonfigurowane
- [ ] Rate limiting rozważone
- [ ] Security audit przeprowadzony
- [ ] Performance testing wykonane
- [ ] Dokumentacja zaktualizowana

## 10. Dodatkowe uwagi

### Transakcje bazodanowe

Rozważyć użycie transakcji Supabase dla zapewnienia atomowości operacji:

```typescript
const { data, error } = await supabase.rpc('add_drink_with_bac', {
  // Transaction zawierająca wszystkie operacje
});
```

### Error handling best practices

1. Zawsze używać try-catch dla operacji async
2. Logować szczegóły błędów serwera (500), ale nie ujawniać ich klientowi
3. Zwracać przyjazne komunikaty dla błędów klienckich (4xx)
4. Używać spójnych error codes w całym API

### Future enhancements

1. **Websockets**: Real-time updates dla alertów
2. **Push notifications**: Powiadomienia mobilne o alertach
3. **Analytics**: Dashboardy z statystykami konsumpcji
4. **ML predictions**: Predykcja BAC na podstawie wzorców
5. **Social features**: Dzielenie się statystykami z przyjaciółmi
6. **Export data**: Eksport historii do PDF/CSV

### Configuration values

Wartości do konfiguracji (env variables lub database config):
- `FAST_CONSUMPTION_THRESHOLD_MINUTES` (default: 15)
- `UNREALISTIC_VOLUME_ML` (default: 2000)
- `METABOLIZATION_RATE_G_PER_HOUR_PER_KG` (default: 0.15)
- `APPROACHING_THRESHOLD_MULTIPLIER` (default: 0.90)
- `ALERT_REPEAT_INTERVAL_MINUTES` (default: 5)
