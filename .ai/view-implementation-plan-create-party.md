# API Endpoint Implementation Plan: POST /api/parties

## 1. Przegląd punktu końcowego

Endpoint `POST /api/parties` służy do rozpoczynania nowej sesji imprezowej dla uwierzytelnionego użytkownika. Tworzy rekord imprezy ze statusem "ongoing" i wykonuje niezmienialny snapshot profilu użytkownika (wzrost, waga, płeć) w momencie startu. Endpoint zapewnia, że użytkownik ma tylko jedną aktywną imprezę naraz i wymaga kompletnego profilu użytkownika.

**User Story:** US-004 (Start Party Session)  
**Related Requirements:** US-018 (Profile Completeness Check)

---

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
/api/parties
```

### Headers
**Wymagane:**
- `Authorization: Bearer {access_token}` - Token JWT z Supabase Auth

### Parametry Query
Brak

### Request Body
```typescript
{
  "started_at"?: string // ISO 8601 timestamp (opcjonalny, domyślnie CURRENT_TIMESTAMP)
}
```

**Walidacja Request Body:**
- `started_at` (opcjonalne):
  - Musi być prawidłowym ISO 8601 timestamp
  - Nie może być w przyszłości
  - Jeśli nie podano, używany jest aktualny czas serwera

---

## 3. Wykorzystywane typy

### Command Models
```typescript
// Input validation
interface StartPartyCommand {
  started_at?: string;
}
```

### DTOs
```typescript
// Response
interface PartyDTO extends Omit<Party, "profile_snapshot" | "created_at" | "updated_at"> {
  profile_snapshot: ProfileSnapshot;
  created_at: string;
  updated_at: string;
}

// Snapshot profilu
interface ProfileSnapshot {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
  captured_at: string;
}

// Error response
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Database Entities
```typescript
// Do sprawdzenia kompletności
type UserProfile = Tables<"userprofiles">;
type Party = Tables<"parties">;
type EventType = Enums<"enum_event_type">;
```

---

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)
```json
{
  "id": 42,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2026-01-10T15:30:00.000Z",
  "ended_at": null,
  "status": "ongoing",
  "profile_snapshot": {
    "height_cm": 180,
    "weight_kg": 75.5,
    "gender": "M",
    "captured_at": "2026-01-10T15:30:00.000Z"
  },
  "bac_estimate_max": 0.00,
  "total_drinks_count": 0,
  "total_ml_consumed": 0,
  "blackout_marked": false,
  "blackout_marked_at": null,
  "created_at": "2026-01-10T15:30:00.123Z",
  "updated_at": "2026-01-10T15:30:00.123Z"
}
```

### Error Responses

#### 400 Bad Request - Nieprawidłowe dane wejściowe
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request data",
    "details": {
      "field": "started_at",
      "issue": "Timestamp cannot be in the future"
    }
  }
}
```

#### 400 Bad Request - Niekompletny profil
```json
{
  "error": {
    "code": "INCOMPLETE_PROFILE",
    "message": "User profile is incomplete. Please update your height, weight, and gender before starting a party.",
    "details": {
      "missing_fields": ["height_cm", "weight_kg", "gender"]
    }
  }
}
```

#### 401 Unauthorized - Brak lub nieprawidłowy token
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

#### 409 Conflict - Już trwa impreza
```json
{
  "error": {
    "code": "PARTY_ALREADY_ONGOING",
    "message": "You already have an ongoing party. Please close it before starting a new one.",
    "details": {
      "ongoing_party_id": 41,
      "started_at": "2026-01-10T14:00:00.000Z"
    }
  }
}
```

#### 500 Internal Server Error - Błąd serwera
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu:
```
1. Client → POST /api/parties (with Authorization header)
   ↓
2. Astro Middleware → Weryfikacja tokenu JWT (context.locals.supabase)
   ↓
3. API Route Handler → Walidacja request body (Zod schema)
   ↓
4. PartyService.startParty()
   ├─→ 4a. ProfileService.getUserProfile() → Sprawdź czy profil istnieje
   ├─→ 4b. ProfileService.isProfileComplete() → Sprawdź kompletność profilu
   ├─→ 4c. PartyService.hasOngoingParty() → Sprawdź czy jest aktywna impreza
   ├─→ 4d. PartyService.createProfileSnapshot() → Utwórz snapshot profilu
   ├─→ 4e. Supabase.insert() → Wstaw rekord do tabeli Parties
   └─→ 4f. logPartyStartedEvent() → Zapisz event
   ↓
5. Response Transformation → Konwersja do PartyDTO
   ↓
6. Client ← 201 Created (PartyDTO)
```

### Szczegółowy przepływ:

#### Krok 1: Middleware - Autentykacja
- Middleware Astro (`src/middleware/index.ts`) weryfikuje token JWT
- Tworzy/odświeża sesję Supabase w `context.locals.supabase`
- Ekstrahuje `user_id` z tokenu do `context.locals.user`

#### Krok 2: Walidacja wejścia
```typescript
const startPartySchema = z.object({
  started_at: z.string().datetime().optional()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      const now = new Date();
      return date <= now;
    }, "Timestamp cannot be in the future")
});
```

#### Krok 3: Business Logic w Service Layer

**PartyService.startParty(userId, startedAt?):**
1. Pobierz profil użytkownika przez ProfileService
2. Sprawdź kompletność profilu (height_cm, weight_kg, gender NOT NULL)
3. Sprawdź czy użytkownik ma już aktywną imprezę (status='ongoing')
4. Utwórz snapshot profilu z aktualnym timestampem
5. Wykonaj INSERT do tabeli Parties z:
   - `user_id`: z tokenu JWT
   - `started_at`: z request lub CURRENT_TIMESTAMP
   - `status`: 'ongoing'
   - `profile_snapshot`: JSONB snapshot
   - `bac_estimate_max`: 0.00
   - `total_drinks_count`: 0
   - `total_ml_consumed`: 0
   - `blackout_marked`: false
6. Zaloguj event 'party_started' do tabeli Events
7. Zwróć utworzony rekord Party

#### Krok 4: Response Transformation
- Konwersja timestamp-ów do ISO 8601 string
- Parsowanie `profile_snapshot` JSONB do obiektu TypeScript
- Mapowanie do typu PartyDTO

---

## 6. Względy bezpieczeństwa

### Autentykacja
- **Mechanizm:** JWT Bearer token z Supabase Auth
- **Implementacja:** Middleware Astro weryfikuje token i ustawia `context.locals.user`
- **Timeout:** Token ma określony czas życia (controlled by Supabase)
- **Refresh:** Client odpowiedzialny za odświeżanie tokenu

### Autoryzacja
- **RLS Policies:** Tabela `Parties` ma włączone Row Level Security
- **Policy:** Użytkownik może tworzyć imprezy tylko dla siebie (`user_id = auth.uid()`)
- **Denormalizacja:** `user_id` w tabeli Parties dla efektywnych RLS checks

### Walidacja danych
- **Schema Validation:** Zod schema dla request body
- **SQL Injection Prevention:** Supabase client używa parametryzowanych zapytań
- **XSS Prevention:** Brak user-generated content w response (tylko dane z bazy)
- **Input Sanitization:** Timestamp walidowany przez Zod (ISO 8601 format)

### Rate Limiting
- **Recommendation:** Implementacja rate limiting na poziomie middleware lub API Gateway
- **Limit:** Np. 10 requests/minute per user dla POST /api/parties
- **Response:** 429 Too Many Requests z `Retry-After` header

### CORS
- **Configuration:** Astro CORS settings dla production domain
- **Development:** Lokalne API tylko dla localhost

### Secrets Management
- **Environment Variables:** Supabase URL i anon key w `import.meta.env`
- **Never expose:** Service role key nigdy nie używany w frontend/API routes

---

## 7. Obsługa błędów

### Hierarchia obsługi błędów:

#### 1. Middleware Level (401)
```typescript
// Middleware sprawdza autentykację
if (!context.locals.user) {
  return new Response(JSON.stringify({
    error: {
      code: "UNAUTHORIZED",
      message: "Missing or invalid authentication token"
    }
  }), { status: 401 });
}
```

#### 2. Validation Level (400)
```typescript
// Zod validation errors
try {
  const validated = startPartySchema.parse(await request.json());
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.warn("Validation failed for POST /api/parties", { errors: error.errors });
    return new Response(JSON.stringify({
      error: {
        code: "INVALID_INPUT",
        message: "Invalid request data",
        details: error.errors
      }
    }), { status: 400 });
  }
}
```

#### 3. Business Logic Level (400, 409)
```typescript
// Incomplete profile
if (!isProfileComplete(profile)) {
  logger.info("User attempted to start party with incomplete profile", { userId });
  return new Response(JSON.stringify({
    error: {
      code: "INCOMPLETE_PROFILE",
      message: "User profile is incomplete. Please update your height, weight, and gender before starting a party.",
      details: { missing_fields: getMissingFields(profile) }
    }
  }), { status: 400 });
}

// Ongoing party conflict
if (await hasOngoingParty(userId)) {
  logger.info("User attempted to start party while one is already ongoing", { userId });
  const ongoingParty = await getOngoingParty(userId);
  return new Response(JSON.stringify({
    error: {
      code: "PARTY_ALREADY_ONGOING",
      message: "You already have an ongoing party. Please close it before starting a new one.",
      details: {
        ongoing_party_id: ongoingParty.id,
        started_at: ongoingParty.started_at
      }
    }
  }), { status: 409 });
}
```

#### 4. Database Level (500)
```typescript
try {
  const { data, error } = await supabase
    .from("parties")
    .insert(partyData)
    .select()
    .single();
    
  if (error) {
    logger.error("Database error when creating party", { error, userId });
    throw error;
  }
} catch (error) {
  logger.error("Unexpected error in POST /api/parties", { error, userId });
  return new Response(JSON.stringify({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later."
    }
  }), { status: 500 });
}
```

### Logging Strategy
- **Level INFO:** Successful operations, business rule violations (non-errors)
- **Level WARN:** Validation failures, recoverable errors
- **Level ERROR:** Database errors, unexpected exceptions, system failures
- **Context:** Zawsze dołączaj `userId`, `partyId` (jeśli dostępny), timestamp

### Error Response Format
Wszystkie błędy zwracają konsystentną strukturę:
```typescript
{
  error: {
    code: string,        // Machine-readable error code
    message: string,     // Human-readable error message
    details?: object     // Optional additional context
  }
}
```

---

## 8. Rozważania dotyczące wydajności

### Database Queries
- **Single Transaction:** Całość operacji (check profile, check ongoing party, insert) w jednej transakcji
- **Index Usage:** 
  - Index na `userprofiles.user_id` (unique) - O(1) lookup
  - Index na `parties.user_id` i `parties.status` - szybkie sprawdzenie ongoing party
- **Query Optimization:** 
  - SELECT only needed fields
  - Use `.single()` dla oczekiwanych pojedynczych rekordów

### N+1 Query Prevention
- **Profile Check:** Jeden query do UserProfiles
- **Ongoing Party Check:** Jeden query z WHERE user_id AND status='ongoing'
- **Insert:** Pojedynczy INSERT z RETURNING clause

### Caching
- **Profile Data:** Rozważyć cache profilu użytkownika w Redis (ttl: 5 min)
- **Ongoing Party Check:** Możliwy cache z invalidation przy close party
- **Implementation:** Opcjonalne, dependency na traffic volume

### Response Time Targets
- **Target:** < 200ms dla 95th percentile
- **Acceptable:** < 500ms dla 99th percentile
- **Monitoring:** Application Performance Monitoring (APM) tool

### Connection Pooling
- **Supabase Client:** Używa connection pooling out-of-the-box
- **Configuration:** Default settings są wystarczające dla MVP

### Payload Size
- **Request:** Minimalny (opcjonalny timestamp tylko)
- **Response:** ~500 bytes (Party DTO z snapshot)
- **Optimization:** Brak potrzeby kompresji dla tak małych payload-ów

### Concurrent Requests
- **Race Condition:** Możliwe przy równoczesnych POST requests od tego samego użytkownika
- **Mitigation:** 
  - Database constraint: UNIQUE index on (user_id, status) WHERE status='ongoing'
  - Aplikacja zwraca 409 gdy constraint violation

---

## 9. Etapy wdrożenia

### Krok 1: Utworzenie Zod Schema dla walidacji
**Plik:** `src/lib/validation/party.validation.ts`
```typescript
import { z } from "zod";

export const startPartySchema = z.object({
  started_at: z.string().datetime().optional()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      const now = new Date();
      return date <= now;
    }, "Timestamp cannot be in the future")
});

export type StartPartyInput = z.infer<typeof startPartySchema>;
```

### Krok 2: Rozszerzenie ProfileService o funkcje pomocnicze
**Plik:** `src/lib/services/profile.service.ts`
```typescript
// Dodać nowe funkcje:

export async function isProfileComplete(
  profile: UserProfile | null
): boolean {
  if (!profile) return false;
  return (
    profile.height_cm !== null &&
    profile.weight_kg !== null &&
    profile.gender !== null
  );
}

export function getMissingFields(
  profile: UserProfile | null
): string[] {
  if (!profile) return ["height_cm", "weight_kg", "gender"];
  const missing: string[] = [];
  if (profile.height_cm === null) missing.push("height_cm");
  if (profile.weight_kg === null) missing.push("weight_kg");
  if (profile.gender === null) missing.push("gender");
  return missing;
}
```

### Krok 3: Utworzenie PartyService
**Plik:** `src/lib/services/party.service.ts`
```typescript
import type { SupabaseClient } from "../db/supabase.client";
import type { PartyDTO, ProfileSnapshot } from "../../types";
import { getUserProfile } from "./profile.service";

export async function hasOngoingParty(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check ongoing party: ${error.message}`);
  }

  return data !== null;
}

export async function getOngoingParty(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("parties")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .single();

  if (error) {
    throw new Error(`Failed to get ongoing party: ${error.message}`);
  }

  return data;
}

export function createProfileSnapshot(
  profile: { height_cm: number; weight_kg: number; gender: string }
): ProfileSnapshot {
  return {
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    gender: profile.gender as "M" | "F",
    captured_at: new Date().toISOString()
  };
}

export async function startParty(
  supabase: SupabaseClient,
  userId: string,
  startedAt?: string
): Promise<PartyDTO> {
  // Get and validate user profile
  const profile = await getUserProfile(supabase, userId);
  if (!profile) {
    throw new Error("User profile not found");
  }

  // Check if profile is complete
  const { isProfileComplete, getMissingFields } = await import("./profile.service");
  if (!isProfileComplete(profile)) {
    const missing = getMissingFields(profile);
    throw new Error(`INCOMPLETE_PROFILE:${JSON.stringify(missing)}`);
  }

  // Check for ongoing party
  if (await hasOngoingParty(supabase, userId)) {
    const ongoingParty = await getOngoingParty(supabase, userId);
    throw new Error(`PARTY_ALREADY_ONGOING:${JSON.stringify(ongoingParty)}`);
  }

  // Create profile snapshot
  const profileSnapshot = createProfileSnapshot(profile);

  // Insert party
  const { data, error } = await supabase
    .from("parties")
    .insert({
      user_id: userId,
      started_at: startedAt || new Date().toISOString(),
      status: "ongoing",
      profile_snapshot: profileSnapshot,
      bac_estimate_max: 0.00,
      total_drinks_count: 0,
      total_ml_consumed: 0,
      blackout_marked: false
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create party: ${error.message}`);
  }

  // Log event
  await logPartyStartedEvent(supabase, userId, data.id);

  return data as PartyDTO;
}

async function logPartyStartedEvent(
  supabase: SupabaseClient,
  userId: string,
  partyId: number
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      party_id: partyId,
      event_type: "party_started"
    });

  if (error) {
    // Log but don't throw - event logging failure shouldn't break party creation
    console.error("Failed to log party_started event:", error);
  }
}
```

### Krok 4: Utworzenie API Route Handler
**Plik:** `src/pages/api/parties.ts`
```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { startPartySchema } from "../../lib/validation/party.validation";
import { startParty } from "../../lib/services/party.service";
import { logger } from "../../lib/logger";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Check authentication
  const supabase = locals.supabase;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    logger.warn("Unauthorized access attempt to POST /api/parties");
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

  const userId = session.user.id;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = startPartySchema.parse(body);

    // Start party
    const party = await startParty(
      supabase,
      userId,
      validated.started_at
    );

    logger.info("Party started successfully", {
      userId,
      partyId: party.id
    });

    return new Response(JSON.stringify(party), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    // Zod validation errors
    if (error instanceof z.ZodError) {
      logger.warn("Validation failed for POST /api/parties", {
        userId,
        errors: error.errors
      });
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request data",
            details: error.errors
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Business logic errors
    if (error instanceof Error) {
      // Incomplete profile
      if (error.message.startsWith("INCOMPLETE_PROFILE:")) {
        const missing = JSON.parse(error.message.split(":")[1]);
        logger.info("User attempted to start party with incomplete profile", {
          userId,
          missingFields: missing
        });
        return new Response(
          JSON.stringify({
            error: {
              code: "INCOMPLETE_PROFILE",
              message: "User profile is incomplete. Please update your height, weight, and gender before starting a party.",
              details: { missing_fields: missing }
            }
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Ongoing party conflict
      if (error.message.startsWith("PARTY_ALREADY_ONGOING:")) {
        const ongoingParty = JSON.parse(error.message.split(":")[1]);
        logger.info("User attempted to start party while one is already ongoing", {
          userId,
          ongoingPartyId: ongoingParty.id
        });
        return new Response(
          JSON.stringify({
            error: {
              code: "PARTY_ALREADY_ONGOING",
              message: "You already have an ongoing party. Please close it before starting a new one.",
              details: {
                ongoing_party_id: ongoingParty.id,
                started_at: ongoingParty.started_at
              }
            }
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    // Generic error
    logger.error("Unexpected error in POST /api/parties", {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later."
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

### Krok 5: Weryfikacja middleware autentykacji
**Plik:** `src/middleware/index.ts`

- Upewnić się, że middleware ustawia `context.locals.supabase`
- Middleware powinien tworzyć Supabase client z cookies
- Sesja użytkownika będzie sprawdzana w route handlerze

**Przykładowa implementacja middleware:**
```typescript
// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key) => context.cookies.get(key)?.value,
        set: (key, value, options) => {
          context.cookies.set(key, value, options);
        },
        remove: (key, options) => {
          context.cookies.delete(key, options);
        }
      }
    }
  );

  context.locals.supabase = supabase;

  return next();
});
```

### Krok 6: Dodanie typów do types.ts (jeśli brakuje)
**Plik:** `src/types.ts`
```typescript
// Sprawdzić czy StartPartyCommand jest zdefiniowane
// Jeśli nie, dodać:
export interface StartPartyCommand {
  started_at?: string;
}
```

### Krok 7: Testy manualne
1. Test authentication:
   - Request bez Authorization header → 401 UNAUTHORIZED
   - Request z nieprawidłowym tokenem → 401 UNAUTHORIZED
   - Request z wygasałym tokenem → 401 UNAUTHORIZED
   - Request z prawidłowym tokenem → Success/Business error

2. Test incomplete profile:
   - Użytkownik bez profilu → 400 INCOMPLETE_PROFILE
   - Użytkownik z brakującymi polami → 400 INCOMPLETE_PROFILE

3. Test ongoing party conflict:
   - Użytkownik z aktywną imprezą → 409 PARTY_ALREADY_ONGOING

4. Test happy path:
   - Użytkownik z kompletnym profilem, bez aktywnej imprezy → 201 Created
   - Sprawdzić czy snapshot profilu jest poprawny
   - Sprawdzić czy event został zalogowany

5. Test started_at validation:
   - Brak started_at → używa current timestamp
   - started_at w przyszłości → 400 INVALID_INPUT
   - started_at prawidłowy → 201 Created

### Krok 8: Monitoring i logging
- Dodać metryki APM dla response time
- Skonfigurować alerty dla error rate > 5%
- Monitorować database query performance

---

## 10. Checklist przed deploy

- [ ] Zod schema utworzone i przetestowane
- [ ] ProfileService rozszerzone o isProfileComplete() i getMissingFields()
- [ ] PartyService utworzone ze wszystkimi funkcjami
- [ ] API route handler implementuje wszystkie error cases
- [ ] Middleware autentykacji działa poprawnie
- [ ] Testy manualne przeszły pomyślnie
- [ ] Logging skonfigurowany na wszystkich poziomach
- [ ] RLS policies włączone na tabeli Parties
- [ ] Database indexes utworzone (user_id, status)
- [ ] Environment variables skonfigurowane
- [ ] Error messages są user-friendly
- [ ] Response structure zgodna ze specyfikacją
- [ ] Performance metrics skonfigurowane

---

## 11. Future Enhancements

1. **Rate Limiting:** Implementacja per-user rate limiting na poziomie middleware
2. **Caching:** Redis cache dla profili użytkowników
3. **Batch Operations:** Możliwość tworzenia party z pierwszym drinkiem w jednym requescie
4. **Webhooks:** Notyfikacje webhook przy tworzeniu party dla integracji zewnętrznych
5. **Analytics:** Szczegółowa telemetria czasu rozpoczynania imprez (dzień tygodnia, godzina)
