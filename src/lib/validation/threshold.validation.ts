import { z } from "zod";

export const updateThresholdSchema = z.object({
  threshold_bac: z.number().positive({ message: "threshold_bac must be greater than 0" }),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
