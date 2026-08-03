import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureSampleWorkspaceForUser } from "@/services/sample-dataset-service";

const integrationEnabled = process.env.SAMPLE_DATASET_INTEGRATION === "1";
const testUsername = "sample_dataset_integration_owner";
let testUserId = "";

describe.runIf(integrationEnabled)("sample dataset installation", () => {
  beforeAll(async () => {
    const passwordHash = await argon2.hash("integration-test-password");
    const user = await prisma.user.create({
      data: { username: testUsername, passwordHash },
      select: { id: true },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("installs all sample records once and reopens the same workspace", async () => {
    const first = await ensureSampleWorkspaceForUser(testUserId);
    const second = await ensureSampleWorkspaceForUser(testUserId);

    expect(first.created).toBe(true);
    expect(second).toEqual({ workspaceId: first.workspaceId, created: false });

    const [workspace, memberCount, walletCount, categoryCount, recurringCount, transactionCount, changeRequestCount, joinRequestCount, auditLogCount] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: first.workspaceId } }),
      prisma.workspaceMember.count({ where: { workspaceId: first.workspaceId } }),
      prisma.workspaceWallet.count({ where: { workspaceId: first.workspaceId } }),
      prisma.category.count({ where: { workspaceId: first.workspaceId } }),
      prisma.recurringTransaction.count({ where: { workspaceId: first.workspaceId } }),
      prisma.transaction.count({ where: { member: { workspaceId: first.workspaceId } } }),
      prisma.transactionChangeRequest.count({ where: { transaction: { member: { workspaceId: first.workspaceId } } } }),
      prisma.workspaceJoinRequest.count({ where: { workspaceId: first.workspaceId } }),
      prisma.auditLog.count({ where: { workspaceId: first.workspaceId } }),
    ]);

    expect(workspace).toMatchObject({
      sampleDatasetKey: "family-finance-full-demo",
      sampleDatasetVersion: 1,
    });
    expect(memberCount).toBe(2);
    expect(walletCount).toBe(7);
    expect(categoryCount).toBe(22);
    expect(recurringCount).toBe(6);
    expect(transactionCount).toBe(276);
    expect(changeRequestCount).toBe(3);
    expect(joinRequestCount).toBe(3);
    expect(auditLogCount).toBe(15);
  }, 30_000);
});
