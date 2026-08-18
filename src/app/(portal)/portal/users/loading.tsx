import { Loading } from "@/components/base";

export default function PortalUsersLoading() {
  return (
    <div className="grid min-h-64 place-items-center">
      <Loading label="Đang tải danh sách người dùng..." />
    </div>
  );
}
