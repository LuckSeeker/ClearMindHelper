# PostgreSQL Database Schema - ClearMindHelper MVP

## 1. Tabele

### 1.1 UserProfiles

Przechowuje dane osobowe użytkownika wymagane do obliczeń BAC.

```sql
CREATE TABLE UserProfiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm INT NOT NULL CHECK (height_cm BETWEEN 50 AND 250),
  weight_kg DECIMAL(5, 2) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  gender ENUM_GENDER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `user_id`: Referencja do użytkownika z auth.users (Supabase)
- `height_cm`: Wzrost w centymetrach (50–250 cm)
- `weight_kg`: Waga w kilogramach (30–300 kg)
- `gender`: Płeć (ENUM: 'M', 'F')
- `created_at`: Timestamp utworzenia
- `updated_at`: Timestamp ostatniej aktualizacji

**Ograniczenia:**

- CHECK na height_cm i weight_kg dla realistycznych wartości
- UNIQUE na user_id (jeden profil na użytkownika)
- ON DELETE CASCADE (usunięcie użytkownika usuwa profil)

---

### 1.2 Parties

Sesje imprezowe z cached statystykami BAC.

```sql
CREATE TABLE Parties (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  status ENUM_PARTY_STATUS NOT NULL DEFAULT 'ongoing',
  profile_snapshot JSONB NOT NULL,
  bac_estimate_max DECIMAL(4, 2) DEFAULT 0.00,
  total_drinks_count INT DEFAULT 0,
  total_ml_consumed INT DEFAULT 0,
  blackout_marked BOOLEAN DEFAULT FALSE,
  blackout_marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `user_id`: Referencja do użytkownika
- `started_at`: Timestamp rozpoczęcia imprezy
- `ended_at`: Timestamp zakończenia (nullable, jeśli trwa)
- `status`: Status imprezy (ENUM: 'ongoing', 'closed')
- `profile_snapshot`: JSONB snapshot profilu użytkownika {height_cm, weight_kg, gender, captured_at}
- `bac_estimate_max`: Maksymalne BAC osiągnięte w imprezie (cached)
- `total_drinks_count`: Liczba napojów (cached)
- `total_ml_consumed`: Łączna ilość ml (cached)
- `blackout_marked`: Czy oznaczono urwanie filmu
- `blackout_marked_at`: Timestamp oznaczenia urwania
- `created_at`, `updated_at`: Timestamps

**Ograniczenia:**

- status default 'ongoing'
- profile_snapshot immutable (snapshot w momencie startu)
- Cache'owane pola aktualizowane via trigger/app logic

---

### 1.3 Drinks

Wpisy napojów z historią edycji.

```sql
CREATE TABLE Drinks (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES Parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_ml INT NOT NULL CHECK (volume_ml > 0 AND volume_ml <= 5000),
  abv_percent DECIMAL(3, 1) NOT NULL CHECK (abv_percent BETWEEN 0.1 AND 100),
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  original_values JSONB,
  edited_at TIMESTAMP WITH TIME ZONE,
  edit_count INT DEFAULT 0,
  order_sequence INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `party_id`: Referencja do imprezy
- `user_id`: Denormalizacja dla ułatwienia RLS (referencja do użytkownika)
- `volume_ml`: Ilość napoju w ml (> 0, <= 5000)
- `abv_percent`: Zawartość alkoholu (0.1–100)
- `consumed_at`: Timestamp spożycia (w obrębie zakresu party)
- `original_values`: JSONB {volume_ml_before, abv_percent_before} jeśli edytowano
- `edited_at`: Timestamp edycji
- `edit_count`: Liczba edycji (dla auditingu)
- `order_sequence`: Porządek napojów w imprezie
- `created_at`, `updated_at`: Timestamps

**Ograniczenia:**

- volume_ml > 0 i <= 5000
- abv_percent między 0.1 i 100
- Denormalizacja user_id dla efektywności RLS

---

### 1.4 BACCalculations

Historia szacowań BAC dla każdego napoju.

```sql
CREATE TABLE BACCalculations (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES Parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drink_id BIGINT NOT NULL REFERENCES Drinks(id) ON DELETE CASCADE,
  calculated_bac DECIMAL(4, 2) NOT NULL CHECK (calculated_bac BETWEEN 0 AND 0.99),
  calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  algorithm_version VARCHAR(50) DEFAULT 'Widmark v1',
  user_profile_snapshot JSONB NOT NULL,
  time_since_first_drink_minutes INT,
  metabolized_alcohol_g DECIMAL(6, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `party_id`: Referencja do imprezy
- `user_id`: Denormalizacja dla RLS
- `drink_id`: Referencja do napoju
- `calculated_bac`: Obliczone BAC (0.00–0.99‰)
- `calculation_timestamp`: Timestamp kalkulacji
- `algorithm_version`: Wersja algorytmu (Widmark v1, etc.)
- `user_profile_snapshot`: JSONB snapshot profilu użytkownika w momencie kalkulacji
- `time_since_first_drink_minutes`: Czas od pierwszego napoju
- `metabolized_alcohol_g`: Gram alkoholu zmetabolizowanego
- `created_at`: Timestamp zapisu

**Ograniczenia:**

- calculated_bac między 0 i 0.99 (realistyczne zakresy)
- Immutable record (brak edycji, tylko inserty do historii)

---

### 1.5 UserThresholds

Bieżące i historyczne progi BAC użytkownika.

```sql
CREATE TABLE UserThresholds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold_bac DECIMAL(4, 2) NOT NULL CHECK (threshold_bac BETWEEN 0.08 AND 0.50),
  is_current BOOLEAN DEFAULT TRUE,
  reason ENUM_THRESHOLD_REASON NOT NULL,
  trigger_party_id BIGINT REFERENCES Parties(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `user_id`: Referencja do użytkownika
- `threshold_bac`: Wartość progu (0.08–0.50 dla algorytmicznej stabilności)
- `is_current`: Czy to bieżący próg
- `reason`: Powód zmiany (ENUM: 'blackout_marked', 'manual_override', 'default')
- `trigger_party_id`: Która impreza spowodowała zmianę (dla US-014)
- `created_at`: Timestamp utworzenia

**Ograniczenia:**

- CHECK na threshold_bac (min 0.08, max 0.50)
- is_current=true zapewnia jeden aktywny próg
- Historyczne progi przechowywane z is_current=false

---

### 1.6 Alerts

Bieżące alerty o zbliżeniu/przekroczeniu progu.

```sql
CREATE TABLE Alerts (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES Parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type ENUM_ALERT_TYPE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  bac_at_alert DECIMAL(4, 2) NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_alert_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `party_id`: Referencja do imprezy
- `user_id`: Denormalizacja dla RLS
- `alert_type`: Typ alertu (ENUM: 'approaching_threshold', 'exceeded_threshold')
- `is_active`: Czy alert jest aktywny
- `bac_at_alert`: BAC w momencie alertu
- `triggered_at`: Timestamp wyzwolenia alertu
- `last_alert_sent_at`: Timestamp ostatniego wysłanego powiadomienia (dla logiki 5-min)
- `created_at`, `updated_at`: Timestamps

**Ograniczenia:**

- Jeden aktywny alert per party i alert_type
- last_alert_sent_at dla logiki powtarzania co 5 minut

---

### 1.7 Events

Telemetria zdarzeń dla analityki i auditingu.

```sql
CREATE TABLE Events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id BIGINT REFERENCES Parties(id) ON DELETE SET NULL,
  event_type ENUM_EVENT_TYPE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**

- `id`: Identyfikator główny
- `user_id`: Referencja do użytkownika
- `party_id`: Referencja do imprezy (nullable, jeśli event nie jest związany z imprezą)
- `event_type`: Typ zdarzenia (ENUM: 'drink_added', 'drink_edited', 'party_started', 'party_closed', 'blackout_marked', 'threshold_adjusted', 'fast_consumption_warning')
- `created_at`: Timestamp zdarzenia

**Ograniczenia:**

- Minimalna telemetria (per decyzja z sesji)
- Brak event_data JSONB (minimalizacja storage)
- party_id nullable dla event-ów niezwiązanych z imprezą

---

## 2. Typy ENUM

```sql
CREATE TYPE ENUM_GENDER AS ENUM ('M', 'F');
CREATE TYPE ENUM_PARTY_STATUS AS ENUM ('ongoing', 'closed');
CREATE TYPE ENUM_THRESHOLD_REASON AS ENUM ('blackout_marked', 'manual_override', 'default');
CREATE TYPE ENUM_ALERT_TYPE AS ENUM ('approaching_threshold', 'exceeded_threshold');
CREATE TYPE ENUM_EVENT_TYPE AS ENUM (
  'drink_added',
  'drink_edited',
  'party_started',
  'party_closed',
  'blackout_marked',
  'threshold_adjusted',
  'fast_consumption_warning'
);
```

---

## 3. Relacje między tabelami

| Tabela 1        | Kolumna          | Tabela 2   | Kolumna | Kardynalność | Opis                                  |
| --------------- | ---------------- | ---------- | ------- | ------------ | ------------------------------------- |
| UserProfiles    | user_id          | auth.users | id      | 1:1          | Jeden profil na użytkownika           |
| Parties         | user_id          | auth.users | id      | N:1          | Użytkownik ma wiele imprez            |
| Drinks          | party_id         | Parties    | id      | N:1          | Impreza ma wiele napojów              |
| Drinks          | user_id          | auth.users | id      | N:1          | Denormalizacja dla RLS                |
| BACCalculations | party_id         | Parties    | id      | N:1          | Impreza ma wiele obliczeń BAC         |
| BACCalculations | drink_id         | Drinks     | id      | N:1          | Jeden napój → jedno obliczenie BAC    |
| BACCalculations | user_id          | auth.users | id      | N:1          | Denormalizacja dla RLS                |
| UserThresholds  | user_id          | auth.users | id      | N:1          | Użytkownik ma wiele progów (historia) |
| UserThresholds  | trigger_party_id | Parties    | id      | N:1          | Impreza może wyzwolić zmianę progu    |
| Alerts          | party_id         | Parties    | id      | N:1          | Impreza ma wiele alertów              |
| Alerts          | user_id          | auth.users | id      | N:1          | Denormalizacja dla RLS                |
| Events          | user_id          | auth.users | id      | N:1          | Użytkownik ma wiele zdarzeń           |
| Events          | party_id         | Parties    | id      | N:1          | Impreza generuje zdarzenia            |

---

## 4. Indeksy

| Tabela          | Kolumny                                   | Typ       | Uzasadnienie                          |
| --------------- | ----------------------------------------- | --------- | ------------------------------------- |
| Parties         | (user_id, status, started_at DESC)        | Composite | Pobranie aktywnej imprezy użytkownika |
| Parties         | (user_id, started_at DESC)                | Composite | Historia imprez                       |
| Drinks          | (party_id, consumed_at ASC)               | Composite | Lista napojów w imprezie, sorted      |
| Drinks          | (party_id, order_sequence DESC)           | Composite | Pobranie ostatniego napoju do edycji  |
| BACCalculations | (party_id, created_at DESC)               | Composite | Najnowsze obliczenia BAC imprezy      |
| BACCalculations | (drink_id)                                | Simple    | Lookup BAC dla napoju                 |
| Alerts          | (party_id, is_active, last_alert_sent_at) | Composite | Polling alertów co 5 minut            |
| UserThresholds  | (user_id, is_current)                     | Composite | Pobranie bieżącego progu              |
| UserThresholds  | (trigger_party_id)                        | Simple    | Historia zmian progów                 |
| Events          | (user_id, event_type, created_at DESC)    | Composite | Analityka zdarzeń                     |
| Events          | (party_id, created_at DESC)               | Composite | Zdarzenia imprezy                     |
| UserProfiles    | (user_id)                                 | Simple    | Lookup profilu (już UNIQUE)           |

---

## 5. Zasady Row Level Security (RLS)

Wszystkie tabele powinny mieć włączone RLS i być chronione politykami, aby każdy użytkownik widział tylko swoje dane:

### 5.1 UserProfiles

```sql
ALTER TABLE UserProfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON UserProfiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON UserProfiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON UserProfiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 5.2 Parties

```sql
ALTER TABLE Parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own parties"
  ON Parties FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create parties"
  ON Parties FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own parties"
  ON Parties FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 5.3 Drinks

```sql
ALTER TABLE Drinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view drinks in their parties"
  ON Drinks FOR SELECT
  USING (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add drinks to their parties"
  ON Drinks FOR INSERT
  WITH CHECK (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update drinks in their parties"
  ON Drinks FOR UPDATE
  USING (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );
```

### 5.4 BACCalculations

```sql
ALTER TABLE BACCalculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view BAC calculations for their parties"
  ON BACCalculations FOR SELECT
  USING (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert BAC calculations"
  ON BACCalculations FOR INSERT
  WITH CHECK (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );
```

### 5.5 UserThresholds

```sql
ALTER TABLE UserThresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thresholds"
  ON UserThresholds FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own thresholds"
  ON UserThresholds FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert thresholds"
  ON UserThresholds FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### 5.6 Alerts

```sql
ALTER TABLE Alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their parties"
  ON Alerts FOR SELECT
  USING (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage alerts for user parties"
  ON Alerts FOR INSERT
  WITH CHECK (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can update alerts"
  ON Alerts FOR UPDATE
  USING (
    party_id IN (
      SELECT id FROM Parties WHERE user_id = auth.uid()
    )
  );
```

### 5.7 Events

```sql
ALTER TABLE Events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON Events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can log events"
  ON Events FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

---

## 6. Triggery i Automatyczne Aktualizacje

### 6.1 Trigger: Aktualizacja updated_at

Dla tabel z `updated_at`, można dodać trigger:

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_timestamp
BEFORE UPDATE ON UserProfiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_parties_timestamp
BEFORE UPDATE ON Parties
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_drinks_timestamp
BEFORE UPDATE ON Drinks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_alerts_timestamp
BEFORE UPDATE ON Alerts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

### 6.2 Trigger: Aktualizacja Parties cache'u (opcjonalnie)

```sql
CREATE OR REPLACE FUNCTION update_party_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE Parties
  SET
    total_drinks_count = (SELECT COUNT(*) FROM Drinks WHERE party_id = NEW.party_id),
    total_ml_consumed = (SELECT COALESCE(SUM(volume_ml), 0) FROM Drinks WHERE party_id = NEW.party_id),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.party_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_party_cache_on_drink_add
AFTER INSERT ON Drinks
FOR EACH ROW
EXECUTE FUNCTION update_party_cache();

CREATE TRIGGER update_party_cache_on_drink_update
AFTER UPDATE ON Drinks
FOR EACH ROW
EXECUTE FUNCTION update_party_cache();
```

---

## 7. Dodatkowe Uwagi i Decyzje Projektowe

### 7.1 Denormalizacja

- `Drinks.user_id` i `BACCalculations.user_id` przechowują user_id dla ułatwienia RLS filtering bez dodatkowych JOIN'ów.
- `Parties.profile_snapshot` (JSONB) przechowuje snapshot profilu w momencie startu imprezy — immutable dla historii.
- Cache'owane pola w Parties (`total_drinks_count`, `total_ml_consumed`, `bac_estimate_max`) aktualizowane via trigger/app logic dla szybkiego dostępu.

### 7.2 BAC Granularity

- BAC obliczany tylko na drink timestamps, bez interpolacji w BD (per decyzja z sesji).
- Frontend może interpolować dla wizualizacji, jeśli potrzeba.
- BACCalculations przechowuje immutable history obliczeń.

### 7.3 Threshold Adaptation (US-014)

- Nowy próg = BAC w ostatnim wpisie BAC calculations gdy blackout_marked = true w Parties.
- Zmiana progu tworzy nowy rekord w UserThresholds z is_current = true; poprzedni ustawia się na false.
- trigger_party_id wskazuje, która impreza spowodowała zmianę (dla analytics).

### 7.4 Alert Management

- Jeden aktywny alert per party na alert_type.
- Backend (cron) co 5 minut wysyła powiadomienia UI dla alertów z is_active = true i last_alert_sent_at < NOW() - INTERVAL '5 minutes'.
- Gdy BAC spadnie poniżej progu lub impreza zamknie się, is_active = false.

### 7.5 Events Telemetry (Minimalna)

- Każde zdarzenie logowane z minimal zestawem: event_type, user_id, party_id (nullable), created_at.
- Brak event_data JSONB (per decyzja z sesji — minimalna telemetria).
- Events dla: drink_added, drink_edited, party_started, party_closed, blackout_marked, threshold_adjusted, fast_consumption_warning.

### 7.6 Data Types

- `DECIMAL(4,2)` dla BAC (precyzja 0.01‰, zakres 0.00–99.99; praktycznie 0.00–0.99).
- `ENUM('M', 'F')` dla gender (brak 'Other' w MVP; przyszłość może wspierać niestandardowe Widmark constants).
- `TIMESTAMP WITH TIME ZONE` dla wszystkich timestamps (dla konsystencji przy zmianach stref czasowych).

### 7.7 Bezpieczeństwo

- Hasła przechowywane przez Supabase Auth (auth.users), aplikacja nie przechowuje haseł.
- RLS políticas zapewniają data isolation (każdy użytkownik widzi tylko swoje dane).
- CHECK constraints na wiele pól dla walidacji na poziomie BD (height, weight, volume, abv, bac).

### 7.8 Skalowalność (MVP)

- Indeksy dla głównych access patterns (user_id, party_id, timestamps).
- Denormalizacja strategiczna (user_id w Drinks/BACCalculations/Alerts) dla szybkości RLS queries.
- Przyszłe optymalizacje: partycjonowanie po created_at, read replicas, Redis cache dla active parties.

### 7.9 Constraints Szczegółowo

| Tabela          | Constraint     | Wartości        | Uzasadnienie             |
| --------------- | -------------- | --------------- | ------------------------ |
| UserProfiles    | height_cm      | 50–250 cm       | Realistyczne zakresy     |
| UserProfiles    | weight_kg      | 30–300 kg       | Realistyczne zakresy     |
| Drinks          | volume_ml      | > 0, <= 5000 ml | Realnie spożywane ilości |
| Drinks          | abv_percent    | 0.1–100%        | Zakres alkoholi          |
| BACCalculations | calculated_bac | 0–0.99‰         | Realistyczne zakresy BAC |
| UserThresholds  | threshold_bac  | 0.08–0.50       | Algorytmiczna stabilność |

---

## 8. Workflow Kluczowych Procesów

### 8.1 Dodawanie napoju (US-005)

1. Utwórz Drink (volume_ml, abv_percent, consumed_at, order_sequence).
2. Oblicz BAC (Widmark) dla nowego napoju.
3. Utwórz BACCalculation.
4. Sprawdź alerty:
   - Jeśli BAC >= 0.90 \* current_threshold → utwórz Alert (approaching_threshold).
   - Jeśli BAC >= current_threshold → utwórz/update Alert (exceeded_threshold, is_active=true).
5. Log Event (event_type: 'drink_added').
6. Aktualizuj Parties cache (total_drinks_count, total_ml_consumed, bac_estimate_max).

### 8.2 Edycja napoju (US-006)

1. Edytuj Drink (ostanie w party):
   - Ustaw original_values: {volume_ml_before, abv_percent_before}.
   - Ustaw edited_at, increment edit_count.
2. Recalculate BAC dla tego napoju + wszystkie następne.
3. Update all downstream BACCalculations.
4. Re-check alerts (może się zmienić SAC).
5. Log Event (event_type: 'drink_edited').

### 8.3 Zamknięcie imprezy (US-007)

1. Ustaw Parties.ended_at, status = 'closed'.
2. Log Event (event_type: 'party_closed').

### 8.4 Oznaczenie urwania (US-008)

1. Ustaw Parties.blackout_marked = true, blackout_marked_at = CURRENT_TIMESTAMP.
2. Query peak_bac z BACCalculations: SELECT MAX(calculated_bac) WHERE party_id = X.
3. Utwórz nowy UserThreshold: threshold_bac = peak_bac, reason = 'blackout_marked', trigger_party_id = party_id, is_current = true.
4. Aktualizuj poprzedni UserThreshold: is_current = false (WHERE user_id = X AND is_current = true AND id != new_threshold.id).
5. Log Event (event_type: 'blackout_marked').
6. Log Event (event_type: 'threshold_adjusted').

### 8.5 Powtarzające się alerty (US-011)

1. Cron co 5 minut: SELECT \* FROM Alerts WHERE is_active = true AND last_alert_sent_at < NOW() - INTERVAL '5 minutes'.
2. Dla każdego: wyślij powiadomienie UI.
3. UPDATE Alerts SET last_alert_sent_at = NOW().
4. Jeśli BAC spadnie (via new drink lub time-based decay), UPDATE Alerts: is_active = false.

---

## 9. Migracje Inicjalne

Schemat powyżej można implementować za pomocą Supabase migrations lub Flyway/Liquibase. Supabase umożliwia tworzenie migracji SQL w folderze `supabase/migrations/`.

Przykład struktury:

```
supabase/migrations/
  ├── 20240104120000_init_enums.sql
  ├── 20240104120100_init_tables.sql
  ├── 20240104120200_init_indexes.sql
  ├── 20240104120300_init_rls_policies.sql
  └── 20240104120400_init_triggers.sql
```

Każda migracja powinna być idempotent (IF NOT EXISTS, DROP IF EXISTS itp.).

---

## 10. Walidacja i Testowanie

- Constraints na BD zapewniają walidację na poziomie bazy.
- RLS políticas testować via Supabase dashboard.
- Triggery i cache'y testować z przykładowymi danymi.
- BAC calculations testować ręcznie względem Widmark formula.
