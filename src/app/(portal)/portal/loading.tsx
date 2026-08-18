import { Loading } from "@/components/base";

export default function PortalLoading() {
  return (
    <div className="grid min-h-64 place-items-center">
      <Loading label="Đang tải portal..." />
    </div>
  );
}
