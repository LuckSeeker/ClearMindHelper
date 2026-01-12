# API Endpoint Implementation Plan: GET /api/parties

## 1. Przegląd punktu końcowego

Endpoint `GET /api/parties` służy do pobierania spaginowanej listy historii imprez użytkownika. Umożliwia filtrowanie według statusu imprezy, sortowanie według daty rozpoczęcia lub maksymalnego BAC, oraz kontrolę porządku sortowania. Każda impreza w liście zawiera podgląd pierwszych trzech napojów, co pozwala użytkownikowi szybko zapoznać się z historią swoich sesji imprezowych bez konieczności pobierania pełnych szczegółów każdej imprezy.

**Odpowiada User Story:** US-009 (przeglądanie historii imprez)

**Główne funkcjonalności:**
- Spaginowana lista imprez użytkownika
- Filtrowanie według statusu (ongoing/closed)
- Sortowanie według started_at lub bac_estimate_max
- Kontrola porządku sortowania (asc/desc)
- Podgląd pierwszych 3 drinków każdej imprezy
- Domyślne sortowanie: started_at DESC

---

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/parties
```

### Headers
```
Authorization: Bearer {access_token}
```

**Uwaga:** W trybie development używany jest domyślny `DEFAULT_USER_ID` zamiast prawdziwego JWT tokena.

### Query Parameters

Wszystkie parametry są opcjonalne z wartościami domyślnymi:

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `page` | integer | No | 1 | >= 1 | Numer strony do pobrania |
| `limit` | integer | No | 20 | 1-100 | Liczba rekordów na stronę |
| `status` | string | No | - | 'ongoing' \| 'closed' | Filtrowanie według statusu imprezy |
| `sort` | string | No | 'started_at' | 'started_at' \| 'bac_estimate_max' | Kolumna do sortowania |
| `order` | string | No | 'desc' | 'asc' \| 'desc' | Kierunek sortowania |

### Request Body
Brak (GET endpoint)

### Przykładowe żądanie

```bash
# Podstawowe użycie (domyślne parametry)
GET /api/parties

# Z filtrowaniem według statusu
GET /api/parties?status=closed

# Z paginacją
GET /api/parties?page=2&limit=10

# Z sortowaniem według BAC
GET /api/parties?sort=bac_estimate_max&order=desc

# Pełny przykład
GET /api/parties?page=1&limit=20&status=closed&sort=started_at&order=desc
```

---

## 3. Wykorzystywane typy

### DTOs wykorzystywane w implementacji

```typescript
// Query Parameters
interface PartyListQueryParams {
  page?: number;
  limit?: number;
  status?: PartyStatus;
  sort?: "started_at" | "bac_estimate_max";
  order?: "asc" | "desc";
}

// Response DTOs
interface PartyListResponseDTO {
  data: PartyListItemDTO[];
  pagination: PaginationMeta;
}

interface PartyListItemDTO extends PartyDTO {
  drinks_preview: DrinkPreview[];
}

interface DrinkPreview {
  id: number;
  volume_ml: number;
  abv_percent: number;
  consumed_at: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

// Error Response
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

**Wszystkie typy są już zdefiniowane w:** `src/types.ts`

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 123,
      "user_id": "uuid-string",
      "started_at": "2026-01-10T18:00:00Z",
      "ended_at": "2026-01-10T23:30:00Z",
      "status": "closed",
      "profile_snapshot": {
        "height_cm": 180,
        "weight_kg": 75.5,
        "gender": "M",
        "captured_at": "2026-01-10T18:00:00Z"
      },
      "bac_estimate_max": 0.12,
      "total_drinks_count": 5,
      "total_ml_consumed": 2500,
      "blackout_marked": false,
      "blackout_marked_at": null,
      "created_at": "2026-01-10T18:00:00Z",
      "updated_at": "2026-01-10T23:30:00Z",
      "drinks_preview": [
        {
          "id": 456,
          "volume_ml": 500,
          "abv_percent": 5.0,
          "consumed_at": "2026-01-10T18:15:00Z"
        },
        {
          "id": 457,
          "volume_ml": 500,
          "abv_percent": 5.0,
          "consumed_at": "2026-01-10T19:00:00Z"
        },
        {
          "id": 458,
          "volume_ml": 50,
          "abv_percent": 40.0,
          "consumed_at": "2026-01-10T20:00:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 15,
    "total_pages": 1
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Query Parameters
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid query parameters",
    "details": {
      "errors": [
        {
          "field": "page",
          "message": "page must be at least 1",
          "code": "too_small"
        }
      ]
    }
  }
}
```

**Przykładowe scenariusze:**
- `page < 1`
- `limit < 1` lub `limit > 100`
- `status` nie jest 'ongoing' ani 'closed'
- `sort` nie jest 'started_at' ani 'bac_estimate_max'
- `order` nie jest 'asc' ani 'desc'
- Nieprawidłowy typ danych (np. string zamiast number)

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Scenariusze:**
- Brak Authorization header (w przyszłości, po implementacji JWT)
- Nieprawidłowy lub wygasły token

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

**Scenariusze:**
- Błąd zapytania do bazy danych
- Brak połączenia z Supabase
- Nieoczekiwane wyjątki w kodzie

### Response Headers

```
Content-Type: application/json
```

### Przypadki brzegowe

1. **Pusta lista:** Jeśli użytkownik nie ma żadnych imprez, zwracamy status 200 z pustą tablicą:
   ```json
   {
     "data": [],
     "pagination": {
       "page": 1,
       "limit": 20,
       "total_count": 0,
       "total_pages": 0
     }
   }
   ```

2. **Strona poza zakresem:** Jeśli `page` przekracza `total_pages`, zwracamy pustą tablicę z pełnymi metadanymi paginacji (nie błąd 404)

3. **Impreza bez drinków:** Pole `drinks_preview` będzie pustą tablicą `[]`

---

## 5. Przepływ danych

### Architektura warstwowa

```
Client Request
    ↓
GET /api/parties (Astro API Route)
    ↓
Middleware (dodaje supabase do locals)
    ↓
Walidacja query params (PartyListQuerySchema)
    ↓
PartyService.getPartyList()
    ↓
Supabase Client
    ↓
PostgreSQL (parties + drinks tables)
    ↓ RLS Filter (user_id)
Supabase Response
    ↓
PartyService (formatowanie do DTO)
    ↓
API Route (response z paginacją)
    ↓
Client Response (200 OK)
```

### Szczegółowy przepływ

#### 1. Request Processing (API Route)

**Lokalizacja:** `src/pages/api/parties.ts`

1. **Middleware:** Wstrzykuje `supabase` client do `locals`
2. **Autoryzacja:** Pobiera `userId` z DEFAULT_USER_ID (development) lub JWT (future)
3. **Walidacja parametrów:** Parsuje i waliduje query params przez `PartyListQuerySchema`
4. **Wywołanie service:** Przekazuje parametry do `getPartyList()`

#### 2. Business Logic (Service Layer)

**Lokalizacja:** `src/lib/services/party.service.ts`

**Nowa funkcja:** `getPartyList()`

```typescript
export async function getPartyList(
  supabase: SupabaseClient,
  userId: string,
  filters: {
    status?: PartyStatus;
    sort?: "started_at" | "bac_estimate_max";
    order?: "asc" | "desc";
  },
  pagination: {
    page: number;
    limit: number;
  }
): Promise<PartyListResponseDTO>
```

**Kroki:**

1. **Query Building:**
   - Bazowe zapytanie: `SELECT * FROM parties WHERE user_id = userId`
   - Dodaj filtr status jeśli podany
   - Dodaj sortowanie (default: started_at DESC)
   - Dodaj paginację: `.range(from, to)`

2. **Count Query:**
   - Osobne zapytanie z `.select('*', { count: 'exact', head: true })`
   - Wykorzystaj te same filtry co główne zapytanie

3. **Drinks Preview Query:**
   - Dla każdego party pobierz pierwsze 3 drinki
   - Query: `SELECT id, volume_ml, abv_percent, consumed_at FROM drinks WHERE party_id = ? ORDER BY consumed_at ASC LIMIT 3`
   - Można to zoptymalizować jednym zapytaniem z window functions lub lateral joins

4. **Response Assembly:**
   - Mapuj parties do `PartyListItemDTO`
   - Konwertuj timestamps do ISO strings
   - Dodaj drinks_preview do każdego party
   - Oblicz total_pages = ceil(total_count / limit)
   - Zwróć `PartyListResponseDTO`

#### 3. Database Layer (Supabase)

**Tabele:**
- `parties` - główne dane imprez
- `drinks` - napoje dla drinks_preview

**RLS Policy:**
- Automatycznie filtruje `user_id = auth.uid()` (gdy JWT będzie zaimplementowane)
- W development: filtruje przez `user_id` w query

**Indeksy wymagane dla wydajności:**
```sql
-- Już istnieją w migrations
CREATE INDEX idx_parties_user_id_status ON parties(user_id, status);
CREATE INDEX idx_parties_user_id_started_at ON parties(user_id, started_at DESC);
CREATE INDEX idx_drinks_party_id_consumed_at ON drinks(party_id, consumed_at ASC);
```

#### 4. Response Formatting (API Route)

1. **Success Path:**
   - Status 200
   - Content-Type: application/json
   - Body: PartyListResponseDTO

2. **Error Path:**
   - Łap błędy z service
   - Mapuj na odpowiednie kody statusu
   - Zwróć APIError

---

## 6. Względy bezpieczeństwa

### 1. Autoryzacja i Autentykacja

**Current (Development):**
```typescript
const userId = DEFAULT_USER_ID;
```

**Future (Production):**
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(
    JSON.stringify({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required"
      }
    } satisfies APIError),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
const userId = user.id;
```

### 2. Row Level Security (RLS)

**Supabase RLS Policy na tabeli parties:**
```sql
CREATE POLICY "Users can only view their own parties"
ON parties FOR SELECT
USING (user_id = auth.uid());
```

**Benefity:**
- Automatyczna ochrona przed dostępem do imprez innych użytkowników
- Brak potrzeby dodatkowej walidacji w kodzie aplikacji
- Działa na poziomie bazy danych

**W development:** RLS może być wyłączone, ale query ręcznie filtruje po `user_id`

### 3. Input Validation

**Walidacja przez Zod Schema:**

```typescript
export const PartyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["ongoing", "closed"]).optional(),
  sort: z.enum(["started_at", "bac_estimate_max"]).optional().default("started_at"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});
```

**Zabezpieczenia:**
- `z.coerce.number()` - automatyczna konwersja string → number
- `.min()` / `.max()` - zakresy wartości
- `.enum()` - tylko dozwolone wartości
- `.optional().default()` - wartości domyślne

### 4. SQL Injection Protection

**Supabase Client:**
- Używa parametryzowanych zapytań
- Automatyczne escapowanie wartości
- Brak możliwości SQL injection przez query params

### 5. Rate Limiting

**Nie zaimplementowane na poziomie aplikacji, ale zalecane:**

```typescript
// Przyszła implementacja - rate limiting middleware
// Przykład: max 60 requestów/minutę na użytkownika
```

**Alternatywa:** Rate limiting na poziomie Supabase lub reverse proxy (nginx)

### 6. Data Exposure Prevention

**Limitowanie:**
- Max 100 rekordów na request (`limit <= 100`)
- Pagination wymusza kontrolowane pobieranie danych
- Tylko `drinks_preview` (pierwsze 3) zamiast wszystkich drinków

**Filtrowanie pól:**
- Endpoint zwraca tylko niezbędne pola
- Brak wrażliwych danych (np. hashy, internal IDs)

### 7. CORS Headers

**Nie wymagane** dla same-origin requests, ale w przyszłości:

```typescript
headers: {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.PUBLIC_DOMAIN,
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
}
```

### Security Checklist

- [x] Autoryzacja przez JWT (future)
- [x] RLS policies w Supabase
- [x] Walidacja wszystkich query params
- [x] Ograniczenie liczby rekordów (max 100)
- [x] SQL injection protection (Supabase client)
- [ ] Rate limiting (future enhancement)
- [x] Secure headers
- [x] Brak sensitive data exposure

---

## 7. Obsługa błędów

### Hierarchia obsługi błędów

```
API Route (parties.ts)
  ├─ Validation Errors → 400 Bad Request
  ├─ Authorization Errors → 401 Unauthorized (future)
  │
  └─ Service Layer Errors
      ├─ Business Logic Errors → 400 Bad Request
      └─ Database Errors → 500 Internal Server Error
```

### Detailed Error Scenarios

#### 1. Validation Errors (400 Bad Request)

**Kod błędu:** `VALIDATION_FAILED`

**Przykładowe przypadki:**

```typescript
// page < 1
GET /api/parties?page=0
Response: {
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid query parameters",
    "details": {
      "errors": [{
        "field": "page",
        "message": "Number must be greater than or equal to 1",
        "code": "too_small"
      }]
    }
  }
}

// limit > 100
GET /api/parties?limit=150
Response: {
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid query parameters",
    "details": {
      "errors": [{
        "field": "limit",
        "message": "Number must be less than or equal to 100",
        "code": "too_big"
      }]
    }
  }
}

// Invalid enum value
GET /api/parties?status=invalid
Response: {
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid query parameters",
    "details": {
      "errors": [{
        "field": "status",
        "message": "Invalid enum value. Expected 'ongoing' | 'closed', received 'invalid'",
        "code": "invalid_enum_value"
      }]
    }
  }
}
```

**Handling w kodzie:**

```typescript
const validationResult = PartyListQuerySchema.safeParse(queryParams);
if (!validationResult.success) {
  const formattedErrors = validationResult.error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));

  logWarning("Validation failed for GET /api/parties", { userId, errors: formattedErrors });

  return new Response(
    JSON.stringify({
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid query parameters",
        details: { errors: formattedErrors },
      },
    } satisfies APIError),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 2. Authorization Errors (401 Unauthorized)

**Kod błędu:** `UNAUTHORIZED`

**Scenariusze:**
- Brak Authorization header
- Nieprawidłowy JWT token
- Wygasły JWT token

```typescript
// Future implementation
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  logWarning("Unauthorized access attempt to GET /api/parties", { error: error?.message });
  return new Response(
    JSON.stringify({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required"
      }
    } satisfies APIError),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 3. Database Errors (500 Internal Server Error)

**Kod błędu:** `DATABASE_ERROR` lub `INTERNAL_SERVER_ERROR`

**Scenariusze:**
- Timeout połączenia z Supabase
- Błąd zapytania SQL
- RLS policy error

```typescript
try {
  const result = await getPartyList(supabase, userId, filters, pagination);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
} catch (serviceError) {
  if (serviceError instanceof Error) {
    const errorMessage = serviceError.message;

    // Database errors
    if (errorMessage.startsWith("Database error:")) {
      logError("Database error in GET /api/parties", {
        userId,
        error: errorMessage,
        filters,
        pagination
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "DATABASE_ERROR",
            message: "An unexpected error occurred. Please try again later.",
          },
        } satisfies APIError),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Generic unexpected errors
  logError("Unexpected error in GET /api/parties", {
    userId,
    error: String(serviceError),
    filters,
    pagination
  });

  return new Response(
    JSON.stringify({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    } satisfies APIError),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 4. Service Layer Errors

**Rzucane przez PartyService:**

```typescript
// Database query error
throw new Error(`Database error: ${error.message}`);

// Connection error
throw new Error(`Database error: Failed to connect to database`);
```

### Error Logging Strategy

**Logger levels:**

```typescript
// Walidacja - WARNING
logWarning("Validation failed for GET /api/parties", { userId, errors });

// Autoryzacja - WARNING
logWarning("Unauthorized access attempt to GET /api/parties", { ip, headers });

// Database errors - ERROR
logError("Database error in GET /api/parties", { userId, error, query });

// Success - INFO
logInfo("Party list retrieved successfully", { userId, count, page });
```

### Error Response Format

**Standardowy format:**

```typescript
interface APIError {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: {            // Optional additional info
      [key: string]: unknown;
    };
  };
}
```

### User-Facing Error Messages

**Zasady:**
- ✅ Zwięzłe i jasne komunikaty
- ✅ Bez ujawniania szczegółów implementacji
- ✅ Sugestie rozwiązania (gdy możliwe)
- ❌ Brak stack traces w production
- ❌ Brak raw SQL errors

---

## 8. Rozważania dotyczące wydajności

### 1. Database Query Optimization

#### A. Indeksy

**Wymagane indeksy (już zdefiniowane w migrations):**

```sql
-- parties table
CREATE INDEX idx_parties_user_id_status 
ON parties(user_id, status);

CREATE INDEX idx_parties_user_id_started_at 
ON parties(user_id, started_at DESC);

CREATE INDEX idx_parties_user_id_bac_max 
ON parties(user_id, bac_estimate_max DESC);

-- drinks table (dla drinks_preview)
CREATE INDEX idx_drinks_party_id_consumed_at 
ON drinks(party_id, consumed_at ASC);
```

**Benefit:**
- Szybkie filtrowanie po user_id i status
- Efektywne sortowanie po started_at lub bac_estimate_max
- Optymalne pobieranie pierwszych 3 drinków dla każdego party

#### B. Query Pagination

**Używamy `.range()` zamiast OFFSET:**

```typescript
const from = (page - 1) * limit;
const to = from + limit - 1;

const { data, error } = await supabase
  .from("parties")
  .select("*")
  .eq("user_id", userId)
  .range(from, to);
```

**Benefit:**
- Bardziej wydajne niż `OFFSET` dla dużych datasetów
- Supabase automatycznie optymalizuje range queries

#### C. Drinks Preview Query - Optimization Strategy

**Opcja 1: N+1 Query (prostsze, ale wolniejsze)**

```typescript
for (const party of parties) {
  const drinks = await supabase
    .from("drinks")
    .select("id, volume_ml, abv_percent, consumed_at")
    .eq("party_id", party.id)
    .order("consumed_at", { ascending: true })
    .limit(3);
  
  party.drinks_preview = drinks.data || [];
}
```

**Problem:** N+1 queries (1 dla parties + N dla drinks)

**Opcja 2: Lateral Join (zoptymalizowane, zalecane)**

```typescript
const { data, error } = await supabase
  .rpc("get_parties_with_drinks_preview", {
    p_user_id: userId,
    p_status: filters.status,
    p_sort: filters.sort,
    p_order: filters.order,
    p_limit: pagination.limit,
    p_offset: (pagination.page - 1) * pagination.limit,
  });
```

**Database Function:**

```sql
CREATE OR REPLACE FUNCTION get_parties_with_drinks_preview(
  p_user_id UUID,
  p_status TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'started_at',
  p_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  party_data JSONB,
  drinks_preview JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    row_to_json(p.*)::JSONB as party_data,
    COALESCE(
      (SELECT json_agg(d.*)
       FROM (
         SELECT id, volume_ml, abv_percent, consumed_at
         FROM drinks
         WHERE party_id = p.id
         ORDER BY consumed_at ASC
         LIMIT 3
       ) d),
      '[]'::json
    )::JSONB as drinks_preview
  FROM parties p
  WHERE p.user_id = p_user_id
    AND (p_status IS NULL OR p.status = p_status::ENUM_PARTY_STATUS)
  ORDER BY 
    CASE WHEN p_sort = 'started_at' AND p_order = 'desc' THEN p.started_at END DESC,
    CASE WHEN p_sort = 'started_at' AND p_order = 'asc' THEN p.started_at END ASC,
    CASE WHEN p_sort = 'bac_estimate_max' AND p_order = 'desc' THEN p.bac_estimate_max END DESC,
    CASE WHEN p_sort = 'bac_estimate_max' AND p_order = 'asc' THEN p.bac_estimate_max END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
```

**Benefit:**
- Pojedyncze zapytanie do bazy
- Lateral join wykorzystuje indeksy
- Znacznie szybsze dla dużych datasetów

**Rekomendacja:** Zacznij od Opcji 1 (prostsze), jeśli performance będzie problemem, przejdź na Opcję 2

### 2. Caching Strategy

#### A. HTTP Caching Headers

**Dla danych statycznych/rzadko zmieniających się:**

```typescript
// Nie zalecane dla tego endpointa - dane dynamiczne
```

**Dla tego endpointa:**
```typescript
headers: {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store, must-revalidate", // Zawsze świeże dane
}
```

**Uzasadnienie:** Lista imprez zmienia się dynamicznie (nowe drinki, statusy), więc caching może pokazywać stare dane

#### B. Server-Side Caching (Future)

**Redis cache dla często używanych queries:**

```typescript
// Przykład - nie implementujemy teraz
const cacheKey = `parties:${userId}:${status}:${page}:${limit}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... fetch from DB ...

await redis.setex(cacheKey, 60, JSON.stringify(result)); // Cache na 60s
```

**Benefit:**
- Zmniejsza load na bazie danych
- Szybsze response times

**Consideration:**
- Cache invalidation complexity
- Redis infrastructure cost

### 3. Response Size Optimization

#### A. Pagination

**Max 100 rekordów na request:**
- Prevents excessive data transfer
- Limits memory usage
- Faster response times

#### B. Field Selection

**Tylko potrzebne pola:**
- ✅ Endpoint zwraca pełne PartyDTO + drinks_preview
- ❌ Nie pobieramy wszystkich drinków (tylko preview)
- ❌ Nie pobieramy BAC calculations, alerts, events

#### C. JSON Compression

**Astro automatycznie kompresuje:**
- gzip/brotli compression
- Zmniejsza transfer size o ~70-90%

### 4. Database Connection Pooling

**Supabase automatycznie zarządza:**
- Connection pooling
- Connection reuse
- Max connections limit

**Nasza odpowiedzialność:**
- ✅ Reuse `supabase` client z `locals`
- ❌ Nie twórz nowych connections w każdym request

### 5. Query Count Optimization

**Strategia:**

1. **Parties query:** 1 query
2. **Count query:** 1 query (dla total_count)
3. **Drinks preview:** 
   - Opcja 1: N queries (jeden per party)
   - Opcja 2: 1 query (database function z lateral join)

**Docelowo:** Maximum 2-3 queries total

### 6. Monitoring i Metrics

**Zalecane do śledzenia:**

```typescript
// Log query performance
logInfo("Party list query completed", {
  userId,
  duration_ms: Date.now() - startTime,
  count: result.data.length,
  total_count: result.pagination.total_count,
  page: result.pagination.page,
});
```

**Metryki do monitorowania:**
- Average response time
- 95th percentile response time
- Query count per request
- Database query duration
- Error rate

### Performance Checklist

- [x] Database indeksy dla wszystkich query paths
- [x] Pagination (limit max 100)
- [x] Drinks preview zamiast wszystkich drinków
- [ ] Database function dla lateral join (optional optimization)
- [x] Connection pooling przez Supabase
- [x] Proper error handling (bez retry storms)
- [ ] Performance logging (do implementacji)
- [ ] Monitoring i alerting (future)

### Expected Performance Targets

**Przy założeniu normalnego użytkowania (< 1000 parties per user):**

| Metric | Target | Notes |
|--------|--------|-------|
| Response time (p50) | < 200ms | Median response time |
| Response time (p95) | < 500ms | 95th percentile |
| Response time (p99) | < 1000ms | 99th percentile |
| Max response size | < 1MB | With limit=100 |
| DB queries per request | 2-3 | Parties + count + drinks |
| Error rate | < 0.1% | Excluding user errors (400) |

---

## 9. Etapy wdrożenia

### Phase 1: Walidacja i Schemat

**Files to create/modify:**
- `src/lib/validation/party.validation.ts`

**Tasks:**

1. **Dodaj schemat walidacji query parametrów**

```typescript
/**
 * Schema for GET /api/parties query parameters
 *
 * Validates pagination, filtering, and sorting parameters
 */
export const PartyListQuerySchema = z.object({
  page: z.coerce
    .number({
      invalid_type_error: "page must be a number",
    })
    .int({
      message: "page must be an integer",
    })
    .min(1, {
      message: "page must be at least 1",
    })
    .optional()
    .default(1),

  limit: z.coerce
    .number({
      invalid_type_error: "limit must be a number",
    })
    .int({
      message: "limit must be an integer",
    })
    .min(1, {
      message: "limit must be at least 1",
    })
    .max(100, {
      message: "limit must be at most 100",
    })
    .optional()
    .default(20),

  status: z
    .enum(["ongoing", "closed"], {
      errorMap: () => ({ message: "status must be 'ongoing' or 'closed'" }),
    })
    .optional(),

  sort: z
    .enum(["started_at", "bac_estimate_max"], {
      errorMap: () => ({ message: "sort must be 'started_at' or 'bac_estimate_max'" }),
    })
    .optional()
    .default("started_at"),

  order: z
    .enum(["asc", "desc"], {
      errorMap: () => ({ message: "order must be 'asc' or 'desc'" }),
    })
    .optional()
    .default("desc"),
});
```

---

### Phase 2: Service Layer

**Files to modify:**
- `src/lib/services/party.service.ts`

**Tasks:**

1. **Dodaj funkcję `getPartyList()`**

```typescript
/**
 * Gets paginated list of user's parties with drinks preview
 *
 * Returns parties sorted by specified column with pagination.
 * Each party includes preview of first 3 drinks.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param filters - Filtering and sorting options
 * @param pagination - Page number and limit
 * @returns Paginated list of parties with metadata
 * @throws Error if database query fails
 */
export async function getPartyList(
  supabase: SupabaseClient,
  userId: string,
  filters: {
    status?: "ongoing" | "closed";
    sort?: "started_at" | "bac_estimate_max";
    order?: "asc" | "desc";
  },
  pagination: {
    page: number;
    limit: number;
  }
): Promise<PartyListResponseDTO> {
  // Step 1: Build base query with filters and sorting
  const from = (pagination.page - 1) * pagination.limit;
  const to = from + pagination.limit - 1;

  let query = supabase
    .from("parties")
    .select("*")
    .eq("user_id", userId);

  // Apply status filter if provided
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Apply sorting
  const sortColumn = filters.sort || "started_at";
  const sortOrder = filters.order || "desc";
  query = query.order(sortColumn, { ascending: sortOrder === "asc" });

  // Apply pagination
  query = query.range(from, to);

  // Execute query
  const { data: parties, error: partiesError } = await query;

  if (partiesError) {
    logError("Failed to fetch parties list", { userId, error: partiesError.message });
    throw new Error(`Database error: ${partiesError.message}`);
  }

  // Step 2: Get total count for pagination metadata
  let countQuery = supabase
    .from("parties")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (filters.status) {
    countQuery = countQuery.eq("status", filters.status);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    logError("Failed to count parties", { userId, error: countError.message });
    throw new Error(`Database error: ${countError.message}`);
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pagination.limit);

  // Step 3: Fetch drinks preview for each party (first 3 drinks)
  const partiesWithPreview: PartyListItemDTO[] = await Promise.all(
    (parties || []).map(async (party) => {
      const { data: drinks, error: drinksError } = await supabase
        .from("drinks")
        .select("id, volume_ml, abv_percent, consumed_at")
        .eq("party_id", party.id)
        .order("consumed_at", { ascending: true })
        .limit(3);

      if (drinksError) {
        logWarning("Failed to fetch drinks preview for party", {
          partyId: party.id,
          error: drinksError.message,
        });
        // Continue with empty preview if drinks fetch fails
      }

      // Map to PartyListItemDTO
      const partyDTO: PartyListItemDTO = {
        ...party,
        profile_snapshot: party.profile_snapshot as ProfileSnapshot,
        created_at: new Date(party.created_at).toISOString(),
        updated_at: new Date(party.updated_at).toISOString(),
        started_at: new Date(party.started_at).toISOString(),
        ended_at: party.ended_at ? new Date(party.ended_at).toISOString() : null,
        blackout_marked_at: party.blackout_marked_at
          ? new Date(party.blackout_marked_at).toISOString()
          : null,
        drinks_preview: (drinks || []).map((drink) => ({
          id: drink.id,
          volume_ml: drink.volume_ml,
          abv_percent: drink.abv_percent,
          consumed_at: new Date(drink.consumed_at).toISOString(),
        })),
      };

      return partyDTO;
    })
  );

  // Step 4: Construct response
  const response: PartyListResponseDTO = {
    data: partiesWithPreview,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total_count: totalCount,
      total_pages: totalPages,
    },
  };

  logInfo("Party list fetched successfully", {
    userId,
    count: partiesWithPreview.length,
    total_count: totalCount,
    page: pagination.page,
  });

  return response;
}
```

2. **Dodaj helper types (jeśli potrzebne)**

```typescript
import type {
  PartyListResponseDTO,
  PartyListItemDTO,
  DrinkPreview,
  ProfileSnapshot,
  PartyStatus,
} from "../../types";
```

**Verification:**
- [ ] Funkcja zwraca poprawny format danych
- [ ] Paginacja działa poprawnie
- [ ] Filtrowanie po status działa
- [ ] Sortowanie działa (asc/desc, różne kolumny)
- [ ] Drinks preview zawiera max 3 drinki
- [ ] Timestamps są w formacie ISO string
- [ ] Obsługa błędów działa poprawnie

---

### Phase 3: API Route - GET Handler

**Files to modify:**
- `src/pages/api/parties.ts`

**Tasks:**

1. **Dodaj GET handler do istniejącego pliku**

```typescript
/**
 * GET /api/parties
 *
 * Retrieves paginated list of user's party history.
 * Supports filtering, sorting, and pagination.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User can only view their own parties
 *
 * Query Parameters:
 *   - page: number (default: 1, min: 1)
 *   - limit: number (default: 20, min: 1, max: 100)
 *   - status: string (optional: 'ongoing' | 'closed')
 *   - sort: string (default: 'started_at', options: 'started_at' | 'bac_estimate_max')
 *   - order: string (default: 'desc', options: 'asc' | 'desc')
 *
 * Success Response (200):
 *   - PartyListResponseDTO with paginated data
 *
 * Error Responses:
 *   - 400: Invalid query parameters
 *   - 401: Missing or invalid authentication token
 *   - 500: Internal server error
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;

    if (!supabase) {
      logError("Supabase client not available in locals");
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred. Please try again later.",
          },
        } satisfies APIError),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // DEVELOPMENT MODE: Use default user ID instead of authentication
    // TODO: Replace with proper JWT authentication
    const userId = DEFAULT_USER_ID;

    // Parse query parameters from URL
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status"),
      sort: url.searchParams.get("sort"),
      order: url.searchParams.get("order"),
    };

    // Validate query parameters against schema
    const validationResult = PartyListQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      logWarning("Validation failed for GET /api/parties", { userId, errors: formattedErrors });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid query parameters",
            details: { errors: formattedErrors },
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract validated data
    const { page, limit, status, sort, order } = validationResult.data;

    // Call service to get party list
    try {
      const result = await getPartyList(
        supabase,
        userId,
        { status, sort, order },
        { page, limit }
      );

      logInfo("Party list retrieved successfully", {
        userId,
        count: result.data.length,
        total_count: result.pagination.total_count,
        page: result.pagination.page,
      });

      // Return successful response
      return new Response(JSON.stringify(result satisfies PartyListResponseDTO), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (serviceError) {
      // Handle service layer errors
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        // Database errors
        if (errorMessage.startsWith("Database error:")) {
          logError("Database error in GET /api/parties", {
            userId,
            error: errorMessage,
            filters: { status, sort, order },
            pagination: { page, limit },
          });

          return new Response(
            JSON.stringify({
              error: {
                code: "DATABASE_ERROR",
                message: "An unexpected error occurred. Please try again later.",
              },
            } satisfies APIError),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Generic unexpected errors
      logError("Unexpected error in GET /api/parties", {
        userId,
        error: String(serviceError),
        filters: { status, sort, order },
        pagination: { page, limit },
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred. Please try again later.",
          },
        } satisfies APIError),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    // Catch-all for unexpected errors in route handler
    logError("Unexpected error in GET /api/parties route handler", {
      error: String(error),
    });

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later.",
        },
      } satisfies APIError),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
```

2. **Dodaj import do validation schema**

```typescript
import { PartyListQuerySchema } from "../../lib/validation/party.validation";
```

3. **Dodaj import do service**

```typescript
import { startParty, getPartyList } from "../../lib/services/party.service";
```

4. **Dodaj import types**

```typescript
import type { APIError, PartyDTO, PartyListResponseDTO } from "../../types";
```

**Verification:**
- [ ] GET endpoint odpowiada na /api/parties
- [ ] Walidacja query params działa
- [ ] Service jest wywoływany z poprawnymi parametrami
- [ ] Response ma status 200 dla sukcesu
- [ ] Response ma poprawny format PartyListResponseDTO
- [ ] Error handling działa dla wszystkich scenariuszy
- [ ] Logging działa poprawnie

---

### Phase 4: Testing

**Tasks:**

1. **Manual Testing przez Postman/curl**

```bash
# Test 1: Basic request (default parameters)
curl -X GET http://localhost:4321/api/parties

# Test 2: With pagination
curl -X GET "http://localhost:4321/api/parties?page=1&limit=10"

# Test 3: With status filter
curl -X GET "http://localhost:4321/api/parties?status=closed"

# Test 4: With sorting
curl -X GET "http://localhost:4321/api/parties?sort=bac_estimate_max&order=desc"

# Test 5: Combined filters
curl -X GET "http://localhost:4321/api/parties?page=2&limit=5&status=closed&sort=started_at&order=asc"

# Test 6: Invalid page (should return 400)
curl -X GET "http://localhost:4321/api/parties?page=0"

# Test 7: Invalid limit (should return 400)
curl -X GET "http://localhost:4321/api/parties?limit=200"

# Test 8: Invalid status (should return 400)
curl -X GET "http://localhost:4321/api/parties?status=invalid"

# Test 9: Invalid sort (should return 400)
curl -X GET "http://localhost:4321/api/parties?sort=invalid_column"

# Test 10: Empty result set
curl -X GET "http://localhost:4321/api/parties?status=ongoing"
```

2. **Test Cases Checklist**

**Happy Path:**
- [ ] GET bez parametrów zwraca domyślną stronę (page=1, limit=20)
- [ ] GET z page=2 zwraca drugą stronę
- [ ] GET z limit=10 zwraca 10 rekordów (lub mniej jeśli brak)
- [ ] GET z status=ongoing zwraca tylko ongoing parties
- [ ] GET z status=closed zwraca tylko closed parties
- [ ] GET z sort=started_at sortuje po started_at
- [ ] GET z sort=bac_estimate_max sortuje po BAC
- [ ] GET z order=asc sortuje rosnąco
- [ ] GET z order=desc sortuje malejąco
- [ ] Drinks preview zawiera max 3 drinki
- [ ] Drinks preview jest posortowane po consumed_at ASC
- [ ] Pagination metadata jest poprawna (total_count, total_pages)
- [ ] Timestamps są w formacie ISO 8601

**Edge Cases:**
- [ ] Pusta lista zwraca 200 z pustą tablicą
- [ ] Page poza zakresem zwraca pustą tablicę (nie 404)
- [ ] Party bez drinków ma pustą drinks_preview
- [ ] Limit=1 zwraca 1 rekord
- [ ] Limit=100 zwraca max 100 rekordów
- [ ] Status filter zwraca tylko matching parties

**Error Cases:**
- [ ] page=0 zwraca 400 z validation error
- [ ] page=-1 zwraca 400
- [ ] limit=0 zwraca 400
- [ ] limit=150 zwraca 400
- [ ] status=invalid zwraca 400
- [ ] sort=invalid zwraca 400
- [ ] order=invalid zwraca 400
- [ ] page=abc (non-numeric) zwraca 400
- [ ] Database error zwraca 500

---

### Phase 5: Performance Optimization (Optional)

**Tasks:**

1. **Verify Database Indexes**

```sql
-- Check if indexes exist
SELECT * FROM pg_indexes 
WHERE tablename IN ('parties', 'drinks')
AND indexname LIKE 'idx_%';

-- If missing, add indexes (should already exist from migrations)
CREATE INDEX IF NOT EXISTS idx_parties_user_id_status 
ON parties(user_id, status);

CREATE INDEX IF NOT EXISTS idx_parties_user_id_started_at 
ON parties(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_parties_user_id_bac_max 
ON parties(user_id, bac_estimate_max DESC);

CREATE INDEX IF NOT EXISTS idx_drinks_party_id_consumed_at 
ON drinks(party_id, consumed_at ASC);
```

2. **Measure Query Performance**

```typescript
// Add to getPartyList()
const startTime = Date.now();

// ... queries ...

const duration = Date.now() - startTime;
logInfo("Party list query performance", {
  userId,
  duration_ms: duration,
  count: parties?.length || 0,
  total_count: totalCount,
});
```

3. **Consider Database Function (jeśli N+1 jest problemem)**

```sql
-- Create optimized function with lateral join
-- (Patrz sekcja Performance - Query Optimization)
```

**Verification:**
- [ ] Query duration < 200ms dla typowych przypadków
- [ ] Query duration < 500ms dla p95
- [ ] Indexes są używane (sprawdź EXPLAIN ANALYZE)
- [ ] N+1 problem nie występuje (lub jest akceptowalny)

---

### Phase 6: Documentation and Cleanup

**Tasks:**

1. **Update README lub API docs**

```markdown
## GET /api/parties

Retrieves paginated list of user's party history.

### Request

```
GET /api/parties?page=1&limit=20&status=closed&sort=started_at&order=desc
```

### Response

```json
{
  "data": [...],
  "pagination": {...}
}
```

See [API Documentation](./docs/api.md) for details.
```

2. **Add JSDoc comments** (już zrobione w kodzie powyżej)

3. **Code review checklist**

- [ ] Kod jest zgodny z coding guidelines
- [ ] Wszystkie funkcje mają JSDoc comments
- [ ] Error handling jest kompletny
- [ ] Logging jest odpowiedni (info/warning/error)
- [ ] Typy TypeScript są poprawne
- [ ] Brak console.log() w kodzie
- [ ] Brak hardcoded values
- [ ] Kod jest czytelny i maintainable

4. **Clean up development artifacts**

- [ ] Usuń debug console.logs
- [ ] Usuń commented code
- [ ] Usuń unused imports
- [ ] Run linter: `npm run lint`
- [ ] Run formatter: `npm run format`

**Verification:**
- [ ] Documentation jest kompletna
- [ ] Code review passed
- [ ] Linter nie zgłasza błędów
- [ ] Formatter jest zastosowany

---

### Phase 7: Deployment Preparation

**Tasks:**

1. **Environment Variables Check**

```bash
# Verify .env variables
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

2. **Production Checklist**

- [ ] Remove or properly handle DEFAULT_USER_ID
- [ ] Implement JWT authentication (replace development mode)
- [ ] Verify RLS policies are enabled in Supabase
- [ ] Test with production-like data volumes
- [ ] Verify CORS settings (if needed)
- [ ] Set up monitoring/logging (e.g., Sentry)
- [ ] Configure rate limiting (if needed)

3. **Migration Verification**

```bash
# Verify all migrations are applied
npx supabase migration list
```

4. **Security Audit**

- [ ] No sensitive data in logs
- [ ] No SQL injection vulnerabilities
- [ ] Authorization is enforced
- [ ] Input validation is complete
- [ ] Error messages don't leak sensitive info

**Verification:**
- [ ] Endpoint działa w staging environment
- [ ] Security audit passed
- [ ] Performance testing passed
- [ ] Ready for production deployment

---

## Summary

**Estimated Implementation Time:**
- Phase 1 (Validation): 1 hour
- Phase 2 (Service): 2-3 hours
- Phase 3 (API Route): 1-2 hours
- Phase 4 (Testing): 2-3 hours
- Phase 5 (Optimization): 1-2 hours (optional)
- Phase 6 (Documentation): 1 hour
- Phase 7 (Deployment): 1 hour

**Total:** ~9-13 hours (bez Phase 5 optional optimization)

**Key Files Modified:**
1. `src/lib/validation/party.validation.ts` - Add PartyListQuerySchema
2. `src/lib/services/party.service.ts` - Add getPartyList()
3. `src/pages/api/parties.ts` - Add GET handler

**Key Dependencies:**
- Existing types in `src/types.ts` (PartyListResponseDTO, etc.)
- Existing database schema (parties, drinks tables)
- Existing logger (`src/lib/logger.ts`)
- Supabase client from middleware

**Success Criteria:**
- ✅ Endpoint zwraca spaginowaną listę imprez
- ✅ Filtrowanie i sortowanie działa poprawnie
- ✅ Validation error handling działa
- ✅ Performance jest akceptowalna
- ✅ Kod jest zgodny z guidelines
- ✅ Wszystkie testy przechodzą
