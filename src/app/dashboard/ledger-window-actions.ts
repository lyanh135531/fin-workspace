"use server";

import { z } from "zod";
import { idSchema } from "@/domain";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { toActionFailure } from "@/lib/server-error";
import { accessibleWorkspaceMemberWhere } from "@/services/active-workspace";
import { queryWorkspaceLedgerBundle } from "@/services/ledger-window-query";

const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Ngày không hợp lệ.");

const ledgerWindowRequestSchema = z
  .object({
    workspaceId: idSchema,
    from: isoDateStringSchema.nullable(),
    to: isoDateStringSchema.nullable(),
  })
  .refine(
    (data) =>
      (data.from === null && data.to === null) ||
      (data.from !== null && data.to !== null && data.from <= data.to),
    { message: "Khoảng thời gian tra cứu không hợp lệ." },
  );

export async function getWorkspaceLedgerWindowAction(input: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const parsed = ledgerWindowRequestSchema.parse(input);
    const membership = await prisma.workspaceMember.findFirst({
      where: accessibleWorkspaceMemberWhere(session.user.id, parsed.workspaceId),
      include: { role: { select: { code: true } } },
    });
    if (!membership) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập sổ giao dịch này.");
    }

    const bundle = await queryWorkspaceLedgerBundle({
      workspaceId: parsed.workspaceId,
      memberId: membership.id,
      isAdmin: isAdminRole(membership.role.code),
      range:
        parsed.from && parsed.to
          ? { from: parsed.from, to: parsed.to }
          : null,
      includePinned: false,
    });

    return {
      ok: true as const,
      data: bundle,
    };
  } catch (error) {
    return toActionFailure(error, "Không thể tải dữ liệu kỳ giao dịch.", {
      event: "ledger.window_fetch_failed",
    });
  }
}
