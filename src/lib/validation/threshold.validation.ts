import { z } from "zod";

export const updateThresholdSchema = z.object({
  threshold_bac: z.number().min(0.08, { message: "Minimalna wartość progu to 0.08‰" }),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
