"use client";

import { ArrowLeft, FlaskConical } from "lucide-react";
import { Button } from "@/components/base";

export function SampleWorkspaceBanner({ workspaceName }: { workspaceName: string }) {
  function closeSampleWorkspace() {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.replace("/overview");
      }
    }, 150);
  }

  return (
    <aside className="sample-workspace-banner" aria-label="Thông báo dữ liệu mẫu">
      <div className="sample-workspace-banner-icon" aria-hidden="true">
        <FlaskConical size={18} />
      </div>
      <div className="sample-workspace-banner-copy">
        <span>Dữ liệu trải nghiệm</span>
        <strong>Bạn đang xem {workspaceName}</strong>
        <p>Mọi thay đổi tại đây chỉ áp dụng cho workspace mẫu, không ảnh hưởng dữ liệu thật của bạn.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="sample-workspace-banner-exit"
        onClick={closeSampleWorkspace}
      >
        <ArrowLeft size={15} />
        Về dữ liệu của tôi
      </Button>
    </aside>
  );
}
