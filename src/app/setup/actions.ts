"use server";

import { z } from "zod";
import { createInitialAdmin } from "@/services/bootstrap-service";

const setupSchema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(12).max(128), workspaceName: z.string().trim().min(3).max(120) });

export async function setupInitialAdmin(input: unknown) {
  const { username, password, workspaceName } = setupSchema.parse(input);
  return createInitialAdmin(username, password, workspaceName);
}
