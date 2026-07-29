"use client";

import { Button, Empty } from "@/components/base";
import { CircleDollarSign, Clock3, Landmark, PanelRightClose, PanelRightOpen, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Metric = { label: string; value: string; note: string; tone: "balance" | "income" | "expense" | "pending" };
type Wallet = { id: string; name: string; balance: string };

const icons = { balance: CircleDollarSign, income: TrendingUp, expense: TrendingDown, pending: Clock3 };

function SummaryContent({
  metrics,
  wallets,
  periodLabel,
  titleId,
  onClose,
  onCollapse,
}: {
  metrics: Metric[];
  wallets: Wallet[];
  periodLabel: string;
  titleId: string;
  onClose?: () => void;
  onCollapse?: () => void;
}) {
  return <>
    <header className="finance-drawer-header">
      <div>
        <p className="settings-eyebrow">{periodLabel}</p>
        <h2 id={titleId}>Tình hình tài chính</h2>
        <small>Chỉ tính giao dịch đã ghi nhận trong kỳ đang lọc</small>
      </div>
      {onClose && <Button variant="unstyled" size="auto" type="button" autoFocus className="finance-drawer-close" aria-label="Đóng tình hình tài chính" onClick={onClose}><X size={18}/></Button>}
      {onCollapse && <Button variant="unstyled" size="auto" type="button" className="finance-summary-desktop-toggle" aria-label="Thu gọn tình hình tài chính" aria-expanded={true} aria-controls="finance-summary-desktop-content" onClick={onCollapse}><PanelRightClose size={18}/></Button>}
    </header>

    <div className="finance-drawer-metrics">{metrics.map((metric) => {
      const Icon = icons[metric.tone];
      return <article key={metric.label} className={`finance-drawer-metric metric-${metric.tone}`}>
        <span><Icon size={16}/></span>
        <div><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></div>
      </article>;
    })}</div>

    <section className="finance-drawer-wallets">
      <header><div><p>Ví đang hoạt động</p><small>Số dư hiện tại của từng ví</small></div><span>{wallets.length}</span></header>
      <div className="finance-drawer-wallet-list" tabIndex={wallets.length ? 0 : -1} aria-label="Danh sách ví đang hoạt động">
        {wallets.map((wallet) => <article key={wallet.id}>
          <span className="wallet-summary-mark"><WalletCards size={15}/></span>
          <div><strong>{wallet.name}</strong><small>Số dư hiện tại</small></div>
          <b>{wallet.balance}</b>
        </article>)}
        {wallets.length === 0 && (
          <Empty
            variant="compact"
            icon={WalletCards}
            title="Chưa có ví đang hoạt động"
            description="Ví được tạo hoặc kích hoạt sẽ xuất hiện tại đây."
          />
        )}
      </div>
    </section>
  </>;
}

export function DashboardSummaryPanel({ metrics, wallets, periodLabel }: { metrics: Metric[]; wallets: Wallet[]; periodLabel: string }) {
  const [open, setOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const balanceMetric = metrics.find((metric) => metric.tone === "balance") ?? metrics[0];

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    const closeMobilePanelOnDesktop = () => {
      if (desktopQuery.matches) setOpen(false);
    };
    closeMobilePanelOnDesktop();
    desktopQuery.addEventListener("change", closeMobilePanelOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeMobilePanelOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closePanel() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  return <div className={`finance-drawer ${desktopCollapsed ? "finance-drawer-collapsed" : ""}`}>
    <aside className="finance-summary-desktop" aria-label="Tình hình tài chính">
      <div
        id="finance-summary-desktop-content"
        className="finance-summary-desktop-content"
        hidden={desktopCollapsed}
      >
        <SummaryContent
          metrics={metrics}
          wallets={wallets}
          periodLabel={periodLabel}
          titleId="finance-summary-desktop-title"
          onCollapse={() => setDesktopCollapsed(true)}
        />
      </div>
      {desktopCollapsed && (
        <Button
          variant="unstyled"
          size="auto"
          type="button"
          className="finance-summary-desktop-rail"
          aria-label="Mở rộng tình hình tài chính"
          aria-expanded={false}
          aria-controls="finance-summary-desktop-content"
          onClick={() => setDesktopCollapsed(false)}
        >
          <PanelRightOpen size={18}/>
          <span>Tình hình tài chính</span>
          <Landmark size={16}/>
        </Button>
      )}
    </aside>

    <Button variant="unstyled" size="auto"
      ref={launcherRef}
      type="button"
      className="finance-drawer-launcher"
      aria-expanded={open}
      aria-controls="finance-summary-drawer"
      onClick={() => setOpen(true)}
    >
      <span className="finance-drawer-launcher-icon"><Landmark size={18}/></span>
      <span className="finance-drawer-launcher-copy" aria-live="polite">
        <small>Tình hình tài chính</small>
        <strong>{balanceMetric?.value ?? "Chưa có dữ liệu"}</strong>
      </span>
      <span className="finance-drawer-launcher-meta">{periodLabel}</span>
      <span className="finance-drawer-launcher-action">Xem chi tiết <PanelRightOpen size={16}/></span>
    </Button>

    {open && <>
      <Button variant="unstyled" size="auto" type="button" className="finance-drawer-backdrop" aria-label="Đóng tình hình tài chính" onClick={closePanel}/>
      <aside
        id="finance-summary-drawer"
        className="finance-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-summary-mobile-title"
      >
        <SummaryContent
          metrics={metrics}
          wallets={wallets}
          periodLabel={periodLabel}
          titleId="finance-summary-mobile-title"
          onClose={closePanel}
        />
      </aside>
    </>}
  </div>;
}
