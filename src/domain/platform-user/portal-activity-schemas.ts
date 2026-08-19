import { z } from "zod";

const firstQueryValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

function isIsoCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}

const queryTextSchema = z.preprocess(
  firstQueryValue,
  z.string().trim().max(100).catch(""),
);

const queryDateSchema = z.preprocess(
  firstQueryValue,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isIsoCalendarDate)
    .optional()
    .catch(undefined),
);

const queryPageSchema = z.preprocess(
  firstQueryValue,
  z.coerce.number().int().min(1).catch(1),
);

export const portalActivitySearchSchema = z.object({
  q: queryTextSchema,
  dateFrom: queryDateSchema,
  dateTo: queryDateSchema,
  page: queryPageSchema,
});

export type PortalActivitySearch = z.infer<typeof portalActivitySearchSchema>;

export function parsePortalActivitySearchParams(
  input: Record<string, string | string[] | undefined>,
): PortalActivitySearch {
  return portalActivitySearchSchema.parse(input);
}
