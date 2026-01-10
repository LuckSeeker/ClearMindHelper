# API Endpoint Implementation Plan: GET /api/profile

## 1. Przegląd punktu końcowego

Endpoint `GET /api/profile` służy do pobierania danych profilu zalogowanego użytkownika. Jest to kluczowy endpoint dla User Stories US-003 (Tworzenie Profilu) i US-018 (Wgląd w profil), umożliwiający aplikacji wyświetlenie i weryfikację danych użytkownika niezbędnych do obliczeń BAC.

**Kluczowe funkcjonalności:**
- Pobiera dane profilu użytkownika z tabeli `UserProfiles`
- Oblicza pole `is_complete` jako computed field sprawdzające czy wszystkie wymagane pola są wypełnione
- Zwraca dane profilu wraz z timestampami utworzenia i aktualizacji
- Obsługuje scenariusz braku profilu (404) co powinno zainicjować proces tworzenia profilu po stronie klienta

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/profile
```

### Nagłówki
**Wymagane:**
- `Authorization: Bearer {access_token}` - JWT token z Supabase Auth

**Opcjonalne:**
- Brak

### Parametry
**Query Parameters:**
- Brak

**Path Parameters:**
- Brak

**Request Body:**
- Nie dotyczy (metoda GET)

### Uwagi dotyczące żądania
- Endpoint nie przyjmuje żadnych parametrów, ponieważ identyfikacja użytkownika odbywa się poprzez token JWT
- User ID jest ekstrahowany z tokenu autoryzacyjnego przez middleware Astro lub Supabase client

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

**UserProfileDTO** - główny typ odpowiedzi:
```typescript
export interface UserProfileDTO extends Omit<UserProfile, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
  is_complete: boolean;
}
```

**Pola:**
- `id: bigint` - ID profilu
- `user_id: string` (UUID) - ID użytkownika z auth.users
- `height_cm: number | null` - Wzrost w centymetrach (50-250)
- `weight_kg: number | null` - Waga w kilogramach (30-300)
- `gender: Gender | null` - Płeć ('M' lub 'F')
- `created_at: string` - Timestamp utworzenia profilu (ISO 8601)
- `updated_at: string` - Timestamp ostatniej aktualizacji (ISO 8601)
- `is_complete: boolean` - Computed field: `true` jeśli wszystkie wymagane pola są wypełnione

### Typy pomocnicze

**Gender** (enum):
```typescript
export type Gender = Enums<"enum_gender">; // 'M' | 'F'
```

**APIError** - typ dla odpowiedzi błędów:
```typescript
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Entity Types

**UserProfile** - bazowy typ z database.types.ts:
```typescript
export type UserProfile = Tables<"userprofiles">;
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Status:** `200 OK`

**Content-Type:** `application/json`

**Body:**
```json
{
  "id": "123456789",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "height_cm": 180,
  "weight_kg": 75.5,
  "gender": "M",
  "created_at": "2026-01-08T12:00:00.000Z",
  "updated_at": "2026-01-08T14:30:00.000Z",
  "is_complete": true
}
```

**Przykład niekompletnego profilu:**
```json
{
  "id": "123456789",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "height_cm": null,
  "weight_kg": null,
  "gender": null,
  "created_at": "2026-01-08T12:00:00.000Z",
  "updated_at": "2026-01-08T12:00:00.000Z",
  "is_complete": false
}
```

### Error Responses

#### 401 Unauthorized

**Scenariusze:**
- Brak nagłówka Authorization
- Nieprawidłowy lub wygasły token JWT
- Token nie należy do żadnego użytkownika

**Status:** `401 Unauthorized`

**Body:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

#### 404 Not Found

**Scenariusze:**
- Profil użytkownika nie istnieje w bazie danych
- Użytkownik jest zalogowany, ale nie ma jeszcze utworzonego profilu

**Status:** `404 Not Found`

**Body:**
```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile not found. Please create your profile first."
  }
}
```

**Uwaga:** Odpowiedź 404 powinna zainicjować proces tworzenia profilu po stronie klienta (US-003).

#### 500 Internal Server Error

**Scenariusze:**
- Błąd połączenia z bazą danych
- Nieoczekiwany błąd serwera
- Błąd w logice biznesowej

**Status:** `500 Internal Server Error`

**Body:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later.",
    "details": {
      "timestamp": "2026-01-08T12:00:00.000Z"
    }
  }
}
```

## 5. Przepływ danych

### Diagram przepływu

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ GET /api/profile
       │ Authorization: Bearer {token}
       ▼
┌──────────────────┐
│ Astro Middleware │ ◄─── Walidacja tokenu JWT
└──────┬───────────┘
       │ context.locals.supabase
       │ context.locals.user
       ▼
┌────────────────────┐
│  API Route Handler │
│  /pages/api/       │
│  profile.ts        │
└─────────┬──────────┘
          │ 1. Pobierz user_id z context.locals
          │ 2. Wywołaj ProfileService.getProfile()
          ▼
┌──────────────────┐
│ ProfileService   │
│ /lib/services/   │
│ profile.service  │
└─────────┬────────┘
          │ 1. Query do Supabase
          │ 2. Oblicz is_complete
          │ 3. Format timestamps
          ▼
┌─────────────────┐
│ Supabase Client │
│ + RLS Policies  │
└─────────┬───────┘
          │ SELECT * FROM userprofiles
          │ WHERE user_id = $1
          ▼
┌──────────────┐
│  PostgreSQL  │
│  UserProfiles│
│  Table       │
└──────────────┘
```

### Szczegółowy przepływ

1. **Request Processing:**
   - Klient wysyła żądanie GET z nagłówkiem Authorization
   - Astro middleware przechwytuje request
   - Middleware tworzy Supabase client i waliduje JWT token
   - Middleware ekstrahuje dane użytkownika i zapisuje w `context.locals`

2. **Authentication & Authorization:**
   - Middleware Supabase automatycznie waliduje token
   - User ID jest ekstrahowany z JWT payload
   - RLS policies w PostgreSQL zapewniają, że użytkownik może pobrać tylko swój profil

3. **Data Retrieval:**
   - Handler wywołuje `ProfileService.getProfile(userId)`
   - Service wykonuje query przez Supabase client: `from('userprofiles').select('*').eq('user_id', userId).single()`
   - RLS policy `userprofiles_select_policy` weryfikuje uprawnienia

4. **Business Logic:**
   - Service sprawdza czy profil istnieje (jeśli nie → 404)
   - Service oblicza `is_complete = !!(height_cm && weight_kg && gender)`
   - Service konwertuje timestamps do ISO 8601 string

5. **Response Formation:**
   - Service zwraca UserProfileDTO
   - Handler serializuje do JSON
   - Handler ustawia odpowiednie nagłówki (Content-Type, Cache-Control)
   - Response jest zwracany do klienta

### Interakcje z bazą danych

**Query:**
```sql
SELECT 
  id, 
  user_id, 
  height_cm, 
  weight_kg, 
  gender, 
  created_at, 
  updated_at
FROM userprofiles
WHERE user_id = $1;
```

**RLS Policy (automatycznie aplikowana):**
```sql
-- userprofiles_select_policy
CREATE POLICY userprofiles_select_policy ON userprofiles
FOR SELECT
USING (auth.uid() = user_id);
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)

**Mechanizm:**
- JWT token z Supabase Auth przekazywany w nagłówku Authorization
- Token jest walidowany przez Supabase client w middleware
- Middleware tworzy authenticated Supabase client używając tokenu

**Implementacja w middleware:**
```typescript
export async function onRequest(context, next) {
  const token = context.request.headers.get('Authorization')?.replace('Bearer ', '');
  
  const supabase = createServerClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookies: context.cookies,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return new Response(JSON.stringify({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authentication token'
      }
    }), { status: 401 });
  }
  
  context.locals.supabase = supabase;
  context.locals.user = user;
  
  return next();
}
```

### Autoryzacja (Authorization)

**Row Level Security (RLS):**
- PostgreSQL RLS policies zapewniają, że użytkownik może pobrać tylko swój profil
- Policy sprawdza `auth.uid() = user_id`
- Nawet jeśli ktoś zmodyfikuje kod aplikacji, nie będzie mógł pobrać cudzego profilu

**Weryfikacja uprawnień:**
- Brak dodatkowej logiki autoryzacyjnej - użytkownik zawsze pobiera tylko swój profil
- User ID jest ekstrahowany z JWT, nie z parametrów żądania (eliminuje IDOR vulnerability)

### Walidacja danych

**Input Validation:**
- Brak parametrów wejściowych do walidacji
- Token JWT jest walidowany przez Supabase

**Output Sanitization:**
- Wszystkie dane z bazy są bezpiecznie serializowane do JSON
- Brak danych wrażliwych w odpowiedzi (password hash itp. są w auth.users, nie w userprofiles)
- Timestamps są konwertowane do standardowego formatu ISO 8601

### Ochrona przed atakami

**IDOR (Insecure Direct Object Reference):**
- ✅ Zabezpieczony - user_id pochodzi z JWT, nie z parametrów żądania
- ✅ RLS policies wymuszają dostęp tylko do własnych danych

**JWT Security:**
- ✅ Token verification przez Supabase
- ✅ Token expiration handling
- ✅ Secure token storage po stronie klienta (responsibility klienta)

**SQL Injection:**
- ✅ Parametryzowane queries przez Supabase client
- ✅ Brak raw SQL w kodzie aplikacji

**XSS (Cross-Site Scripting):**
- ✅ JSON serialization automatycznie escape'uje dane
- ✅ Brak HTML w odpowiedziach API

### Bezpieczeństwo danych

**Dane wrażliwe:**
- Gender może być wrażliwy - należy rozważyć GDPR compliance
- Waga i wzrost to dane zdrowotne - również podlegają GDPR

**Zalecenia:**
- Implementacja audit log dla dostępu do profili (opcjonalne, użyj Events table)
- HTTPS only w produkcji
- Rate limiting na endpoint (zapobieganie scraping)
- CORS configuration dla known origins only

## 7. Obsługa błędów

### Katalog błędów

| Status Code | Error Code | Scenariusz | Message | Action |
|-------------|------------|------------|---------|--------|
| 401 | UNAUTHORIZED | Brak tokenu | Missing or invalid authentication token | Redirect to login |
| 401 | UNAUTHORIZED | Nieprawidłowy token | Missing or invalid authentication token | Refresh token or re-login |
| 401 | UNAUTHORIZED | Wygasły token | Missing or invalid authentication token | Refresh token |
| 404 | PROFILE_NOT_FOUND | Profil nie istnieje | User profile not found. Please create your profile first. | Redirect to profile creation |
| 500 | INTERNAL_SERVER_ERROR | Błąd bazy danych | An unexpected error occurred. Please try again later. | Retry + contact support |
| 500 | INTERNAL_SERVER_ERROR | Nieoczekiwany błąd | An unexpected error occurred. Please try again later. | Retry + contact support |

### Implementacja obsługi błędów

**W API Route Handler:**
```typescript
export const GET: APIRoute = async ({ locals }) => {
  try {
    // 1. Check authentication
    if (!locals.user) {
      return new Response(JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication token'
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Get profile
    const profile = await ProfileService.getProfile(locals.user.id, locals.supabase);
    
    // 3. Handle not found
    if (!profile) {
      return new Response(JSON.stringify({
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found. Please create your profile first.'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Success response
    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // 5. Log error (for debugging)
    console.error('Error fetching profile:', error);

    // 6. Generic error response (nie ujawniaj szczegółów)
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        details: {
          timestamp: new Date().toISOString()
        }
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### Logging i monitoring

**Error Logging:**
- Console.error dla development
- Structured logging w produkcji (rozważyć integrację z service jak Sentry)
- Logować: timestamp, user_id, error type, stack trace

**Telemetria (opcjonalnie):**
- Nie logować do Events table dla zwykłych GET requests (zbyt dużo rekordów)
- Rozważyć logowanie tylko błędów 500 do Events

**Monitoring:**
- Metryki: response time, error rate, 404 rate (może wskazywać problem z onboarding)
- Alerty dla spike w 500 errors

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

**Database Query:**
- ✅ Single row query z WHERE user_id - bardzo szybkie
- ✅ Index na user_id (UNIQUE constraint automatycznie tworzy index)
- ✅ Użycie `.single()` w Supabase zamiast `.limit(1)` + array unwrap

**Query Performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM userprofiles WHERE user_id = '...';
-- Oczekiwany plan: Index Scan using userprofiles_user_id_key
-- Execution time: < 1ms
```

### Caching Strategy

**Response Caching:**
```typescript
headers: {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, max-age=60', // Cache przez 60s
  'ETag': `W/"${profile.updated_at}"` // Weak ETag based on updated_at
}
```

**Zalecenia:**
- Cache na 60 sekund (profil rzadko się zmienia)
- `private` - tylko w cache przeglądarki, nie w shared cache
- ETag dla conditional requests (304 Not Modified)
- Invalidacja cache po PUT /api/profile

**CDN Caching:**
- Nie używać CDN caching dla authenticated endpoints
- Każdy użytkownik ma inne dane

### Connection Pooling

**Supabase Client:**
- Supabase automatycznie zarządza connection pooling
- Używać singleton pattern dla Supabase client w middleware
- Unikać tworzenia nowego client dla każdego request

### Performance Monitoring

**Metryki do śledzenia:**
- Average response time (target: < 100ms)
- P95, P99 response time
- Database query time
- Error rate

**Potencjalne wąskie gardła:**
- ❌ Database connection - mitigowane przez Supabase pooling
- ❌ JWT verification - mitigowane przez Supabase caching
- ❌ Network latency - mitigowane przez proper hosting location

### Scalability

**Concurrent Requests:**
- Endpoint jest read-only, łatwo skaluje się horyzontalnie
- Brak lock contention w bazie danych
- RLS policies nie powinny znacząco wpływać na performance

**Load Testing Targets:**
- 100 concurrent users: < 200ms average response time
- 1000 requests/sec: < 500ms P99 response time

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury plików

**Zadania:**
1. Utworzyć folder `src/lib/services` (jeśli nie istnieje)
2. Utworzyć plik `src/lib/services/profile.service.ts`
3. Utworzyć folder `src/pages/api` (jeśli nie istnieje)
4. Utworzyć plik `src/pages/api/profile.ts`

**Weryfikacja:**
- [ ] Struktura folderów zgodna z project structure
- [ ] Pliki utworzone z pustym szablonem

### Krok 2: Implementacja ProfileService

**Zadania:**
1. Zaimplementować `ProfileService.getProfile(userId, supabase)`
2. Dodać logikę obliczania `is_complete`
3. Dodać formatowanie timestamps do ISO 8601
4. Dodać obsługę przypadku gdy profil nie istnieje (return null)
5. Dodać error handling dla błędów Supabase

**Kod:**
```typescript
// src/lib/services/profile.service.ts
import type { SupabaseClient } from '../db/supabase.client';
import type { UserProfileDTO } from '../types';

export class ProfileService {
  static async getProfile(
    userId: string,
    supabase: SupabaseClient
  ): Promise<UserProfileDTO | null> {
    const { data, error } = await supabase
      .from('userprofiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    // Compute is_complete
    const isComplete = !!(
      data.height_cm &&
      data.weight_kg &&
      data.gender
    );

    // Format timestamps
    return {
      id: data.id,
      user_id: data.user_id,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      gender: data.gender,
      created_at: new Date(data.created_at).toISOString(),
      updated_at: new Date(data.updated_at).toISOString(),
      is_complete: isComplete,
    };
  }
}
```

**Weryfikacja:**
- [ ] Service zwraca UserProfileDTO zgodny z types.ts
- [ ] is_complete jest poprawnie obliczane
- [ ] Timestamps są w formacie ISO 8601
- [ ] Obsługa błędu not found (return null)
- [ ] Error propagation dla innych błędów

### Krok 3: Implementacja API Route Handler

**Zadania:**
1. Utworzyć API route z exportem `GET`
2. Dodać `export const prerender = false`
3. Zaimplementować authentication check
4. Wywołać ProfileService
5. Obsłużyć case gdy profil nie istnieje (404)
6. Obsłużyć błędy (try-catch)
7. Zwrócić odpowiedź w formacie JSON

**Kod:**
```typescript
// src/pages/api/profile.ts
import type { APIRoute } from 'astro';
import { ProfileService } from '../../lib/services/profile.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    // 1. Check authentication
    if (!locals.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authentication token',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Get profile
    const profile = await ProfileService.getProfile(
      locals.user.id,
      locals.supabase
    );

    // 3. Handle not found
    if (!profile) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User profile not found. Please create your profile first.',
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Success response
    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        'ETag': `W/"${profile.updated_at}"`,
      },
    });
  } catch (error) {
    // 5. Error handling
    console.error('Error fetching profile:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          details: {
            timestamp: new Date().toISOString(),
          },
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
```

**Weryfikacja:**
- [ ] Route handler używa locals.supabase i locals.user
- [ ] Obsługa wszystkich statusów: 200, 401, 404, 500
- [ ] Odpowiedzi zgodne ze specyfikacją API
- [ ] Cache headers ustawione poprawnie
- [ ] Error handling z try-catch

### Krok 4: Weryfikacja middleware

**Zadania:**
1. Sprawdzić czy middleware w `src/middleware/index.ts` istnieje
2. Zweryfikować, że middleware tworzy Supabase client
3. Zweryfikować, że middleware ekstrahuje user z JWT
4. Zweryfikować, że middleware zapisuje dane w context.locals
5. Jeśli middleware nie istnieje - zaimplementować

**Expected middleware structure:**
```typescript
// src/middleware/index.ts
import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return context.cookies.get(key)?.value;
        },
        set(key, value, options) {
          context.cookies.set(key, value, options);
        },
        remove(key, options) {
          context.cookies.delete(key, options);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  context.locals.supabase = supabase;
  context.locals.user = user;

  return next();
});
```

**Weryfikacja:**
- [ ] Middleware tworzy authenticated Supabase client
- [ ] User jest ekstrahowany z JWT
- [ ] context.locals zawiera supabase i user
- [ ] Middleware nie blokuje requestów (user może być null dla public routes)

### Krok 5: Aktualizacja typów dla context.locals

**Zadania:**
1. Sprawdzić plik `src/env.d.ts`
2. Dodać typy dla context.locals.supabase i context.locals.user
3. Zaimportować typy z właściwych źródeł

**Kod:**
```typescript
// src/env.d.ts
/// <reference types="astro/client" />

import type { SupabaseClient } from './db/supabase.client';
import type { User } from '@supabase/supabase-js';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient;
    user: User | null;
  }
}
```

**Weryfikacja:**
- [ ] TypeScript nie zgłasza błędów w route handler
- [ ] Autocomplete działa dla locals.supabase i locals.user
- [ ] Import types z poprawnych źródeł

### Krok 6: Testy manualne

**Zadania:**
1. Uruchomić development server (`npm run dev`)
2. Przetestować endpoint z Postman/curl/Thunder Client

**Test Cases:**

**TC-1: Authorized user z profilem**
```bash
curl -X GET http://localhost:4321/api/profile \
  -H "Authorization: Bearer {valid_token}"
```
Expected: 200 OK + UserProfileDTO

**TC-2: Authorized user bez profilu**
```bash
curl -X GET http://localhost:4321/api/profile \
  -H "Authorization: Bearer {valid_token_no_profile}"
```
Expected: 404 Not Found + error message

**TC-3: Unauthorized (brak tokenu)**
```bash
curl -X GET http://localhost:4321/api/profile
```
Expected: 401 Unauthorized

**TC-4: Invalid token**
```bash
curl -X GET http://localhost:4321/api/profile \
  -H "Authorization: Bearer invalid_token"
```
Expected: 401 Unauthorized

**TC-5: Profil niekompletny**
- Setup: Utworzyć profil z nullami w DB
- Request z valid token
- Expected: 200 OK + is_complete: false

**Weryfikacja:**
- [ ] Wszystkie test cases przechodzą
- [ ] Response format zgodny ze specyfikacją
- [ ] Error messages są user-friendly
- [ ] Timestamps w ISO 8601

### Krok 7: Weryfikacja RLS Policies

**Zadania:**
1. Sprawdzić plik `supabase/migrations/*_init_rls_policies.sql`
2. Zweryfikować, że istnieje policy dla SELECT na userprofiles
3. Przetestować, że użytkownik nie może pobrać cudzego profilu

**Expected Policy:**
```sql
-- Enable RLS
ALTER TABLE userprofiles ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY userprofiles_select_policy ON userprofiles
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Testy:**
- [ ] RLS policy istnieje
- [ ] Policy sprawdza auth.uid() = user_id
- [ ] Niemożliwe pobranie cudzego profilu (nawet z modyfikacją kodu)

### Krok 8: Dokumentacja

**Zadania:**
1. Dodać JSDoc comments do ProfileService
2. Zaktualizować API documentation (jeśli istnieje)
3. Dodać przykłady użycia w README

**Weryfikacja:**
- [ ] Kod jest dobrze udokumentowany
- [ ] Przykłady są aktualne
- [ ] README zawiera informacje o endpoint

### Krok 9: Code review checklist

**Przed merge:**
- [ ] Kod zgodny z ESLint rules
- [ ] Kod zgodny z project guidelines (.cursor/rules)
- [ ] Wszystkie typy są poprawne (TypeScript bez błędów)
- [ ] Error handling we wszystkich miejscach
- [ ] Testy manualne przeszły
- [ ] RLS policies działają
- [ ] Cache headers ustawione
- [ ] Logging zaimplementowany
- [ ] Code review przez innego developera

### Krok 10: Deployment checklist

**Przed deployment:**
- [ ] Environment variables ustawione w produkcji
- [ ] HTTPS wymuszony
- [ ] CORS skonfigurowany dla known origins
- [ ] Rate limiting włączony (jeśli dostępny)
- [ ] Monitoring skonfigurowany
- [ ] Error tracking skonfigurowany (Sentry)
- [ ] Database backup schedule ustawiony
- [ ] Smoke tests w production

---

## Podsumowanie

Ten plan implementacji obejmuje wszystkie aspekty wdrożenia endpointa `GET /api/profile`:

✅ **Security** - JWT authentication, RLS policies, IDOR protection  
✅ **Performance** - Query optimization, caching strategy, connection pooling  
✅ **Error Handling** - Comprehensive error scenarios, user-friendly messages  
✅ **Type Safety** - TypeScript types, DTOs, proper interfaces  
✅ **Best Practices** - Service layer, separation of concerns, clean code  
✅ **Testing** - Manual test cases, RLS verification  
✅ **Documentation** - JSDoc, API docs, README  

Implementacja powinna zająć około **4-6 godzin** dla doświadczonego developera, włączając testy i code review.
