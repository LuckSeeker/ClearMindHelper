/**
 * Data Transfer Objects (DTOs) and Command Models
 *
 * This file contains type definitions for API request/response structures.
 * All types derive from the database models defined in database.types.ts
 */

import type { Tables, Enums } from "./db/database.types";

// ============================================================================
// Database Entity Types (Re-exports for convenience)
// ============================================================================

/** User profile entity from database */
export type UserProfile = Tables<"userprofiles">;

/** Party entity from database */
export type Party = Tables<"parties">;

/** Drink entity from database */
export type Drink = Tables<"drinks">;

/** BAC calculation entity from database */
export type BACCalculation = Tables<"baccalculations">;

/** User threshold entity from database */
export type UserThreshold = Tables<"userthresholds">;

/** Alert entity from database */
export type Alert = Tables<"alerts">;

/** Event entity from database */
export type Event = Tables<"events">;

// ============================================================================
// Enum Types (Re-exports)
// ============================================================================

export type AlertType = Enums<"enum_alert_type">;
export type EventType = Enums<"enum_event_type">;
export type Gender = Enums<"enum_gender">;
export type PartyStatus = Enums<"enum_party_status">;
export type ThresholdReason = Enums<"enum_threshold_reason">;

// ============================================================================
// User Profile DTOs and Commands
// ============================================================================

/**
 * Response DTO for user profile
 * Extends database entity with computed field
 */
export interface UserProfileDTO extends Omit<UserProfile, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
  /** Computed field: true if all required fields are filled */
  is_complete: boolean;
}

/**
 * Command for creating or updating user profile
 * Only includes editable fields
 */
export interface UpdateUserProfileCommand {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
}

// ============================================================================
// Party DTOs and Commands
// ============================================================================

/**
 * Command for starting a new party
 */
export interface StartPartyCommand {
  /** Optional start time, defaults to current time */
  started_at?: string;
}

/**
 * Snapshot of user profile at party start time
 */
export interface ProfileSnapshot {
  height_cm: number;
  weight_kg: number;
  gender: Gender;
  captured_at: string;
}

/**
 * Response DTO for party entity
 */
export interface PartyDTO extends Omit<Party, "profile_snapshot" | "created_at" | "updated_at"> {
  profile_snapshot: ProfileSnapshot;
  created_at: string;
  updated_at: string;
}

/**
 * Preview of first few drinks in party list
 */
export interface DrinkPreview {
  id: number;
  volume_ml: number;
  abv_percent: number;
  consumed_at: string;
}

/**
 * Party item in list view with drink previews
 */
export interface PartyListItemDTO extends PartyDTO {
  /** Preview of first 3 drinks */
  drinks_preview: DrinkPreview[];
}

/**
 * Paginated response for party list
 */
export interface PartyListResponseDTO {
  data: PartyListItemDTO[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

/**
 * Detailed party view with all drinks and calculations
 */
export interface PartyDetailDTO extends PartyDTO {
  /** All drinks in the party ordered by consumed_at */
  drinks: DrinkWithBACDTO[];
  /** Current BAC calculation if available */
  current_bac: BACCalculationDTO | null;
  /** Active alerts for this party */
  active_alerts: AlertDTO[];
}

/**
 * Command for closing a party
 */
export interface ClosePartyCommand {
  /** Optional end time, defaults to current time */
  ended_at?: string;
}

/**
 * Response DTO after closing a party
 */
export interface ClosePartyResponseDTO {
  id: number;
  status: PartyStatus;
  started_at: string;
  ended_at: string;
  bac_estimate_max: number | null;
  total_drinks_count: number | null;
  total_ml_consumed: number | null;
}

/**
 * Response DTO after marking blackout
 */
export interface MarkBlackoutResponseDTO {
  id: number;
  blackout_marked: boolean;
  blackout_marked_at: string | null;
  /** New threshold created from this blackout */
  new_threshold: UserThresholdDTO | null;
}

// ============================================================================
// Drink DTOs and Commands
// ============================================================================

/**
 * Command for adding a new drink to a party
 */
export interface AddDrinkCommand {
  volume_ml: number;
  abv_percent: number;
  /** Optional consumption time, defaults to current time */
  consumed_at?: string;
  /** Set to true to confirm despite validation warnings */
  confirm_warnings?: boolean;
}

/**
 * Command for updating the last drink in a party
 */
export interface UpdateDrinkCommand {
  consumed_at?: string;
  volume_ml: number;
  abv_percent: number;
}

/**
 * Response DTO for drink entity
 */
export interface DrinkDTO extends Omit<Drink, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

/**
 * Drink with associated BAC calculation
 */
export interface DrinkWithBACDTO extends DrinkDTO {
  bac_calculation: BACCalculationDTO | null;
}

/**
 * Validation warning for drink entry
 */
export interface DrinkValidationWarning {
  code: string;
  message: string;
  field: string;
  value: number;
}

/**
 * Response after adding a drink
 */
export interface AddDrinkResponseDTO {
  /** The created drink */
  drink: DrinkDTO;
  /** BAC calculation for this drink */
  bac_calculation: BACCalculationDTO;
  /** Validation warnings if any */
  warnings: DrinkValidationWarning[];
  /** Active alerts after adding this drink */
  active_alerts: AlertDTO[];
}

/**
 * Response after updating a drink
 */
export interface UpdateDrinkResponseDTO {
  /** The updated drink */
  drink: DrinkDTO;
  /** Recalculated BAC for this drink */
  bac_calculation: BACCalculationDTO;
  /** Validation warnings if any */
  warnings: DrinkValidationWarning[];
  /** Active alerts after updating this drink */
  active_alerts: AlertDTO[];
}

/**
 * Response for getting all drinks in a party
 */
export interface PartyDrinksResponseDTO {
  party_id: number;
  drinks: DrinkWithBACDTO[];
  total_count: number;
}

// ============================================================================
// BAC Calculation DTOs
// ============================================================================

/**
 * Response DTO for BAC calculation entity
 */
export interface BACCalculationDTO
  extends Omit<BACCalculation, "user_profile_snapshot" | "created_at" | "calculation_timestamp"> {
  calculation_timestamp: string;
  created_at: string;
  user_profile_snapshot: ProfileSnapshot;
}

/**
 * Current BAC status for ongoing party
 */
export interface CurrentBACResponseDTO {
  party_id: number;
  current_bac: number;
  calculated_at: string;
  time_since_last_drink_minutes: number;
  time_since_first_drink_minutes: number;
  current_threshold: number;
  threshold_status: "safe" | "approaching" | "exceeded";
  estimated_time_to_sober_minutes: number | null;
}

/**
 * Historical BAC data for a party
 */
export interface BACHistoryResponseDTO {
  party_id: number;
  bac_calculations: BACCalculationDTO[];
  bac_estimate_max: number | null;
  total_count: number;
}

// ============================================================================
// Threshold DTOs and Commands
// ============================================================================

/**
 * Response DTO for user threshold entity
 */
export interface UserThresholdDTO extends Omit<UserThreshold, "created_at"> {
  created_at: string;
}

/**
 * Response for current threshold
 */
export interface CurrentThresholdResponseDTO {
  id: number;
  user_id: string;
  threshold_bac: number;
  reason: ThresholdReason;
  is_current: boolean;
  trigger_party_id: number | null;
  created_at: string;
}

/**
 * Paginated threshold history
 */
export interface ThresholdHistoryResponseDTO {
  data: UserThresholdDTO[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

/**
 * Command for manually updating threshold
 */
export interface UpdateThresholdCommand {
  threshold_bac: number;
}

// ============================================================================
// Alert DTOs
// ============================================================================

/**
 * Response DTO for alert entity
 */
export interface AlertDTO extends Omit<Alert, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

/**
 * Response for getting active alerts for a party
 */
export interface PartyAlertsResponseDTO {
  party_id: number;
  active_alerts: AlertDTO[];
}

// ============================================================================
// Event DTOs and Commands
// ============================================================================

/**
 * Response DTO for event entity
 */
export interface EventDTO extends Omit<Event, "created_at"> {
  created_at: string;
}

/**
 * Command for logging an event
 */
export interface LogEventCommand {
  event_type: EventType;
  party_id?: number;
}

// ============================================================================
// Error and Validation Types
// ============================================================================

/**
 * Standard API error response
 */
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Validation error response (422)
 */
export interface ValidationWarningResponse {
  warnings: DrinkValidationWarning[];
  requires_confirmation: boolean;
}

/**
 * Rate limiting information in response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Query parameters for party list
 */
export interface PartyListQueryParams {
  page?: number;
  limit?: number;
  status?: PartyStatus;
  sort?: "started_at" | "bac_estimate_max";
  order?: "asc" | "desc";
}

/**
 * Query parameters for threshold history
 */
export interface ThresholdHistoryQueryParams {
  page?: number;
  limit?: number;
}

/**
 * Query parameters for party drinks
 */
export interface PartyDrinksQueryParams {
  include_bac?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
