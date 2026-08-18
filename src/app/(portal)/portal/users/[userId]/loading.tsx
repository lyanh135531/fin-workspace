import { Loading } from "@/components/base";

export default function PortalUserDetailLoading() {
  return (
    <div className="grid min-h-64 place-items-center">
      <Loading label="Đang tải thông tin người dùng..." />
    </div>
  );
}
