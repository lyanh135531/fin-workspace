import { Loading } from "@/components/base";

export default function PortalActivityLoading() {
  return (
    <div className="grid min-h-64 place-items-center">
      <Loading label="Đang tải nhật ký hoạt động..." />
    </div>
  );
}
