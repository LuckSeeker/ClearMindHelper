# API Endpoint Implementation Plan: Update User Profile

## 1. Przegląd punktu końcowego

Endpoint `PUT /api/profile` umożliwia utworzenie lub aktualizację profilu użytkownika z danymi fizycznymi niezbędnymi do obliczeń BAC (Blood Alcohol Content). Jest to operacja typu **upsert** - jeśli profil nie istnieje, zostaje utworzony; jeśli istnieje, zostaje zaktualizowany.

**Funkcjonalność:**
- Tworzenie nowego profilu użytkownika
- Aktualizacja istniejącego profilu użytkownika
- Walidacja danych fizycznych (wzrost, waga, płeć)
- Automatyczne obliczanie pola `is_complete`
- Aktualizacja timestampu `updated_at`

**Odpowiada User Stories:**
- US-003: Rejestracja danych osobowych
- US-018: Walidacja kompletności profilu

---

## 2. Szczegóły żądania

### Metoda HTTP
`PUT`

### Struktura URL
```
/api/profile
```

### Nagłówki
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Request Body
```typescript
{
  height_cm: number,      // Required: 50-250
  weight_kg: number,      // Required: 30-300
  gender: "M" | "F"       // Required: M lub F
}
```

### Parametry

**Wymagane:**
- `height_cm` (integer): Wzrost użytkownika w centymetrach
  - Zakres: 50-250 cm
  - Walidacja: zgodna z CHECK constraint w bazie danych
  
- `weight_kg` (number/decimal): Waga użytkownika w kilogramach
  - Zakres: 30-300 kg
  - Precyzja: 2 miejsca po przecinku (DECIMAL(5,2))
  - Walidacja: zgodna z CHECK constraint w bazie danych
  
- `gender` (string): Płeć użytkownika
  - Dozwolone wartości: 'M' (mężczyzna) lub 'F' (kobieta)
  - Walidacja: zgodna z ENUM_GENDER w bazie danych

**Opcjonalne:**
- Brak

---

## 3. Wykorzystywane typy

### Command Model (Request)
```typescript
// src/types.ts
export interface UpdateUserProfileCommand {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
}
```

### Response DTO
```typescript
// src/types.ts
export interface UserProfileDTO extends Omit<UserProfile, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
  is_complete: boolean;  // Computed field
}
```

### Entity Type
```typescript
// src/types.ts
export type UserProfile = Tables<"userprofiles">;
export type Gender = Enums<"enum_gender">;
```

### Zod Schema (do walidacji)
```typescript
import { z } from "zod";

const UpdateProfileSchema = z.object({
  height_cm: z.number()
    .int({ message: "Height must be an integer" })
    .min(50, { message: "Height must be at least 50 cm" })
    .max(250, { message: "Height must not exceed 250 cm" }),
  
  weight_kg: z.number()
    .min(30, { message: "Weight must be at least 30 kg" })
    .max(300, { message: "Weight must not exceed 300 kg" }),
  
  gender: z.enum(["M", "F"], {
    errorMap: () => ({ message: "Gender must be 'M' or 'F'" })
  })
});
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)
```json
{
  "id": 12345,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "height_cm": 175,
  "weight_kg": 70.5,
  "gender": "M",
  "created_at": "2026-01-10T12:00:00Z",
  "updated_at": "2026-01-10T12:30:00Z",
  "is_complete": true
}
```

**Typ odpowiedzi:** `UserProfileDTO`

**Pola:**
- `id`: Wewnętrzny identyfikator profilu (bigint)
- `user_id`: UUID użytkownika z Supabase Auth
- `height_cm`: Wzrost w cm
- `weight_kg`: Waga w kg
- `gender`: Płeć ('M' lub 'F')
- `created_at`: Timestamp utworzenia profilu (ISO 8601)
- `updated_at`: Timestamp ostatniej aktualizacji (ISO 8601)
- `is_complete`: Boolean - true jeśli wszystkie wymagane pola są wypełnione

### Error Responses

**400 Bad Request** - Nieprawidłowe dane wejściowe
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "height_cm",
      "message": "Height must be at least 50 cm"
    }
  ]
}
```

**401 Unauthorized** - Brak lub nieprawidłowy token
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authentication token"
}
```

**500 Internal Server Error** - Błąd serwera
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## 5. Przepływ danych

### Diagram przepływu:

```
1. Client Request
   ↓
2. Astro Middleware (src/middleware/index.ts)
   - Sprawdzenie tokena Authorization
   - Pobranie sesji z Supabase
   - Dodanie supabase client do context.locals
   ↓
3. API Endpoint Handler (src/pages/api/profile.ts)
   - Weryfikacja metody HTTP (PUT)
   - Parsowanie request body
   - Walidacja Zod schema
   ↓
4. Service Layer (src/lib/services/profile.service.ts)
   - Pobranie user_id z sesji
   - Operacja upsert na tabeli UserProfiles
   - Obliczenie is_complete
   ↓
5. Supabase Database
   - Wykonanie INSERT lub UPDATE
   - Sprawdzenie CHECK constraints
   - Automatyczna aktualizacja updated_at (trigger)
   ↓
6. Response Transformation
   - Konwersja timestamps na ISO 8601
   - Dodanie computed field is_complete
   - Zwrócenie UserProfileDTO
   ↓
7. Client Response (200 OK)
```

### Szczegółowy przepływ:

**1. Authentication Check (Middleware)**
```typescript
// src/middleware/index.ts
const session = await supabase.auth.getSession();
if (!session.data.session) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401
  });
}
context.locals.supabase = supabase;
context.locals.userId = session.data.session.user.id;
```

**2. Request Validation (Endpoint)**
```typescript
// src/pages/api/profile.ts
const body = await request.json();
const validationResult = UpdateProfileSchema.safeParse(body);
if (!validationResult.success) {
  return new Response(JSON.stringify({
    error: "Validation failed",
    details: validationResult.error.errors
  }), { status: 400 });
}
```

**3. Business Logic (Service)**
```typescript
// src/lib/services/profile.service.ts
const upsertedProfile = await supabase
  .from("userprofiles")
  .upsert({
    user_id: userId,
    height_cm: data.height_cm,
    weight_kg: data.weight_kg,
    gender: data.gender,
    updated_at: new Date().toISOString()
  }, {
    onConflict: "user_id"
  })
  .select()
  .single();
```

**4. Response Transformation**
```typescript
const profileDTO: UserProfileDTO = {
  ...upsertedProfile.data,
  is_complete: Boolean(
    upsertedProfile.data.height_cm &&
    upsertedProfile.data.weight_kg &&
    upsertedProfile.data.gender
  )
};
```

---

## 6. Względy bezpieczeństwa

### 1. Autoryzacja i uwierzytelnianie

**Supabase Auth:**
- Użycie Bearer token z nagłówka `Authorization`
- Walidacja tokena przez Supabase SDK
- Automatyczne sprawdzenie sesji w middleware

**User Isolation:**
- Każdy użytkownik może modyfikować tylko swój profil
- `user_id` pobierany z sesji, nie z request body
- Brak możliwości edycji profilu innego użytkownika

**RLS (Row Level Security):**
```sql
-- Policy dla UserProfiles (przykład)
CREATE POLICY "Users can only access their own profile"
ON UserProfiles
FOR ALL
USING (auth.uid() = user_id);
```

### 2. Walidacja danych wejściowych

**Schema Validation:**
- Wszystkie dane walidowane przez Zod przed zapisem
- Type safety zapewniony przez TypeScript
- Zgodność z CHECK constraints w bazie danych

**SQL Injection Prevention:**
- Używanie Supabase SDK (parametryzowane zapytania)
- Brak raw SQL queries
- Automatyczna sanityzacja danych przez ORM

### 3. Rate Limiting

**Rekomendacje:**
- Implementacja rate limiting na poziomie middleware
- Limit: np. 10 requestów/minutę na użytkownika
- Monitoring nadmiernych requestów

### 4. Data Privacy

**GDPR Compliance:**
- Dane wrażliwe (waga, wzrost, płeć)
- Kaskadowe usuwanie przy usunięciu konta (ON DELETE CASCADE)
- Logowanie operacji w tabeli Events (opcjonalnie)

### 5. HTTPS Only

- Wymagane połączenie HTTPS w produkcji
- Konfiguracja w astro.config.mjs
- Przekierowanie HTTP → HTTPS na poziomie hostingu

---

## 7. Obsługa błędów

### Kategorie błędów i ich obsługa:

#### 1. Authentication Errors (401 Unauthorized)

**Scenariusze:**
- Brak nagłówka `Authorization`
- Nieprawidłowy format tokena
- Wygasły token
- Token nie należy do aktywnej sesji

**Obsługa:**
```typescript
if (!session?.data?.session) {
  logger.warn("Unauthorized access attempt to /api/profile");
  return new Response(JSON.stringify({
    error: "Unauthorized",
    message: "Missing or invalid authentication token"
  }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
```

#### 2. Validation Errors (400 Bad Request)

**Scenariusze:**
- Brak wymaganych pól
- Wartości poza dozwolonymi zakresami
- Nieprawidłowy typ danych
- Nieprawidłowa wartość gender

**Przykłady błędów:**
```json
// height_cm < 50
{
  "error": "Validation failed",
  "details": [
    {
      "field": "height_cm",
      "message": "Height must be at least 50 cm",
      "code": "too_small"
    }
  ]
}

// gender nie jest 'M' ani 'F'
{
  "error": "Validation failed",
  "details": [
    {
      "field": "gender",
      "message": "Gender must be 'M' or 'F'",
      "code": "invalid_enum_value"
    }
  ]
}

// weight_kg > 300
{
  "error": "Validation failed",
  "details": [
    {
      "field": "weight_kg",
      "message": "Weight must not exceed 300 kg",
      "code": "too_big"
    }
  ]
}
```

**Obsługa:**
```typescript
const validationResult = UpdateProfileSchema.safeParse(body);
if (!validationResult.success) {
  const formattedErrors = validationResult.error.errors.map(err => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code
  }));
  
  logger.warn("Validation failed for profile update", {
    userId,
    errors: formattedErrors
  });
  
  return new Response(JSON.stringify({
    error: "Validation failed",
    details: formattedErrors
  }), { status: 400 });
}
```

#### 3. Database Errors (500 Internal Server Error)

**Scenariusze:**
- Błąd połączenia z bazą danych
- Naruszenie CHECK constraint (backup dla walidacji Zod)
- Timeout zapytania
- Nieoczekiwany błąd Supabase

**Obsługa:**
```typescript
try {
  const result = await profileService.upsertProfile(userId, validatedData);
  // ...
} catch (error) {
  logger.error("Failed to upsert user profile", {
    userId,
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined
  });
  
  return new Response(JSON.stringify({
    error: "Internal server error",
    message: "Failed to update profile. Please try again later."
  }), { status: 500 });
}
```

#### 4. Invalid JSON (400 Bad Request)

**Scenariusz:**
- Nieprawidłowy format JSON w request body

**Obsługa:**
```typescript
let body;
try {
  body = await request.json();
} catch (error) {
  logger.warn("Invalid JSON in request body");
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid JSON format"
  }), { status: 400 });
}
```

### Logging Strategy

**Winston Logger (src/lib/logger.ts):**
```typescript
// Info level - successful operations
logger.info("Profile updated successfully", { userId, profileId });

// Warn level - validation failures, unauthorized attempts
logger.warn("Validation failed", { userId, errors });

// Error level - server errors, database failures
logger.error("Database error", { userId, error: error.message });
```

---

## 8. Rozważania dotyczące wydajności

### 1. Database Performance

**Optymalizacje:**
- **Index na user_id**: Tabela UserProfiles ma UNIQUE constraint na `user_id`, co automatycznie tworzy index
- **Upsert zamiast SELECT + INSERT/UPDATE**: Pojedyncze zapytanie zamiast dwóch
- **SELECT .single()**: Zwracanie pojedynczego rekordu bezpośrednio

**Potencjalne wąskie gardła:**
- Brak - operacja upsert na pojedynczym rekordzie jest bardzo szybka
- Index na user_id zapewnia O(log n) lookup time

### 2. Network Performance

**Request Size:**
- Minimalny payload (~50-100 bytes JSON)
- Brak potrzeby kompresji dla tak małych danych

**Response Size:**
- ~200-300 bytes JSON
- Bardzo szybki transfer

### 3. Caching

**Strategy:**
- **Brak cache'owania na serwerze** - dane zmieniają się rzadko, ale muszą być zawsze aktualne
- **Client-side caching**: Frontend może cache'ować profil lokalnie i odświeżać tylko przy edycji

**SWR Pattern (dla frontendu):**
```typescript
// Przykład użycia w React
const { data: profile } = useSWR('/api/profile', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000 // 1 minuta
});
```

### 4. Connection Pooling

**Supabase SDK:**
- Automatyczne zarządzanie connection poolem
- Reużycie połączeń HTTP/2
- Brak potrzeby manualnej konfiguracji

### 5. Concurrent Requests

**Race Conditions:**
- **Problem**: Użytkownik wysyła kilka requestów jednocześnie
- **Rozwiązanie**: Database UNIQUE constraint na user_id + ostatni update wygrywa
- **Mitigacja na frontendzie**: Debouncing, disabled state podczas zapisywania

### 6. Monitoring Metrics

**Kluczowe metryki:**
- Średni czas odpowiedzi (target: <100ms)
- Rate błędów 4xx i 5xx
- Liczba requestów/minutę
- Database query time

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury plików

**1.1. Sprawdzenie istniejącej struktury:**
```bash
# Weryfikacja istnienia plików
ls src/lib/services/profile.service.ts
ls src/lib/logger.ts
ls src/types.ts
ls src/db/supabase.client.ts
```

**1.2. Utworzenie endpointu (jeśli nie istnieje):**
```bash
touch src/pages/api/profile.ts
```

### Krok 2: Implementacja walidacji Zod

**2.1. Utworzenie schema walidacji w osobnym pliku (opcjonalnie):**
```typescript
// src/lib/validation/profile.validation.ts
import { z } from "zod";

export const UpdateProfileSchema = z.object({
  height_cm: z.number()
    .int({ message: "Height must be an integer" })
    .min(50, { message: "Height must be at least 50 cm" })
    .max(250, { message: "Height must not exceed 250 cm" }),
  
  weight_kg: z.number()
    .min(30, { message: "Weight must be at least 30 kg" })
    .max(300, { message: "Weight must not exceed 300 kg" }),
  
  gender: z.enum(["M", "F"], {
    errorMap: () => ({ message: "Gender must be 'M' or 'F'" })
  })
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
```

### Krok 3: Implementacja service layer

**3.1. Rozszerzenie lub utworzenie profile.service.ts:**
```typescript
// src/lib/services/profile.service.ts
import type { SupabaseClient } from "../db/supabase.client";
import type { UpdateUserProfileCommand, UserProfileDTO } from "../../types";
import { logger } from "../logger";

export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Creates or updates user profile
   * @param userId - Authenticated user ID from session
   * @param data - Profile data to upsert
   * @returns UserProfileDTO with is_complete computed field
   */
  async upsertProfile(
    userId: string,
    data: UpdateUserProfileCommand
  ): Promise<UserProfileDTO> {
    try {
      const { data: profile, error } = await this.supabase
        .from("userprofiles")
        .upsert(
          {
            user_id: userId,
            height_cm: data.height_cm,
            weight_kg: data.weight_kg,
            gender: data.gender,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "user_id"
          }
        )
        .select()
        .single();

      if (error) {
        logger.error("Failed to upsert profile", {
          userId,
          error: error.message
        });
        throw new Error(`Database error: ${error.message}`);
      }

      // Transform to DTO with computed is_complete field
      const profileDTO: UserProfileDTO = {
        id: profile.id,
        user_id: profile.user_id,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        gender: profile.gender,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        is_complete: Boolean(
          profile.height_cm &&
          profile.weight_kg &&
          profile.gender
        )
      };

      logger.info("Profile upserted successfully", {
        userId,
        profileId: profile.id
      });

      return profileDTO;
    } catch (error) {
      logger.error("Unexpected error in upsertProfile", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Gets user profile
   * @param userId - Authenticated user ID
   * @returns UserProfileDTO or null if not found
   */
  async getProfile(userId: string): Promise<UserProfileDTO | null> {
    try {
      const { data: profile, error } = await this.supabase
        .from("userprofiles")
        .select()
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found
          return null;
        }
        logger.error("Failed to get profile", {
          userId,
          error: error.message
        });
        throw new Error(`Database error: ${error.message}`);
      }

      const profileDTO: UserProfileDTO = {
        id: profile.id,
        user_id: profile.user_id,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        gender: profile.gender,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        is_complete: Boolean(
          profile.height_cm &&
          profile.weight_kg &&
          profile.gender
        )
      };

      return profileDTO;
    } catch (error) {
      logger.error("Unexpected error in getProfile", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }
}
```

### Krok 4: Implementacja API endpoint

**4.1. Implementacja src/pages/api/profile.ts:**
```typescript
// src/pages/api/profile.ts
import type { APIRoute } from "astro";
import { UpdateProfileSchema } from "../../lib/validation/profile.validation";
import { ProfileService } from "../../lib/services/profile.service";
import { logger } from "../../lib/logger";

export const prerender = false;

export const PUT: APIRoute = async ({ request, locals }) => {
  // 1. Check authentication
  const supabase = locals.supabase;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    logger.warn("Unauthorized access attempt to PUT /api/profile");
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Missing or invalid authentication token"
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const userId = session.user.id;

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn("Invalid JSON in request body", { userId });
    return new Response(
      JSON.stringify({
        error: "Bad Request",
        message: "Invalid JSON format"
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // 3. Validate input
  const validationResult = UpdateProfileSchema.safeParse(body);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code
    }));

    logger.warn("Validation failed for profile update", {
      userId,
      errors: formattedErrors
    });

    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: formattedErrors
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // 4. Execute business logic
  try {
    const profileService = new ProfileService(supabase);
    const updatedProfile = await profileService.upsertProfile(
      userId,
      validationResult.data
    );

    logger.info("Profile updated successfully", {
      userId,
      profileId: updatedProfile.id
    });

    return new Response(JSON.stringify(updatedProfile), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    logger.error("Failed to update profile", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to update profile. Please try again later."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// Optional: Implement GET endpoint for retrieving profile
export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    logger.warn("Unauthorized access attempt to GET /api/profile");
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Missing or invalid authentication token"
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const userId = session.user.id;

  try {
    const profileService = new ProfileService(supabase);
    const profile = await profileService.getProfile(userId);

    if (!profile) {
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Profile not found"
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    logger.error("Failed to get profile", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to retrieve profile"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
```

### Krok 5: Weryfikacja middleware

**5.1. Sprawdzenie src/middleware/index.ts:**
- Upewnić się, że middleware dodaje `supabase` client do `locals`
- Weryfikacja, że sesja jest sprawdzana i dostępna

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

### Krok 7: Dokumentacja API

**7.1. Aktualizacja api-plan.md:**
- Potwierdzić zgodność implementacji ze specyfikacją
- Dodać przykłady curl/fetch

**7.2. Dodanie JSDoc do service methods:**
- Komentarze opisujące parametry i return values
- Przykłady użycia

### Krok 8: Monitoring i logging

**8.1. Konfiguracja Winston logger:**
```typescript
// src/lib/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: import.meta.env.PROD ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  ]
});
```

**8.2. Dodanie metryk:**
- Czas wykonania requestów
- Liczba błędów walidacji
- Liczba błędów bazy danych

### Krok 9: Bezpieczeństwo

**9.1. Weryfikacja RLS policies w Supabase:**
```sql
-- Sprawdzenie policies dla UserProfiles
SELECT * FROM pg_policies WHERE tablename = 'userprofiles';

-- Dodanie policy jeśli nie istnieje
CREATE POLICY "Users can only access their own profile"
ON userprofiles
FOR ALL
USING (auth.uid() = user_id);
```

**9.2. Rate limiting (opcjonalnie):**
```typescript
// src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

export const profileRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuta
  max: 10, // max 10 requestów
  message: "Too many requests, please try again later"
});
```

### Krok 10: Deployment

**10.1. Zmienne środowiskowe:**
```env
PUBLIC_SUPABASE_URL=your-supabase-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**10.2. Build i deployment:**
```bash
npm run build
npm run preview
# Deploy do DigitalOcean
```

**10.3. Post-deployment verification:**
- Test endpointu w środowisku produkcyjnym
- Weryfikacja logów
- Monitoring metryk

---

## 10. Checklist przed wdrożeniem

### Code Quality
- [ ] Kod zgodny z TypeScript strict mode
- [ ] Wszystkie typy zdefiniowane (brak `any`)
- [ ] ESLint bez błędów
- [ ] Prettier formatting applied

### Security
- [ ] RLS policies skonfigurowane w Supabase
- [ ] Token validation w middleware
- [ ] Input validation przez Zod
- [ ] HTTPS wymuszony w produkcji

### Testing
- [ ] Manual testing wszystkich error cases

### Documentation
- [ ] JSDoc dla wszystkich public methods
- [ ] API documentation zaktualizowana
- [ ] README z przykładami użycia
- [ ] Changelog entry

### Monitoring
- [ ] Logging skonfigurowany
- [ ] Error tracking (Sentry/podobne)
- [ ] Performance monitoring
- [ ] Alerting dla critical errors

### Deployment
- [ ] Environment variables skonfigurowane
- [ ] Database migrations applied
- [ ] Build successful
- [ ] Smoke tests w produkcji passed

---

## 11. Maintenance i Future Improvements

### Short-term (1-3 miesiące)
- Monitoring performance metrics
- Analiza error logs i optymalizacja
- A/B testing różnych limitów walidacji (jeśli potrzebne)

### Medium-term (3-6 miesięcy)
- Implementacja soft delete dla profili
- Dodanie historii zmian profilu
- Rozszerzenie profilu o dodatkowe pola (opcjonalne)

### Long-term (6+ miesięcy)
- Migracja do GraphQL (jeśli potrzebne)
- Implementacja caching layer (Redis)
- Advanced analytics dla danych profilowych

---

## 12. Kontakt i wsparcie

**Dokumentacja techniczna:**
- Astro: https://docs.astro.build
- Supabase: https://supabase.com/docs
- Zod: https://zod.dev

**Internal resources:**
- Tech stack: `.ai/tech-stack.md`
- Database schema: `supabase/migrations/`
- API plan: `.ai/api-plan.md`
