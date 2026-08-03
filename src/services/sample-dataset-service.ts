import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import sampleDatasetJson from "@/data/sample-datasets/full-demo.vi-VN.v1.json";
import { sampleDatasetSchema, type SampleDataset } from "@/domain/sample-dataset/schema";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { generateUniqueInviteCode } from "@/services/workspace-service";

const dataset = sampleDatasetSchema.parse(sampleDatasetJson);

function databaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function requiredRef<T>(map: Map<string, T>, ref: string, label: string): T {
  const value = map.get(ref);
  if (!value) throw new AppError("VALIDATION_ERROR", `Dữ liệu mẫu tham chiếu ${label} không hợp lệ: ${ref}.`);
  return value;
}

function calculateWalletBalances(data: SampleDataset) {
  const balances = new Map(data.wallets.map((wallet) => [wallet.ref, new Decimal(wallet.openingBalance)]));

  for (const transaction of data.transactions) {
    if (transaction.workflowStatus !== "approved") continue;
    const amount = new Decimal(transaction.amount);
    const source = requiredRef(balances, transaction.wallet, "ví nguồn");

    if (transaction.type === "income") balances.set(transaction.wallet, source.plus(amount));
    if (transaction.type === "expense") balances.set(transaction.wallet, source.minus(amount));
    if (transaction.type === "transfer") {
      if (!transaction.toWallet || transaction.toWallet === transaction.wallet) {
        throw new AppError("VALIDATION_ERROR", `Giao dịch chuyển khoản không hợp lệ: ${transaction.ref}.`);
      }
      const destination = requiredRef(balances, transaction.toWallet, "ví nhận");
      balances.set(transaction.wallet, source.minus(amount));
      balances.set(transaction.toWallet, destination.plus(amount));
    }
  }

  for (const wallet of data.wallets) {
    const computed = requiredRef(balances, wallet.ref, "số dư ví");
    if (!computed.equals(wallet.currentBalance)) {
      throw new AppError("VALIDATION_ERROR", `Số dư ví mẫu không khớp: ${wallet.ref}.`);
    }
  }

  return balances;
}

function resolveTransactionSnapshot(
  snapshot: SampleDataset["transactionChangeRequests"][number]["previousData"],
  walletIds: Map<string, string>,
  categoryIds: Map<string, string>,
) {
  return {
    walletId: requiredRef(walletIds, snapshot.wallet, "ví"),
    toWalletId: snapshot.toWallet ? requiredRef(walletIds, snapshot.toWallet, "ví nhận") : null,
    categoryId: snapshot.category ? requiredRef(categoryIds, snapshot.category, "danh mục") : null,
    type: snapshot.type,
    amount: snapshot.amount,
    description: snapshot.description,
    date: snapshot.date,
    workflowStatus: snapshot.workflowStatus,
  };
}

function resolveProposedData(
  proposedData: SampleDataset["transactionChangeRequests"][number]["proposedData"],
  walletIds: Map<string, string>,
  categoryIds: Map<string, string>,
) {
  if (proposedData.action === "delete") return proposedData;
  return {
    action: "update",
    reason: proposedData.reason,
    transaction: {
      walletId: requiredRef(walletIds, proposedData.transaction.wallet, "ví"),
      toWalletId: proposedData.transaction.toWallet
        ? requiredRef(walletIds, proposedData.transaction.toWallet, "ví nhận")
        : null,
      categoryId: proposedData.transaction.category
        ? requiredRef(categoryIds, proposedData.transaction.category, "danh mục")
        : null,
      type: proposedData.transaction.type,
      amount: proposedData.transaction.amount,
      description: proposedData.transaction.description,
      date: proposedData.transaction.date,
    },
  };
}

export async function ensureSampleWorkspaceForUser(userId: string) {
  const syntheticUsers = dataset.users.filter((user) => user.source === "synthetic");
  const passwordHashes = await Promise.all(
    syntheticUsers.map(() => argon2.hash(randomBytes(32).toString("hex"))),
  );
  const walletBalances = calculateWalletBalances(dataset);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "USERS"
      WHERE "id" = CAST(${userId} AS uuid)
      FOR UPDATE
    `);

    const activeUser = await tx.user.findFirst({
      where: { id: userId, status: "active", deletedAt: null },
      select: { id: true },
    });
    if (!activeUser) throw new AppError("AUTHENTICATION_REQUIRED", "Tài khoản đang hoạt động là bắt buộc.");

    const existing = await tx.workspaceMember.findFirst({
      where: {
        userId,
        status: "active",
        deletedAt: null,
        workspace: {
          status: "active",
          deletedAt: null,
          sampleDatasetKey: dataset.key,
          sampleDatasetVersion: dataset.formatVersion,
        },
      },
      select: { workspaceId: true },
    });
    if (existing) return { workspaceId: existing.workspaceId, created: false };

    const roleRows = await tx.role.findMany({
      where: { code: { in: dataset.roleReferences } },
      select: { id: true, code: true },
    });
    const roleIds = new Map(roleRows.map((role) => [role.code, role.id]));
    for (const roleCode of dataset.roleReferences) requiredRef(roleIds, roleCode, "vai trò");

    const workspaceFixture = dataset.workspaces[0];
    const workspaceId = randomUUID();
    const inviteCode = await generateUniqueInviteCode(tx);
    await tx.workspace.create({
      data: {
        id: workspaceId,
        name: workspaceFixture.name,
        description: workspaceFixture.description,
        status: workspaceFixture.status,
        baseCurrency: workspaceFixture.baseCurrency,
        timeZone: workspaceFixture.timeZone,
        inviteCode,
        sampleDatasetKey: dataset.key,
        sampleDatasetVersion: dataset.formatVersion,
      },
    });

    const workspaceIds = new Map([[workspaceFixture.ref, workspaceId]]);
    const userIds = new Map<string, string>();
    const currentUserFixture = dataset.users.find((user) => user.source === "currentUser");
    if (!currentUserFixture) throw new AppError("VALIDATION_ERROR", "Dữ liệu mẫu thiếu người dùng hiện tại.");
    userIds.set(currentUserFixture.ref, userId);

    await tx.user.createMany({
      data: syntheticUsers.map((user, index) => {
        const id = randomUUID();
        userIds.set(user.ref, id);
        return {
          id,
          username: user.usernameTemplate.replace("{installationId}", workspaceId.slice(0, 8)),
          passwordHash: passwordHashes[index],
          status: user.status,
        };
      }),
    });

    const memberIds = new Map(dataset.workspaceMembers.map((member) => [member.ref, randomUUID()]));
    await tx.workspaceMember.createMany({
      data: dataset.workspaceMembers.map((member) => ({
        id: requiredRef(memberIds, member.ref, "thành viên"),
        workspaceId: requiredRef(workspaceIds, member.workspace, "workspace"),
        userId: requiredRef(userIds, member.user, "người dùng"),
        roleId: requiredRef(roleIds, member.role, "vai trò"),
        status: member.status,
        createdAt: new Date(member.joinedAt),
      })),
    });

    const walletIds = new Map(dataset.wallets.map((wallet) => [wallet.ref, randomUUID()]));
    await tx.wallet.createMany({
      data: dataset.wallets.map((wallet) => ({
        id: requiredRef(walletIds, wallet.ref, "ví"),
        name: wallet.name,
        description: wallet.description,
        openingBalance: new Decimal(wallet.openingBalance),
        currentBalance: requiredRef(walletBalances, wallet.ref, "số dư ví"),
        status: wallet.status,
      })),
    });
    await tx.workspaceWallet.createMany({
      data: dataset.workspaceWallets.map((link) => ({
        workspaceId: requiredRef(workspaceIds, link.workspace, "workspace"),
        walletId: requiredRef(walletIds, link.wallet, "ví"),
      })),
    });

    const categoryIds = new Map(dataset.categories.map((category) => [category.ref, randomUUID()]));
    await tx.category.createMany({
      data: dataset.categories.map((category) => ({
        id: requiredRef(categoryIds, category.ref, "danh mục"),
        workspaceId: category.scope === "workspace"
          ? requiredRef(workspaceIds, category.workspace ?? "", "workspace danh mục")
          : null,
        userId: category.scope === "user"
          ? requiredRef(userIds, category.user ?? "", "người dùng danh mục")
          : null,
        name: category.name,
        code: category.code,
        color: category.color,
        type: category.type,
        icon: category.icon,
        parentId: category.parent ? requiredRef(categoryIds, category.parent, "danh mục cha") : null,
        sortOrder: category.sortOrder,
        status: category.status,
      })),
    });

    const recurringIds = new Map(dataset.recurringTransactions.map((item) => [item.ref, randomUUID()]));
    await tx.recurringTransaction.createMany({
      data: dataset.recurringTransactions.map((item) => ({
        id: requiredRef(recurringIds, item.ref, "giao dịch định kỳ"),
        workspaceId: requiredRef(workspaceIds, item.workspace, "workspace"),
        createdByMemberId: requiredRef(memberIds, item.createdByMember, "thành viên tạo"),
        walletId: requiredRef(walletIds, item.wallet, "ví"),
        toWalletId: item.toWallet ? requiredRef(walletIds, item.toWallet, "ví nhận") : null,
        categoryId: item.category ? requiredRef(categoryIds, item.category, "danh mục") : null,
        type: item.type,
        amount: new Decimal(item.amount),
        description: item.description,
        dayOfMonth: item.dayOfMonth,
        startDate: databaseDate(item.startDate),
        endDate: item.endDate ? databaseDate(item.endDate) : null,
        nextExecutionDate: databaseDate(item.nextExecutionDate),
        status: item.status,
      })),
    });

    const transactionIds = new Map(dataset.transactions.map((item) => [item.ref, randomUUID()]));
    await tx.transaction.createMany({
      data: dataset.transactions.map((item) => ({
        id: requiredRef(transactionIds, item.ref, "giao dịch"),
        memberId: requiredRef(memberIds, item.member, "thành viên"),
        walletId: requiredRef(walletIds, item.wallet, "ví"),
        toWalletId: item.toWallet ? requiredRef(walletIds, item.toWallet, "ví nhận") : null,
        categoryId: item.category ? requiredRef(categoryIds, item.category, "danh mục") : null,
        type: item.type,
        workflowStatus: item.workflowStatus,
        amount: new Decimal(item.amount),
        description: item.description,
        date: databaseDate(item.date),
        recurringTransactionId: item.recurringTransaction
          ? requiredRef(recurringIds, item.recurringTransaction, "giao dịch định kỳ")
          : null,
        recurringPeriod: item.recurringPeriod,
      })),
    });

    const changeRequestIds = new Map(dataset.transactionChangeRequests.map((item) => [item.ref, randomUUID()]));
    await tx.transactionChangeRequest.createMany({
      data: dataset.transactionChangeRequests.map((item) => ({
        id: requiredRef(changeRequestIds, item.ref, "yêu cầu thay đổi"),
        transactionId: requiredRef(transactionIds, item.transaction, "giao dịch"),
        requesterMemberId: requiredRef(memberIds, item.requesterMember, "thành viên yêu cầu"),
        reviewerMemberId: item.reviewerMember
          ? requiredRef(memberIds, item.reviewerMember, "thành viên duyệt")
          : null,
        previousData: resolveTransactionSnapshot(item.previousData, walletIds, categoryIds),
        proposedData: resolveProposedData(item.proposedData, walletIds, categoryIds),
        status: item.status,
        createdAt: new Date(item.createdAt),
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
      })),
    });

    const joinRequestIds = new Map(dataset.workspaceJoinRequests.map((item) => [item.ref, randomUUID()]));
    await tx.workspaceJoinRequest.createMany({
      data: dataset.workspaceJoinRequests.map((item) => ({
        id: requiredRef(joinRequestIds, item.ref, "yêu cầu tham gia"),
        workspaceId: requiredRef(workspaceIds, item.workspace, "workspace"),
        requesterId: requiredRef(userIds, item.requester, "người gửi yêu cầu"),
        reviewerId: item.reviewer ? requiredRef(userIds, item.reviewer, "người duyệt") : null,
        roleId: item.role ? requiredRef(roleIds, item.role, "vai trò") : null,
        status: item.status,
        createdAt: new Date(item.createdAt),
        respondedAt: item.respondedAt ? new Date(item.respondedAt) : null,
      })),
    });

    const entityIds = new Map<string, string>([
      ...workspaceIds,
      ...walletIds,
      ...categoryIds,
      ...recurringIds,
      ...transactionIds,
      ...changeRequestIds,
      ...joinRequestIds,
    ]);
    await tx.auditLog.createMany({
      data: dataset.auditLogs.map((item) => ({
        id: randomUUID(),
        workspaceId: requiredRef(workspaceIds, item.workspace, "workspace"),
        actorUserId: item.actorUser ? requiredRef(userIds, item.actorUser, "người thực hiện") : null,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityRef ? requiredRef(entityIds, item.entityRef, "đối tượng audit") : null,
        metadata: item.metadata as Prisma.InputJsonValue,
        createdAt: new Date(item.createdAt),
      })),
    });

    return { workspaceId, created: true };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export function sampleWorkspaceUrl(workspaceId: string) {
  return `/sample/${workspaceId}/overview`;
}
