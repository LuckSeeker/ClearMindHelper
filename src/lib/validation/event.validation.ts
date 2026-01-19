import { z } from "zod";

// Zod enum for allowed event types (hardcoded for type safety)
export const eventTypeEnum = z.enum([
  "drink_added",
  "drink_edited",
  "party_started",
  "party_closed",
  "blackout_marked",
  "threshold_adjusted",
  "fast_consumption_warning",
  "unrealistic_volume_warning",
]);

export const logEventCommandSchema = z.object({
  event_type: eventTypeEnum,
  party_id: z
    .union([z.bigint(), z.string().regex(/^\d+$/).transform(BigInt)])
    .optional()
    .nullable(),
});

export type LogEventCommandInput = z.infer<typeof logEventCommandSchema>;
