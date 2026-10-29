import "dotenv/config";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  QUICK_CAPTURE_CANCEL_OPTION,
  authenticateQuickCaptureBearer,
  commitQuickCapture,
  createQuickCaptureToken,
  hashQuickCaptureToken,
  prepareQuickCapture,
  revokeQuickCaptureToken,
} from "@/services/quick-capture-service";

describe("quick capture service database invariants", () => {
  const workspaceId = randomUUID();
  const memberUserId = randomUUID();
  const memberId = randomUUID();
  const mainWalletId = randomUUID();
  const momoWalletId = randomUUID();
  const foodCategoryId = randomUUID();
  const transportCategoryId = randomUUID();

  beforeAll(async () => {
    const memberRole = await prisma.role.findUnique({
      where: { code: "MEMBER" },
      select: { id: true },
    });
    if (!memberRole) {
      throw new Error("Database test requires MEMBER role seed.");
    }

    await prisma.user.create({
      data: {
        id: memberUserId,
        username: `qc-member-${memberUserId}`,
        passwordHash: "integration-test",
      },
    });
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "Quick Capture QA Workspace",
        timeZone: "Asia/Ho_Chi_Minh",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        id: memberId,
        workspaceId,
        userId: memberUserId,
        roleId: memberRole.id,
      },
    });

    await prisma.wallet.createMany({
      data: [
        {
          id: mainWalletId,
          name: "Ví chính",
          openingBalance: new Decimal(5_000_000),
          currentBalance: new Decimal(5_000_000),
        },
        {
          id: momoWalletId,
          name: "Ví MoMo",
          assetSubtype: "e_wallet",
          openingBalance: new Decimal(2_000_000),
          currentBalance: new Decimal(2_000_000),
        },
      ],
    });
    await prisma.workspaceWallet.createMany({
      data: [
        { workspaceId, walletId: mainWalletId, sortOrder: 0 },
        { workspaceId, walletId: momoWalletId, sortOrder: 1 },
      ],
    });

    await prisma.category.createMany({
      data: [
        {
          id: foodCategoryId,
          workspaceId,
          name: "Ăn uống",
          code: "QC_FOOD",
          color: "#F97316",
          type: "expense",
          jarCode: "ESSENTIAL",
          sortOrder: 0,
        },
        {
          id: transportCategoryId,
          workspaceId,
          name: "Di chuyển",
          code: "QC_MOVE",
          color: "#3B82F6",
          type: "expense",
          jarCode: "ESSENTIAL",
          sortOrder: 1,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.quickCaptureDraft.deleteMany({ where: { workspaceId } });
    await prisma.quickCapturePayeeRule.deleteMany({ where: { workspaceId } });
    await prisma.quickCaptureToken.deleteMany({ where: { workspaceId } });
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
    await prisma.transaction.deleteMany({ where: { memberId } });
    await prisma.category.deleteMany({ where: { workspaceId } });
    await prisma.workspaceWallet.deleteMany({ where: { workspaceId } });
    await prisma.wallet.deleteMany({
      where: { id: { in: [mainWalletId, momoWalletId] } },
    });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: memberUserId } });
  });

  it("hashes personal token, smart-routes MoMo receipts to MoMo wallet, records approved ledger entry, learns payee rule, and blocks duplicate receipts", async () => {
    const createdToken = await createQuickCaptureToken(memberUserId, {
      workspaceId,
      defaultWalletId: mainWalletId,
      name: "iPhone 15 Pro",
      expiresInDays: 30,
    });

    expect(createdToken.token.startsWith("flx_qc_")).toBe(true);

    const dbToken = await prisma.quickCaptureToken.findUnique({
      where: { id: createdToken.tokenInfo.id },
    });
    expect(dbToken?.tokenHash).toBe(hashQuickCaptureToken(createdToken.token));
    expect(dbToken?.tokenHash).not.toBe(createdToken.token);

    const actor = await authenticateQuickCaptureBearer(
      `Bearer ${createdToken.token}`,
    );
    expect(actor.userId).toBe(memberUserId);
    expect(actor.workspaceId).toBe(workspaceId);

    // 1st MoMo receipt -> smart-matches "Ví MoMo" even though default is "Ví chính"
    const firstPrepared = await prepareQuickCapture(actor, {
      text: `
        Giao dịch thành công
        -55.000đ
        Chuyển tiền đến
        HIGHLANDS COFFEE
        Lời nhắn
        Phin sua da
        Mã giao dịch
        MM202610290001
        Nguồn tiền
        Ví MoMo
        Số dư khả dụng: 1.945.000đ
      `,
    });

    expect(firstPrepared.wallet.id).toBe(momoWalletId);
    expect(firstPrepared.parsed.amount).toBe("55000");
    expect(firstPrepared.options).toEqual([
      "Ăn uống",
      "Di chuyển",
      QUICK_CAPTURE_CANCEL_OPTION,
    ]);

    const firstCommit = await commitQuickCapture(actor, {
      draftId: firstPrepared.draftId,
      selectedOption: "Ăn uống",
    });

    expect(firstCommit.cancelled).toBe(false);
    if (!firstCommit.cancelled) {
      expect(firstCommit.workflowStatus).toBe("approved");
      expect(firstCommit.walletName).toBe("Ví MoMo");
      expect(firstCommit.categoryName).toBe("Ăn uống");
      expect(firstCommit.description).toBe(
        "[MoMo] HIGHLANDS COFFEE - Phin sua da",
      );
    }

    const momoAfterFirst = await prisma.wallet.findUnique({
      where: { id: momoWalletId },
    });
    expect(momoAfterFirst?.currentBalance.toFixed(0)).toBe("1945000");

    // Duplicate externalRef must be blocked
    await expect(
      prepareQuickCapture(actor, {
        text: "MoMo: Bạn vừa chuyển 55.000đ đến HIGHLANDS COFFEE. Mã GD: MM202610290001",
      }),
    ).rejects.toThrow("Biên lai giao dịch này đã được ghi vào sổ trước đó.");

    // 2nd receipt to same payee -> automatically suggests "Ăn uống · Gợi ý" at top
    const secondPrepared = await prepareQuickCapture(actor, {
      text: "MoMo: Bạn vừa chuyển 69.000đ đến HIGHLANDS COFFEE. Mã GD: MM202610290002",
    });
    expect(secondPrepared.suggestedCategory?.id).toBe(foodCategoryId);
    expect(secondPrepared.options[0]).toBe("Ăn uống · Gợi ý");

    // Cancel option does not mutate balance
    const cancelled = await commitQuickCapture(actor, {
      draftId: secondPrepared.draftId,
      selectedOption: QUICK_CAPTURE_CANCEL_OPTION,
    });
    expect(cancelled.cancelled).toBe(true);

    // Dismissing soft-error menu in Shortcuts with empty draftId also succeeds cleanly
    const softDismiss = await commitQuickCapture(actor, {
      draftId: "",
      selectedOption: "Đóng",
    });
    expect(softDismiss.cancelled).toBe(true);

    const momoAfterCancel = await prisma.wallet.findUnique({
      where: { id: momoWalletId },
    });
    expect(momoAfterCancel?.currentBalance.toFixed(0)).toBe("1945000");

    // Tolerates raw token or accidental double "Bearer Bearer ..." from mobile copy-paste
    const rawActor = await authenticateQuickCaptureBearer(createdToken.token);
    expect(rawActor.tokenId).toBe(createdToken.tokenInfo.id);
    const doubleBearerActor = await authenticateQuickCaptureBearer(
      `Bearer Bearer ${createdToken.token}`,
    );
    expect(doubleBearerActor.tokenId).toBe(createdToken.tokenInfo.id);

    // Dismissing either row of 2-item soft-error menu in Shortcuts succeeds cleanly without consuming open drafts
    const bannerDismiss = await commitQuickCapture(actor, {
      selectedOption:
        "Thông báo: Biên lai giao dịch này đã được ghi vào sổ trước đó.",
    });
    expect(bannerDismiss.cancelled).toBe(true);

    // 3rd receipt -> linear iOS Shortcut commit WITHOUT draftId (only SelectedOption)
    await prepareQuickCapture(actor, {
      Text: "MoMo: Bạn vừa chuyển 45.000đ đến HIGHLANDS COFFEE. Mã GD: MM202610290003",
    });
    const linearCommit = await commitQuickCapture(actor, {
      SelectedOption: "Ăn uống · Gợi ý",
    });
    expect(linearCommit.cancelled).toBe(false);
    let thirdTxId = "";
    if (!linearCommit.cancelled) {
      expect(linearCommit.amount).toBe("45000");
      expect(linearCommit.categoryName).toBe("Ăn uống");
      thirdTxId = linearCommit.transactionId;
    }

    // If user soft-deletes that transaction in Felix (e.g. picked wrong category), re-capturing the same receipt is allowed!
    await prisma.transaction.update({
      where: { id: thirdTxId },
      data: { deletedAt: new Date() },
    });
    const recapturedDraft = await prepareQuickCapture(actor, {
      text: "MoMo: Bạn vừa chuyển 45.000đ đến HIGHLANDS COFFEE. Mã GD: MM202610290003",
    });
    expect(recapturedDraft.parsed.amount).toBe("45000");
    const recapturedCommit = await commitQuickCapture(actor, {
      selectedOption: "Di chuyển",
    });
    expect(recapturedCommit.cancelled).toBe(false);
    if (!recapturedCommit.cancelled) {
      expect(recapturedCommit.categoryName).toBe("Di chuyển");
    }

    // Incoming money notification is rejected with clear Vietnamese message instead of booked as expense
    await expect(
      commitQuickCapture(actor, {
        text: "MoMo: Bạn vừa nhận 200.000đ từ NGUYEN VAN B. Số dư: 2.100.000đ.",
      }),
    ).rejects.toThrow(
      "Đây là giao dịch nhận tiền vào ví, không phải khoản chi tiêu.",
    );

    // Past receipt date on screenshot is prioritized over today's date when saving to ledger
    const fixedNow = new Date("2026-10-29T08:00:00Z");
    const pastDraft = await prepareQuickCapture(
      actor,
      {
        text: `
          Giao dịch thành công
          -75.000đ
          Thanh toán cho HIGHLANDS COFFEE
          Thời gian thanh toán
          25/10/2026 - 18:30
          Mã giao dịch
          MM202610250099
          Nguồn tiền: Ví MoMo
        `,
      },
      fixedNow,
    );
    expect(pastDraft.parsed.transactionDate).toBe("2026-10-25");
    expect(pastDraft.prompt).toContain("25/10/2026");

    const pastCommit = await commitQuickCapture(
      actor,
      {
        selectedOption: "Ăn uống · Gợi ý",
      },
      new Date("2026-10-29T08:00:05Z"),
    );
    expect(pastCommit.cancelled).toBe(false);
    if (!pastCommit.cancelled) {
      expect(pastCommit.transactionDate).toBe("2026-10-25");
      const savedTx = await prisma.transaction.findUnique({
        where: { id: pastCommit.transactionId },
        select: { date: true },
      });
      expect(savedTx?.date.toISOString().slice(0, 10)).toBe("2026-10-25");
    }

    // Replaying linear commit without a new draft fails cleanly
    await expect(
      commitQuickCapture(actor, {
        selectedOption: "Ăn uống · Gợi ý",
      }),
    ).rejects.toThrow();

    // Revoking token immediately blocks bearer authentication
    await revokeQuickCaptureToken(memberUserId, {
      tokenId: createdToken.tokenInfo.id,
    });
    await expect(
      authenticateQuickCaptureBearer(`Bearer ${createdToken.token}`),
    ).rejects.toThrow();
  });
});
