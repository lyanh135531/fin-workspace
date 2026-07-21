import { z } from "zod";

// System seed records use fixed UUIDs whose version nibble is 0. PostgreSQL accepts
// them, so validation must accept any RFC-shaped UUID rather than only v1-v8.
export const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid identifier.");
export const optionalTrimmedTextSchema = z.string().trim().max(2_000).optional();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value.");
export const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD.");

export const statusSchema = z.enum(["active", "deactive"]);
export const transactionTypeSchema = z.enum(["income", "expense", "transfer"]);
export const workflowStatusSchema = z.enum(["pending", "scheduled", "approved", "rejected"]);

export type Status = z.infer<typeof statusSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
