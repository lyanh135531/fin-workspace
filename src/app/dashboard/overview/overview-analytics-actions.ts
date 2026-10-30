"use server";

import { z } from "zod";
import { idSchema } from "@/domain";
import { AppError } from "@/lib/errors";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { toActionFailure } from "@/lib/server-error";
import { accessibleWorkspaceMemberWhere } from "@/services/active-workspace";
import { queryOverviewPeriodAnalytics } from "@/services/overview-analytics-service";

const overviewAnalyticsRequestSchema = z.object({
  workspaceId: idSchema,
  reportPeriod: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ báo cáo không hợp lệ."),
  period: z.enum(["month", "quarter", "year"]),
});

export async function getOverviewPeriodAnalyticsAction(input: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const parsed = overviewAnalyticsRequestSchema.parse(input);
    const membership = await prisma.workspaceMember.findFirst({
      where: accessibleWorkspaceMemberWhere(session.user.id, parsed.workspaceId),
      select: { id: true },
    });
    if (!membership) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền xem báo cáo nhóm này.");
    }

    const data = await queryOverviewPeriodAnalytics({
      userId: session.user.id,
      workspaceId: parsed.workspaceId,
      reportPeriod: parsed.reportPeriod,
      period: parsed.period,
    });

    return {
      ok: true as const,
      data,
    };
  } catch (error) {
    return toActionFailure(error, "Không thể tải dữ liệu phân tích kỳ.", {
      event: "overview.analytics_fetch_failed",
    });
  }
}
