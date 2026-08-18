import { z } from "zod";

import { statusSchema } from "@/domain/common/schemas";

const firstQueryValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

const queryTextSchema = z.preprocess(
  firstQueryValue,
  z.string().trim().max(100).catch(""),
);

const queryStatusSchema = z.preprocess(
  firstQueryValue,
  z.enum(["all", ...statusSchema.options]).catch("all"),
);

const queryPageSchema = z.preprocess(
  firstQueryValue,
  z.coerce.number().int().min(1).catch(1),
);

export const portalUserSearchSchema = z.object({
  q: queryTextSchema,
  status: queryStatusSchema,
  page: queryPageSchema,
});

export type PortalUserSearch = z.infer<typeof portalUserSearchSchema>;

export function parsePortalUserSearchParams(
  input: Record<string, string | string[] | undefined>,
): PortalUserSearch {
  return portalUserSearchSchema.parse(input);
}

export function parsePlatformAdminUsernames(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((username) => username.trim())
      .filter(Boolean),
  );
}

export function isPlatformAdminUsername(
  username: string,
  configuredUsernames = process.env.PLATFORM_ADMIN_USERNAMES,
) {
  return parsePlatformAdminUsernames(configuredUsernames).has(username);
}
