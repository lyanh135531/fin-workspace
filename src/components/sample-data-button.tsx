"use client";

import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { openSampleWorkspaceAction } from "@/app/sample-data/actions";
import { Button } from "@/components/base";
import { cn } from "@/lib/utils";

export function SampleDataButton({
  label = "Khám phá dữ liệu mẫu",
  variant = "outline",
  className,
}: {
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function openSampleWorkspace() {
    const sampleTab = window.open("/sample-data/loading", "_blank");
    if (!sampleTab) {
      toast.error("Trình duyệt đang chặn tab mới. Hãy cho phép pop-up rồi thử lại.");
      return;
    }

    sampleTab.opener = null;

    startTransition(async () => {
      const result = await openSampleWorkspaceAction();
      if (!result.ok || !result.url) {
        sampleTab.close();
        toast.error(result.message ?? "Không thể mở dữ liệu mẫu.");
        return;
      }

      sampleTab.location.replace(result.url);
      toast.success(result.created ? "Đã tạo workspace mẫu." : "Đang mở lại workspace mẫu.");
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("sample-data-trigger", className)}
      onClick={openSampleWorkspace}
      disabled={pending}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
      {pending ? "Đang chuẩn bị…" : label}
      {!pending && <ExternalLink size={14} />}
    </Button>
  );
}
