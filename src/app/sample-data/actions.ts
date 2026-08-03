"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { ensureSampleWorkspaceForUser, sampleWorkspaceUrl } from "@/services/sample-dataset-service";

export async function openSampleWorkspaceAction() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Vui lòng đăng nhập để xem dữ liệu mẫu.");
    const result = await ensureSampleWorkspaceForUser(session.user.id);
    return {
      ok: true as const,
      url: sampleWorkspaceUrl(result.workspaceId),
      created: result.created,
      message: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      url: null,
      created: false,
      message: error instanceof Error ? error.message : "Không thể chuẩn bị dữ liệu mẫu.",
    };
  }
}
