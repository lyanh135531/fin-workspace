import { LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

export default function SampleDataLoadingPage() {
  return (
    <main className="sample-data-loading-page">
      <Card as="section" className="sample-data-loading-card" aria-live="polite" aria-busy="true">
        <div className="sample-data-loading-brand">
          <FinLogo size={32} showText />
          <span>Chế độ trải nghiệm</span>
        </div>

        <div className="sample-data-loading-visual" aria-hidden="true">
          <Sparkles size={22} />
          <LoaderCircle className="sample-data-loading-spinner" size={46} />
        </div>

        <div className="sample-data-loading-copy">
          <span>Đang chuẩn bị workspace mẫu</span>
          <h1>Một bức tranh tài chính gia đình đầy đủ sắp sẵn sàng</h1>
          <p>
            Fin Workspace đang thiết lập ví, thành viên, giao dịch, danh mục và các khoản định kỳ để bạn có thể khám phá ngay.
          </p>
        </div>

        <div className="sample-data-loading-progress" aria-hidden="true">
          <span />
        </div>

        <p className="sample-data-loading-note">
          <ShieldCheck size={15} />
          Dữ liệu mẫu hoàn toàn tách biệt với dữ liệu cá nhân của bạn.
        </p>
      </Card>
    </main>
  );
}
