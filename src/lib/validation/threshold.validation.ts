import { z } from "zod";

export const updateThresholdSchema = z.object({
  threshold_bac: z
    .number()
    .min(0.08, { message: "Minimalna wartość progu to 0.08‰" })
    .max(1.6, { message: "Maksymalna wartość progu to 1.60‰" }),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
