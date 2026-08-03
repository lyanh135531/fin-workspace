import { z } from "zod";
import {
  businessDateSchema,
  statusSchema,
  transactionTypeSchema,
  workflowStatusSchema,
} from "@/domain/common/schemas";

const refSchema = z.string().trim().min(1).max(160);
const moneySchema = z.string().regex(/^-?\d+(?:\.\d{1,4})?$/, "Invalid decimal amount.");
const dateTimeSchema = z.string().datetime({ offset: true });

const currentUserSchema = z.object({
  ref: refSchema,
  source: z.literal("currentUser"),
  displayName: z.string().trim().min(1).max(120),
  status: statusSchema,
});

const syntheticUserSchema = z.object({
  ref: refSchema,
  source: z.literal("synthetic"),
  displayName: z.string().trim().min(1).max(120),
  usernameTemplate: z.string().trim().min(1).max(120),
  passwordStrategy: z.literal("random-unrecoverable"),
  status: statusSchema,
});

const transactionSnapshotSchema = z.object({
  wallet: refSchema,
  toWallet: refSchema.nullable(),
  category: refSchema.nullable(),
  type: transactionTypeSchema,
  amount: moneySchema,
  description: z.string().max(2_000).nullable(),
  date: businessDateSchema,
  workflowStatus: workflowStatusSchema,
});

const proposedTransactionSchema = transactionSnapshotSchema.omit({ workflowStatus: true });

export const sampleDatasetSchema = z.object({
  formatVersion: z.number().int().positive(),
  key: refSchema,
  name: z.string().trim().min(1).max(200),
  locale: z.literal("vi-VN"),
  generatedAt: dateTimeSchema,
  deterministicSeed: z.number().int(),
  dateRange: z.object({
    from: businessDateSchema,
    through: businessDateSchema,
    futureThrough: businessDateSchema,
  }),
  importRules: z.record(z.string(), z.string()),
  roleReferences: z.array(z.enum(["ADMIN", "MEMBER"])).min(2),
  users: z.array(z.discriminatedUnion("source", [currentUserSchema, syntheticUserSchema])).min(2),
  workspaces: z.array(z.object({
    ref: refSchema,
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500),
    status: statusSchema,
    baseCurrency: z.literal("VND"),
    timeZone: z.literal("Asia/Ho_Chi_Minh"),
    inviteCodeStrategy: z.literal("generate"),
  })).length(1),
  workspaceMembers: z.array(z.object({
    ref: refSchema,
    workspace: refSchema,
    user: refSchema,
    role: z.enum(["ADMIN", "MEMBER"]),
    status: statusSchema,
    joinedAt: dateTimeSchema,
  })).length(2),
  wallets: z.array(z.object({
    ref: refSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    openingBalance: moneySchema,
    currentBalance: moneySchema,
    status: statusSchema,
  })).min(1),
  workspaceWallets: z.array(z.object({
    workspace: refSchema,
    wallet: refSchema,
  })).min(1),
  categories: z.array(z.object({
    ref: refSchema,
    scope: z.enum(["workspace", "user"]),
    workspace: refSchema.optional(),
    user: refSchema.optional(),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(120),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    type: z.enum(["income", "expense"]),
    icon: z.string().trim().max(80).nullable(),
    parent: refSchema.nullable(),
    sortOrder: z.number().int(),
    status: statusSchema,
  })).min(1),
  recurringTransactions: z.array(z.object({
    ref: refSchema,
    workspace: refSchema,
    createdByMember: refSchema,
    wallet: refSchema,
    toWallet: refSchema.nullable().optional(),
    category: refSchema.nullable(),
    type: transactionTypeSchema,
    amount: moneySchema,
    description: z.string().max(2_000).nullable(),
    dayOfMonth: z.number().int().min(1).max(31),
    startDate: businessDateSchema,
    endDate: businessDateSchema.nullable(),
    nextExecutionDate: businessDateSchema,
    status: statusSchema,
  })).min(1),
  transactions: z.array(z.object({
    ref: refSchema,
    member: refSchema,
    wallet: refSchema,
    toWallet: refSchema.nullable(),
    category: refSchema.nullable(),
    type: transactionTypeSchema,
    workflowStatus: workflowStatusSchema,
    amount: moneySchema,
    description: z.string().max(2_000).nullable(),
    date: businessDateSchema,
    recurringTransaction: refSchema.nullable(),
    recurringPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  })).min(1),
  transactionChangeRequests: z.array(z.object({
    ref: refSchema,
    transaction: refSchema,
    requesterMember: refSchema,
    reviewerMember: refSchema.nullable(),
    previousData: transactionSnapshotSchema,
    proposedData: z.discriminatedUnion("action", [
      z.object({
        action: z.literal("update"),
        reason: z.string().trim().min(1).max(500),
        transaction: proposedTransactionSchema,
      }),
      z.object({
        action: z.literal("delete"),
        reason: z.string().trim().min(1).max(500),
      }),
    ]),
    status: z.enum(["pending", "approved", "rejected"]),
    createdAt: dateTimeSchema,
    reviewedAt: dateTimeSchema.nullable(),
  })),
  workspaceJoinRequests: z.array(z.object({
    ref: refSchema,
    workspace: refSchema,
    requester: refSchema,
    reviewer: refSchema.nullable(),
    role: z.enum(["ADMIN", "MEMBER"]).nullable(),
    status: z.enum(["pending", "approved", "rejected"]),
    createdAt: dateTimeSchema,
    respondedAt: dateTimeSchema.nullable(),
  })),
  auditLogs: z.array(z.object({
    ref: refSchema,
    workspace: refSchema,
    actorUser: refSchema.nullable(),
    action: z.string().trim().min(1).max(160),
    entityType: z.string().trim().min(1).max(160),
    entityRef: refSchema.nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: dateTimeSchema,
  })),
  coverage: z.object({
    tables: z.record(z.string(), z.number().int().nonnegative()),
    monthlyTransactions: z.record(z.string(), z.object({
      total: z.number().int().nonnegative(),
      byMember: z.record(z.string(), z.number().int().nonnegative()),
    })),
    futureTransactions: z.number().int().nonnegative(),
    transactionTypes: z.record(z.string(), z.number().int().nonnegative()),
    workflowStatuses: z.record(z.string(), z.number().int().nonnegative()),
  }),
});

export type SampleDataset = z.infer<typeof sampleDatasetSchema>;
