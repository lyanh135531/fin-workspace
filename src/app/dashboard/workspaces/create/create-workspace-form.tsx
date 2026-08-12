"use client";

import {
  ArrowRight,
  Building2,
  Check,
  KeyRound,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useState, useTransition } from "react";

import { createWorkspaceAction } from "@/app/dashboard/settings/actions";
import { Button, Card, Input, Loading } from "@/components/base";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const NAME_SUGGESTIONS = [
  "Chi tiêu gia đình",
  "Tài chính cá nhân",
  "Quản lý dự án",
];

const WORKSPACE_BENEFITS = [
  {
    icon: Wallet,
    title: "Ví chính mặc định",
    description: "Bắt đầu theo dõi số dư và giao dịch ngay từ hôm nay.",
    tone: "mint",
  },
  {
    icon: ShieldCheck,
    title: "Quyền Admin của bạn",
    description: "Quản lý thành viên, ví và các quy tắc phê duyệt.",
    tone: "coral",
  },
  {
    icon: KeyRound,
    title: "Mã mời gia nhập",
    description: "Mời những người cần đồng hành trong không gian này.",
    tone: "sky",
  },
] as const;

export function CreateWorkspaceForm() {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const result = await createWorkspaceAction({
        name: form.get("name"),
        description: form.get("description") || undefined,
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
        approvalRequired: form.get("approvalRequired") === "on",
      });
      if (result.ok) {
        toast.success("Đã tạo workspace. Đang chuyển hướng...");
        setTimeout(() => {
          window.location.assign("/overview");
        }, 800);
      } else {
        toast.error(result.message ?? "Không thể tạo workspace.");
      }
    });
  }

  return (
    <div className="workspace-create-page">
      <div className="workspace-create-layout">
        <section
          className="workspace-create-intro"
          aria-labelledby="create-workspace-title"
        >
          <div className="workspace-create-eyebrow">
            <span className="workspace-create-eyebrow-mark" aria-hidden="true">
              <Building2 size={15} strokeWidth={2.2} />
            </span>
            <span>Workspace / Khởi tạo</span>
          </div>

          <div className="workspace-create-intro-copy">
            <h1 id="create-workspace-title">
              Một không gian rõ ràng cho mọi quyết định tài chính.
            </h1>
            <p>
              Tập hợp ví, giao dịch và những người quan trọng vào một nơi được
              thiết kế để mọi thứ luôn dễ hiểu.
            </p>
          </div>

          <div className="workspace-create-visual" aria-hidden="true">
            <div className="workspace-create-visual-orbit workspace-create-visual-orbit-one" />
            <div className="workspace-create-visual-orbit workspace-create-visual-orbit-two" />
            <div className="workspace-create-visual-topline">
              <span>WORKSPACE OVERVIEW</span>
              <span className="workspace-create-live-label">
                <span className="workspace-create-live-dot" />
                READY TO SET UP
              </span>
            </div>
            <div className="workspace-create-visual-heading">
              <span className="workspace-create-visual-icon">
                <Building2 size={20} strokeWidth={1.8} />
              </span>
              <span>
                <strong>Your new workspace</strong>
                <small>VND · Asia/Ho_Chi_Minh</small>
              </span>
            </div>
            <div className="workspace-create-visual-metrics">
              <div>
                <span>Ví & giao dịch</span>
                <strong>Đồng bộ sẵn</strong>
              </div>
              <div>
                <span>Thành viên</span>
                <strong>Chỉ mình bạn</strong>
              </div>
            </div>
            <div className="workspace-create-visual-footer">
              <span className="workspace-create-visual-check">
                <Check size={13} strokeWidth={2.4} />
              </span>
              <span>Khởi tạo trong vài giây</span>
            </div>
          </div>

          <div className="workspace-create-intro-note">
            <Sparkles size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Bạn sẽ là Admin đầu tiên của không gian này.</span>
          </div>
        </section>

        <Card as="section" className="workspace-create-form-card">
          <div className="workspace-create-form-header">
            <div>
              <span className="workspace-create-form-kicker">
                Bắt đầu từ một cái tên
              </span>
              <h2>Thiết lập workspace</h2>
            </div>
            <span className="workspace-create-time-label">
              Mất khoảng 1 phút
            </span>
          </div>

          <p className="workspace-create-form-description">
            Chọn một cái tên thân thuộc. Bạn luôn có thể cập nhật thông tin này
            trong phần cài đặt sau đó.
          </p>

          <form
            onSubmit={submit}
            className="workspace-create-form"
            aria-busy={pending}
          >
            <div className="workspace-create-field-group">
              <Input
                label="Tên workspace"
                id="workspace-name-input"
                required
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
                maxLength={120}
                placeholder="Ví dụ: Chi tiêu gia đình"
                className="workspace-create-input"
                autoFocus
              />
            </div>

            <div className="workspace-create-field-group">
              <Textarea
                label={
                  <>
                    Mô tả ngắn{" "}
                    <span className="workspace-create-optional">
                      (tùy chọn)
                    </span>
                  </>
                }
                id="workspace-desc-input"
                name="description"
                maxLength={500}
                rows={4}
                placeholder="Mục đích hoặc phạm vi sử dụng"
                className="workspace-create-textarea"
              />
            </div>

            <div className="workspace-create-submit-area">
              <Button
                type="submit"
                disabled={pending || !name.trim()}
                className="workspace-create-submit"
              >
                {pending ? (
                  <Loading label="Đang khởi tạo..." />
                ) : (
                  <>
                    Khởi tạo workspace
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="workspace-create-benefits">
            <div className="workspace-create-benefits-heading">
              <span className="workspace-create-benefits-kicker">
                Sau khi tạo
              </span>
              <span className="workspace-create-benefits-line" />
              <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="workspace-create-benefit-list">
              {WORKSPACE_BENEFITS.map(
                ({ icon: Icon, title, description, tone }) => (
                  <div className="workspace-create-benefit" key={title}>
                    <span
                      className={`workspace-create-benefit-icon is-${tone}`}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="workspace-create-benefit-copy">
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
