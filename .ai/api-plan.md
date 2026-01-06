# REST API Plan - ClearMindHelper

## 1. Resources

The API is organized around the following main resources, each corresponding to database entities:

- **Auth** - User authentication and session management (Supabase Auth)
- **Profile** - User profile data (UserProfiles table)
- **Parties** - Party sessions (Parties table)
- **Drinks** - Drink entries within parties (Drinks table)
- **BAC** - Blood Alcohol Content calculations (BACCalculations table)
- **Thresholds** - User BAC thresholds (UserThresholds table)
- **Alerts** - Active alerts for parties (Alerts table)
- **Events** - Telemetry events (Events table)

---

## 2. Endpoints

### 2.1 User Profile

#### Get User Profile

**Endpoint:** `GET /api/profile`

**Description:** Retrieves the authenticated user's profile data.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "user_id": "uuid",
  "height_cm": "integer | null",
  "weight_kg": "decimal | null",
  "gender": "string ('M' | 'F') | null",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "is_complete": "boolean"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Profile not found (should trigger profile creation)

**Business Logic:**
- Returns profile data for authenticated user
- `is_complete` computed field indicates if all required fields are filled
- Corresponds to US-003, US-018

---

#### Create/Update User Profile

**Endpoint:** `PUT /api/profile`

**Description:** Creates or updates the user's profile with physical data required for BAC calculations.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "height_cm": "integer (required, 50-250)",
  "weight_kg": "decimal (required, 30-300)",
  "gender": "string (required, 'M' | 'F')"
}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "user_id": "uuid",
  "height_cm": "integer",
  "weight_kg": "decimal",
  "gender": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "is_complete": "boolean"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid values (outside allowed ranges)
- `401 Unauthorized` - Missing or invalid token

**Validation:**
- `height_cm`: 50-250 cm
- `weight_kg`: 30-300 kg
- `gender`: Must be 'M' or 'F'

**Business Logic:**
- Creates profile if doesn't exist, updates if exists
- Validates all fields against CHECK constraints
- Updates `updated_at` timestamp
- Corresponds to US-003, US-018

---

### 2.2 Parties

#### Start New Party

**Endpoint:** `POST /api/parties`

**Description:** Starts a new party session for the authenticated user.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "started_at": "timestamp (optional, defaults to now)"
}
```

**Success Response (201 Created):**
```json
{
  "id": "bigint",
  "user_id": "uuid",
  "started_at": "timestamp",
  "ended_at": "null",
  "status": "ongoing",
  "profile_snapshot": {
    "height_cm": "integer",
    "weight_kg": "decimal",
    "gender": "string",
    "captured_at": "timestamp"
  },
  "bac_estimate_max": "0.00",
  "total_drinks_count": "0",
  "total_ml_consumed": "0",
  "blackout_marked": "false",
  "blackout_marked_at": "null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Error Responses:**
- `400 Bad Request` - User profile incomplete (missing height, weight, or gender)
- `401 Unauthorized` - Missing or invalid token
- `409 Conflict` - User already has an ongoing party

**Business Logic:**
- Checks if user profile is complete (US-018)
- Creates immutable snapshot of user profile at party start time
- Only one ongoing party allowed per user
- Sets status to 'ongoing'
- Initializes cached statistics to zero
- Corresponds to US-004

---

#### List User Parties

**Endpoint:** `GET /api/parties`

**Description:** Retrieves paginated list of user's party history.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `page` - integer (default: 1, min: 1)
- `limit` - integer (default: 20, min: 1, max: 100)
- `status` - string (optional: 'ongoing' | 'closed')
- `sort` - string (default: 'started_at', options: 'started_at' | 'bac_estimate_max')
- `order` - string (default: 'desc', options: 'asc' | 'desc')

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "bigint",
      "started_at": "timestamp",
      "ended_at": "timestamp | null",
      "status": "string",
      "bac_estimate_max": "decimal",
      "total_drinks_count": "integer",
      "total_ml_consumed": "integer",
      "blackout_marked": "boolean",
      "drinks_preview": [
        {
          "id": "bigint",
          "volume_ml": "integer",
          "abv_percent": "decimal",
          "consumed_at": "timestamp"
        }
      ]
    }
  ],
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total_count": "integer",
    "total_pages": "integer"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid token

**Business Logic:**
- Returns parties sorted by `started_at` DESC by default
- Filters by status if specified
- Includes preview of first 3 drinks for each party
- Corresponds to US-009

---

#### Get Party Details

**Endpoint:** `GET /api/parties/:id`

**Description:** Retrieves detailed information about a specific party including all drinks and BAC calculations.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `id` - bigint (required)

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "user_id": "uuid",
  "started_at": "timestamp",
  "ended_at": "timestamp | null",
  "status": "string",
  "profile_snapshot": {
    "height_cm": "integer",
    "weight_kg": "decimal",
    "gender": "string",
    "captured_at": "timestamp"
  },
  "bac_estimate_max": "decimal",
  "total_drinks_count": "integer",
  "total_ml_consumed": "integer",
  "blackout_marked": "boolean",
  "blackout_marked_at": "timestamp | null",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "drinks": [
    {
      "id": "bigint",
      "volume_ml": "integer",
      "abv_percent": "decimal",
      "consumed_at": "timestamp",
      "order_sequence": "integer",
      "edited_at": "timestamp | null",
      "edit_count": "integer",
      "bac_at_time": "decimal"
    }
  ],
  "current_bac": "decimal",
  "current_threshold": "decimal",
  "active_alerts": [
    {
      "alert_type": "string",
      "bac_at_alert": "decimal",
      "triggered_at": "timestamp"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Returns complete party data with all drinks ordered by `consumed_at`
- Includes current BAC calculation
- Includes active alerts for ongoing parties
- Corresponds to US-009

---

#### Close Party

**Endpoint:** `PATCH /api/parties/:id/close`

**Description:** Closes an ongoing party session, preventing further edits.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `id` - bigint (required)

**Request Body:**
```json
{
  "ended_at": "timestamp (optional, defaults to now)"
}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "status": "closed",
  "ended_at": "timestamp",
  "bac_estimate_max": "decimal",
  "total_drinks_count": "integer",
  "total_ml_consumed": "integer"
}
```

**Error Responses:**
- `400 Bad Request` - Party already closed
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Sets `ended_at` timestamp
- Changes status to 'closed'
- Deactivates all alerts for this party
- Logs 'party_closed' event
- Prevents further drink additions or edits
- Corresponds to US-007

---

#### Mark Blackout

**Endpoint:** `PATCH /api/parties/:id/blackout`

**Description:** Marks that the party resulted in a blackout, triggering threshold adaptation.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `id` - bigint (required)

**Request Body:**
```json
{
  "blackout_marked": "boolean (required)"
}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "blackout_marked": "boolean",
  "blackout_marked_at": "timestamp",
  "new_threshold": {
    "id": "bigint",
    "threshold_bac": "decimal",
    "reason": "blackout_marked",
    "trigger_party_id": "bigint",
    "is_current": "true",
    "created_at": "timestamp"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Party not closed yet or no BAC calculations available
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Can only be done after party is closed
- Sets `blackout_marked` to true and `blackout_marked_at` to current timestamp
- Queries maximum BAC from BACCalculations for this party
- Creates new UserThreshold with `threshold_bac` = peak BAC, `reason` = 'blackout_marked'
- Sets new threshold as current (is_current = true)
- Updates previous threshold to is_current = false
- Logs 'blackout_marked' and 'threshold_adjusted' events
- Corresponds to US-008, US-014

---

### 2.3 Drinks

#### Add Drink to Party

**Endpoint:** `POST /api/parties/:partyId/drinks`

**Description:** Adds a new drink entry to an ongoing party and triggers BAC calculation.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)

**Request Body:**
```json
{
  "volume_ml": "integer (required, >0, ≤5000)",
  "abv_percent": "decimal (required, 0.1-100)",
  "consumed_at": "timestamp (optional, defaults to now)"
}
```

**Success Response (201 Created):**
```json
{
  "drink": {
    "id": "bigint",
    "party_id": "bigint",
    "user_id": "uuid",
    "volume_ml": "integer",
    "abv_percent": "decimal",
    "consumed_at": "timestamp",
    "order_sequence": "integer",
    "edit_count": "0",
    "created_at": "timestamp"
  },
  "bac_calculation": {
    "id": "bigint",
    "calculated_bac": "decimal",
    "calculation_timestamp": "timestamp",
    "algorithm_version": "string",
    "time_since_first_drink_minutes": "integer"
  },
  "warnings": [
    {
      "type": "fast_consumption | unrealistic_volume",
      "message": "string",
      "requires_confirmation": "boolean"
    }
  ],
  "alerts": [
    {
      "alert_type": "approaching_threshold | exceeded_threshold",
      "bac_at_alert": "decimal",
      "threshold": "decimal"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid values, party closed, or consumed_at outside party timeframe
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found
- `422 Unprocessable Entity` - Validation warning requires confirmation

**Validation:**
- `volume_ml`: > 0 and ≤ 5000
- `abv_percent`: 0.1 - 100
- `consumed_at`: Must be within party timeframe (≥ started_at, ≤ ended_at if closed)
- Party must have status 'ongoing'

**Business Logic:**
1. Validates input against constraints
2. Checks for unrealistic values (e.g., >2000ml in single entry) - US-012
3. Checks for fast consumption (configurable threshold) - US-016
4. If warnings exist, returns 422 with warning details and requires confirmation flag
5. Creates drink record with auto-incremented order_sequence
6. Calculates BAC using Widmark formula with profile_snapshot from party
7. Creates BACCalculation record
8. Updates party cached statistics (total_drinks_count, total_ml_consumed, bac_estimate_max)
9. Checks alert thresholds:
   - If BAC ≥ 0.90 * current_threshold: creates/updates 'approaching_threshold' alert
   - If BAC ≥ current_threshold: creates/updates 'exceeded_threshold' alert
10. Logs 'drink_added' event (and 'fast_consumption_warning' if applicable)
11. Returns drink, BAC calculation, warnings, and active alerts
- Corresponds to US-005, US-012, US-016, US-017

---

#### Update Last Drink

**Endpoint:** `PUT /api/parties/:partyId/drinks/:drinkId`

**Description:** Updates the last drink entry in an ongoing party. Only the most recent drink can be edited.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)
- `drinkId` - bigint (required)

**Request Body:**
```json
{
  "volume_ml": "integer (required, >0, ≤5000)",
  "abv_percent": "decimal (required, 0.1-100)"
}
```

**Success Response (200 OK):**
```json
{
  "drink": {
    "id": "bigint",
    "party_id": "bigint",
    "volume_ml": "integer",
    "abv_percent": "decimal",
    "consumed_at": "timestamp",
    "original_values": {
      "volume_ml_before": "integer",
      "abv_percent_before": "decimal"
    },
    "edited_at": "timestamp",
    "edit_count": "integer"
  },
  "bac_calculation": {
    "id": "bigint",
    "calculated_bac": "decimal",
    "calculation_timestamp": "timestamp"
  },
  "recalculated_drinks_count": "integer",
  "alerts": [
    {
      "alert_type": "string",
      "bac_at_alert": "decimal"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid values (volume_ml or abv_percent outside allowed ranges)
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party or drink belongs to another user
- `404 Not Found` - Party or drink not found
- `409 Conflict` - Drink is not the last one in the party (cannot edit historical drinks)
- `422 Unprocessable Entity` - Party is already closed (cannot edit drinks in closed parties)

**Validation:**
- Same as adding drink
- Drink must be the last one in party (highest order_sequence)
- Party must have status 'ongoing'

**Business Logic:**
1. Verifies drink is the last in party
2. Stores original values if first edit (original_values field)
3. Updates drink with new values
4. Sets edited_at timestamp and increments edit_count
5. Recalculates BAC for this drink and all subsequent drinks (even though this is last)
6. Updates party cached statistics
7. Re-evaluates alert thresholds
8. Logs 'drink_edited' event
9. Returns updated drink with recalculation results
- Corresponds to US-006

---

#### Get Party Drinks

**Endpoint:** `GET /api/parties/:partyId/drinks`

**Description:** Retrieves all drinks for a specific party with their BAC calculations.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)

**Query Parameters:**
- `include_bac` - boolean (default: true)

**Success Response (200 OK):**
```json
{
  "party_id": "bigint",
  "drinks": [
    {
      "id": "bigint",
      "volume_ml": "integer",
      "abv_percent": "decimal",
      "consumed_at": "timestamp",
      "order_sequence": "integer",
      "edited_at": "timestamp | null",
      "edit_count": "integer",
      "bac_at_time": "decimal | null"
    }
  ],
  "total_count": "integer"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Returns drinks ordered by consumed_at ASC
- Joins with BACCalculations if include_bac is true
- Corresponds to US-009

---

### 2.4 BAC Calculations

#### Get Current BAC

**Endpoint:** `GET /api/parties/:partyId/bac/current`

**Description:** Calculates and returns the current estimated BAC for an ongoing party.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)

**Success Response (200 OK):**
```json
{
  "party_id": "bigint",
  "current_bac": "decimal",
  "calculated_at": "timestamp",
  "time_since_last_drink_minutes": "integer",
  "time_since_first_drink_minutes": "integer",
  "current_threshold": "decimal",
  "threshold_status": "safe | approaching | exceeded",
  "estimated_time_to_sober_minutes": "integer | null"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found or no drinks yet

**Business Logic:**
- Retrieves latest BAC calculation for party
- Applies time-based decay using Widmark metabolization rate
- Compares with current threshold
- Calculates estimated time to reach 0.00‰
- Real-time calculation, not stored
- Corresponds to US-010, US-011

---

#### Get BAC History

**Endpoint:** `GET /api/parties/:partyId/bac/history`

**Description:** Retrieves historical BAC calculations for a party.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)

**Success Response (200 OK):**
```json
{
  "party_id": "bigint",
  "calculations": [
    {
      "id": "bigint",
      "drink_id": "bigint",
      "calculated_bac": "decimal",
      "calculation_timestamp": "timestamp",
      "time_since_first_drink_minutes": "integer",
      "metabolized_alcohol_g": "decimal",
      "algorithm_version": "string"
    }
  ],
  "max_bac": "decimal",
  "total_count": "integer"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Returns all BAC calculations ordered by calculation_timestamp ASC
- Includes maximum BAC reached
- Used for visualization and analytics
- Corresponds to US-009

---

### 2.5 Thresholds

#### Get Current Threshold

**Endpoint:** `GET /api/thresholds/current`

**Description:** Retrieves the user's current BAC threshold.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "user_id": "uuid",
  "threshold_bac": "decimal",
  "is_current": "true",
  "reason": "default | blackout_marked | manual_override",
  "trigger_party_id": "bigint | null",
  "created_at": "timestamp"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - No threshold found (should create default)

**Business Logic:**
- Returns threshold with is_current = true
- If no threshold exists, creates default threshold (1.6‰)
- Corresponds to US-010, US-014

---

#### Get Threshold History

**Endpoint:** `GET /api/thresholds/history`

**Description:** Retrieves the user's threshold change history.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `page` - integer (default: 1)
- `limit` - integer (default: 20, max: 100)

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "bigint",
      "threshold_bac": "decimal",
      "is_current": "boolean",
      "reason": "string",
      "trigger_party_id": "bigint | null",
      "created_at": "timestamp"
    }
  ],
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total_count": "integer",
    "total_pages": "integer"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token

**Business Logic:**
- Returns thresholds ordered by created_at DESC
- Shows history of threshold adaptations
- Includes reference to trigger party if applicable
- Corresponds to US-014

---

#### Update Threshold Manually

**Endpoint:** `PUT /api/thresholds/current`

**Description:** Allows user to manually override their BAC threshold.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "threshold_bac": "decimal (required, 0.08-0.50)"
}
```

**Success Response (200 OK):**
```json
{
  "id": "bigint",
  "threshold_bac": "decimal",
  "is_current": "true",
  "reason": "manual_override",
  "created_at": "timestamp"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid threshold value
- `401 Unauthorized` - Missing or invalid token

**Validation:**
- `threshold_bac`: 0.08 - 0.50 (algorithmic stability range)

**Business Logic:**
- Creates new threshold with reason 'manual_override'
- Sets new threshold as current
- Updates previous threshold to is_current = false
- Logs 'threshold_adjusted' event
- Corresponds to US-014

---

### 2.6 Alerts

#### Get Active Alerts for Party

**Endpoint:** `GET /api/parties/:partyId/alerts`

**Description:** Retrieves active alerts for a specific party.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Path Parameters:**
- `partyId` - bigint (required)

**Success Response (200 OK):**
```json
{
  "party_id": "bigint",
  "alerts": [
    {
      "id": "bigint",
      "alert_type": "approaching_threshold | exceeded_threshold",
      "is_active": "boolean",
      "bac_at_alert": "decimal",
      "triggered_at": "timestamp",
      "last_alert_sent_at": "timestamp"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Party belongs to another user
- `404 Not Found` - Party not found

**Business Logic:**
- Returns only active alerts (is_active = true)
- Used by frontend for polling or real-time updates
- Backend cron job sends notifications based on last_alert_sent_at
- Corresponds to US-010, US-011

---

### 2.7 Events (Analytics)

#### Log Event

**Endpoint:** `POST /api/events`

**Description:** Internal endpoint for logging telemetry events. Not exposed to frontend directly.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "event_type": "drink_added | drink_edited | party_started | party_closed | blackout_marked | threshold_adjusted | fast_consumption_warning",
  "party_id": "bigint (optional)"
}
```

**Success Response (201 Created):**
```json
{
  "id": "bigint",
  "event_type": "string",
  "created_at": "timestamp"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid event_type
- `401 Unauthorized` - Missing or invalid token

**Business Logic:**
- Minimal telemetry per design decision
- No event_data JSONB to minimize storage
- Automatically captures user_id from auth context
- Corresponds to US-013

---

## 3. Authentication and Authorization

### 3.1 Authentication Mechanism

**Provider:** Supabase Auth

**Method:** JWT Bearer Token

**Flow:**
1. User registers or logs in via `/api/auth/register` or `/api/auth/login`
2. Supabase Auth returns access_token and refresh_token
3. Client includes access_token in Authorization header for all subsequent requests
4. Token expires after configured period (default: 1 hour)
5. Client uses refresh_token to obtain new access_token via `/api/auth/refresh`

**Header Format:**
```
Authorization: Bearer {access_token}
```

### 3.2 Authorization Strategy

**Row Level Security (RLS):**
- All tables have RLS enabled
- Policies ensure users can only access their own data
- user_id derived from `auth.uid()` in RLS policies

**Denormalization for RLS:**
- Tables Drinks, BACCalculations, and Alerts include denormalized user_id
- Enables efficient RLS filtering without expensive JOINs
- user_id validated on insert to match party owner

**Policy Examples:**
```sql
-- Users can only view their own parties
CREATE POLICY "Users can view their own parties"
  ON Parties FOR SELECT
  USING (user_id = auth.uid());

-- Users can only add drinks to their own parties
CREATE POLICY "Users can add drinks to their parties"
  ON Drinks FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM Parties 
      WHERE Parties.id = Drinks.party_id 
      AND Parties.user_id = auth.uid()
    )
  );
```

### 3.3 Security Considerations

- All endpoints (except register/login) require valid JWT token
- Token validation handled by Supabase middleware
- Expired tokens return 401 Unauthorized
- Invalid tokens return 401 Unauthorized
- Attempts to access other users' data return 403 Forbidden or 404 Not Found
- Rate limiting applied per user (TBD: specific limits)
- CORS configured for allowed origins only

---

## 4. Validation and Business Logic

### 4.1 Input Validation

**UserProfiles:**
- `height_cm`: INTEGER, CHECK (50 ≤ height_cm ≤ 250)
  - Realistic human height range
- `weight_kg`: DECIMAL(5,2), CHECK (30 ≤ weight_kg ≤ 300)
  - Realistic weight range
- `gender`: ENUM ('M', 'F')
  - Required for Widmark formula constants

**Drinks:**
- `volume_ml`: INTEGER, CHECK (volume_ml > 0 AND volume_ml ≤ 5000)
  - Realistic single drink volumes
  - Validation warning at > 2000ml (US-012)
- `abv_percent`: DECIMAL(4,2), CHECK (0.1 ≤ abv_percent ≤ 100)
  - Valid alcohol content range
- `consumed_at`: TIMESTAMP, must be within party timeframe
  - Cannot be before party started_at
  - Cannot be after party ended_at (if closed)

**BACCalculations:**
- `calculated_bac`: DECIMAL(4,2), CHECK (0 ≤ calculated_bac ≤ 0.99)
  - Realistic BAC range (0-99%, practically 0-0.99‰)

**UserThresholds:**
- `threshold_bac`: DECIMAL(4,2), CHECK (0.08 ≤ threshold_bac ≤ 0.50)
  - Algorithmic stability range
  - Minimum 0.08 (legal driving limit in many countries)
  - Maximum 0.50 (extreme intoxication)

### 4.2 Business Logic Rules

**Party Management:**
1. User can have only one ongoing party at a time
2. Party must be closed before marking blackout
3. Profile must be complete before starting party (US-018)
4. Profile snapshot captured immutably at party start
5. Cached statistics (bac_estimate_max, total_drinks_count, total_ml_consumed) updated via triggers or application logic

**Drink Management:**
1. Drinks can only be added to ongoing parties
2. Only last drink in ongoing party can be edited (US-006)
3. Edit history preserved in original_values field
4. edit_count incremented on each edit
5. order_sequence auto-incremented to maintain drink order

**BAC Calculation (Widmark Formula):**
```
BAC (g/L) = (Alcohol consumed (g) / (Body weight (kg) × r)) - (β × t)

Where:
- Alcohol consumed (g) = volume_ml × (abv_percent / 100) × 0.789 (alcohol density)
- r = Widmark constant (0.68 for men, 0.55 for women)
- β = Metabolization rate (0.15 g/L/hour typical)
- t = time elapsed in hours since consumption
```

**Implementation:**
1. Calculate total alcohol consumed (sum of all drinks)
2. Apply Widmark formula with profile_snapshot data
3. Account for metabolization based on time_since_first_drink
4. Store calculation in BACCalculations table
5. Update party bac_estimate_max if current BAC exceeds cached value
6. Algorithm version tracked for future improvements

**Alert Logic:**
1. After each drink addition or edit, compare calculated BAC with current threshold
2. **Approaching threshold** (0.90-0.99 × threshold):
   - Create/update alert with type 'approaching_threshold'
   - Single notification sent
3. **Exceeded threshold** (≥ threshold):
   - Create/update alert with type 'exceeded_threshold'
   - is_active set to true
   - Backend cron job checks last_alert_sent_at every 5 minutes
   - Sends notification if > 5 minutes since last alert
   - Updates last_alert_sent_at
4. When BAC falls below threshold (via time decay or drink edit):
   - Set is_active to false
5. When party closed:
   - Deactivate all alerts for that party

**Threshold Adaptation (US-014):**
1. When user marks blackout after party:
   - Query MAX(calculated_bac) from BACCalculations for that party
   - Create new UserThreshold with threshold_bac = peak BAC
   - Set reason = 'blackout_marked'
   - Set trigger_party_id = party.id
   - Set is_current = true
2. Update previous threshold:
   - Set is_current = false
3. Log events:
   - 'blackout_marked'
   - 'threshold_adjusted'

**Fast Consumption Warning (US-016):**
1. Define configurable thresholds:
   - Max volume per drink: 2000ml (warning)
   - Max volume per time window: e.g., 500ml in 15 minutes (warning)
2. When adding drink:
   - Check if volume_ml > 2000
   - Check if recent drinks (last 15 min) + current > 500ml
   - If either exceeded: return 422 with warning message
   - Require explicit confirmation to proceed
   - Log 'fast_consumption_warning' event

**Unrealistic Value Validation (US-012):**
1. Hard limits enforced by CHECK constraints
2. Soft limits trigger warnings:
   - volume_ml > 2000: "Large volume detected"
   - abv_percent > 60 and volume_ml > 100: "High alcohol content"
3. Return 422 with detailed warning
4. Allow user to confirm or edit values

**Telemetry (US-013):**
- Minimal event data stored
- Events logged for:
  - drink_added
  - drink_edited
  - party_started
  - party_closed
  - blackout_marked
  - threshold_adjusted
  - fast_consumption_warning
- Events include: user_id, event_type, party_id (if applicable), timestamp
- No JSONB event_data to minimize storage
- Aggregated for analytics dashboard (future)

### 4.3 Error Handling

**Standard Error Response Format:**
```json
{
  "error": {
    "code": "string (machine-readable error code)",
    "message": "string (human-readable error message)",
    "details": "object (optional additional context)"
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - 401: Missing or invalid token
- `FORBIDDEN` - 403: User lacks permission for resource
- `NOT_FOUND` - 404: Resource does not exist
- `VALIDATION_ERROR` - 400: Input validation failed
- `CONFLICT` - 409: Resource state conflict
- `UNPROCESSABLE_ENTITY` - 422: Validation warning requires confirmation
- `INTERNAL_ERROR` - 500: Server error

**Validation Warning Format (422):**
```json
{
  "warnings": [
    {
      "type": "unrealistic_volume | fast_consumption | high_abv",
      "message": "string",
      "field": "string (field name)",
      "value": "any (problematic value)",
      "threshold": "any (threshold violated)"
    }
  ],
  "requires_confirmation": true
}
```

**Confirmation Flow:**
- Client receives 422 with warnings
- User reviews warnings and confirms intent
- Client retries request with additional parameter:
  ```json
  {
    "volume_ml": 2500,
    "abv_percent": 40,
    "confirm_warnings": true
  }
  ```
- Server processes request if confirm_warnings is true

### 4.4 Rate Limiting

**Per User:**
- 100 requests per minute for authenticated endpoints
- 10 requests per minute for auth endpoints (login, register)

**Per IP:**
- 200 requests per minute for unauthenticated endpoints

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000 (unix timestamp)
```

**Response when rate limited (429):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retry_after": 30
    }
  }
}
```

---

## 5. Additional Implementation Notes

### 5.1 Database Triggers

**Update Timestamp Trigger:**
- Automatically updates `updated_at` field on UserProfiles, Parties, Drinks, Alerts

**Party Cache Update Trigger:**
- Updates Parties cached fields (total_drinks_count, total_ml_consumed, bac_estimate_max) when Drinks or BACCalculations are modified

### 5.2 Background Jobs

**Alert Notification Cron (every 5 minutes):**
```sql
SELECT * FROM Alerts 
WHERE is_active = true 
  AND last_alert_sent_at < NOW() - INTERVAL '5 minutes';
```
- Sends push notifications for exceeded threshold alerts
- Updates last_alert_sent_at timestamp

**Stale Party Cleanup (daily):**
- Automatically close parties that have been ongoing for > 24 hours without activity

### 5.3 Real-time Features (Future)

**WebSocket Support:**
- Real-time BAC updates during party
- Real-time alert notifications
- Live party updates when multiple devices connected

**Server-Sent Events (SSE):**
- Alternative to WebSockets for simpler implementation
- Push BAC updates and alerts to connected clients

### 5.4 Versioning

**API Version:** v1

**URL Structure:** `/api/v1/*` (or just `/api/*` for MVP)

**Algorithm Versioning:**
- BACCalculations stores `algorithm_version` field
- Allows switching between Widmark variants or future algorithms
- Enables comparison and validation of accuracy

### 5.5 Pagination Standard

**Query Parameters:**
- `page` - integer, 1-based (default: 1)
- `limit` - integer (default: 20, max: 100)

**Response Format:**
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

### 5.6 Testing Considerations

**Unit Tests:**
- BAC calculation accuracy (test against known values)
- Validation logic for all input fields
- Business rules (one ongoing party, edit last drink only, etc.)

**Integration Tests:**
- Complete party workflow (start → add drinks → close → mark blackout)
- Threshold adaptation logic
- Alert triggering and notification flow
- RLS policy enforcement

**Load Tests:**
- Concurrent party operations
- Multiple users adding drinks simultaneously
- Alert notification scaling

---

## 6. Future Enhancements

**Not in MVP, but considered in design:**

1. **Multiple BAC Algorithms:**
   - Support for enhanced Widmark variants
   - Machine learning models for personalized prediction

2. **Food and Water Intake:**
   - Track food consumption to adjust BAC calculations
   - Hydration tracking

3. **Hangover Prevention:**
   - Next-day hangover risk assessment
   - Recommendations for mitigation

4. **Social Features:**
   - Group parties with shared drinks
   - Designated driver role
   - Peer accountability

5. **Integration with Devices:**
   - Breathalyzer integration for calibration
   - Smartwatch alerts and tracking

6. **Advanced Analytics:**
   - Long-term drinking pattern analysis
   - Health impact assessment
   - Goal setting and progress tracking

7. **Multi-factor Authentication:**
   - 2FA for account security

8. **Age Verification:**
   - Legal compliance for underage users
   - Regional restrictions

---

## Appendix A: Example Request/Response Flows

### A.1 Complete Party Workflow

**1. Start Party:**
```http
POST /api/parties
Authorization: Bearer {token}

{}

Response 201:
{
  "id": 123,
  "status": "ongoing",
  "started_at": "2026-01-06T20:00:00Z",
  "profile_snapshot": {...}
}
```

**2. Add First Drink:**
```http
POST /api/parties/123/drinks
Authorization: Bearer {token}

{
  "volume_ml": 500,
  "abv_percent": 5.0
}

Response 201:
{
  "drink": {...},
  "bac_calculation": {
    "calculated_bac": 0.15
  },
  "warnings": [],
  "alerts": []
}
```

**3. Add More Drinks:**
```http
POST /api/parties/123/drinks

{
  "volume_ml": 500,
  "abv_percent": 5.0
}

Response 201:
{
  "bac_calculation": {
    "calculated_bac": 0.28
  },
  "alerts": [
    {
      "alert_type": "approaching_threshold",
      "bac_at_alert": 0.28,
      "threshold": 1.6
    }
  ]
}
```

**4. Get Current BAC:**
```http
GET /api/parties/123/bac/current

Response 200:
{
  "current_bac": 0.26,
  "threshold_status": "safe",
  "estimated_time_to_sober_minutes": 180
}
```

**5. Close Party:**
```http
PATCH /api/parties/123/close

Response 200:
{
  "id": 123,
  "status": "closed",
  "ended_at": "2026-01-07T02:00:00Z"
}
```

**6. Mark Blackout:**
```http
PATCH /api/parties/123/blackout

{
  "blackout_marked": true
}

Response 200:
{
  "blackout_marked": true,
  "new_threshold": {
    "threshold_bac": 0.35,
    "reason": "blackout_marked"
  }
}
```

---

## Appendix B: Database Constraints Summary

| Table           | Field          | Constraint           | API Validation                          |
|-----------------|----------------|----------------------|-----------------------------------------|
| UserProfiles    | height_cm      | 50-250               | 400 if outside range                    |
| UserProfiles    | weight_kg      | 30-300               | 400 if outside range                    |
| UserProfiles    | gender         | ENUM ('M','F')       | 400 if invalid                          |
| Drinks          | volume_ml      | >0, ≤5000            | 400 if violated, 422 if >2000           |
| Drinks          | abv_percent    | 0.1-100              | 400 if outside range                    |
| BACCalculations | calculated_bac | 0-0.99               | Server-side only                        |
| UserThresholds  | threshold_bac  | 0.08-0.50            | 400 if outside range                    |
| Parties         | status         | ENUM                 | Server-managed                          |

---

## Appendix C: Event Type Reference

| Event Type                 | Triggered By                  | party_id Required |
|----------------------------|-------------------------------|-------------------|
| drink_added                | POST /drinks                  | Yes               |
| drink_edited               | PUT /drinks/:id               | Yes               |
| party_started              | POST /parties                 | Yes               |
| party_closed               | PATCH /parties/:id/close      | Yes               |
| blackout_marked            | PATCH /parties/:id/blackout   | Yes               |
| threshold_adjusted         | Blackout or manual update     | Optional          |
| fast_consumption_warning   | POST /drinks (validation)     | Yes               |

---

This API plan provides comprehensive coverage of all user stories in the PRD, implements proper validation and business logic, and leverages Supabase Auth with RLS for security. The design supports the MVP requirements while allowing for future enhancements.
