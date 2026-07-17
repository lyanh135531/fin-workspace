import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_TIME_ZONE: z.string().min(1),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_TIME_ZONE: process.env.APP_TIME_ZONE,
});
