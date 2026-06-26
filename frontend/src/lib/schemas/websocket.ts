import { z } from "zod";

export const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  code: z.string().optional(),
});
