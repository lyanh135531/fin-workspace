"use client";

import { CircleDollarSign, Clock3, Landmark, PanelRightOpen, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Metric = { label: string; value: string; note: string; tone: "balance" | "income" | "expense" | "pending" };
type Wallet = { id: string; name: string; balance: string };

const icons = { balance: CircleDollarSign, income: TrendingUp, expense: TrendingDown, pending: Clock3 };

export function DashboardSummaryPanel({ metrics, wallets }: { metrics: Metric[]; wallets: Wallet[] }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const balanceMetric = metrics.find((metric) => metric.tone === "balance") ?? metrics[0];

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

  return <div className="finance-drawer">
    <button
      ref={launcherRef}
      type="button"
      className="finance-drawer-launcher"
      aria-expanded={open}
      aria-controls="finance-summary-drawer"
      onClick={() => setOpen(true)}
    >
      <span className="finance-drawer-launcher-icon"><Landmark size={18}/></span>
      <span className="finance-drawer-launcher-copy">
        <small>Tình hình tài chính</small>
        <strong>{balanceMetric?.value ?? "Chưa có dữ liệu"}</strong>
      </span>
      <span className="finance-drawer-launcher-meta">{wallets.length} ví hoạt động</span>
      <span className="finance-drawer-launcher-action">Xem chi tiết <PanelRightOpen size={16}/></span>
    </button>

    {open && <>
      <button type="button" className="finance-drawer-backdrop" aria-label="Đóng tình hình tài chính" onClick={closePanel}/>
      <aside id="finance-summary-drawer" className="finance-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="finance-drawer-title">
        <header className="finance-drawer-header">
          <div>
            <p className="settings-eyebrow">Tổng quan workspace</p>
            <h2 id="finance-drawer-title">Tình hình tài chính</h2>
            <small>Cập nhật theo dữ liệu trong sổ giao dịch</small>
          </div>
          <button type="button" autoFocus className="finance-drawer-close" aria-label="Đóng tình hình tài chính" onClick={closePanel}><X size={18}/></button>
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
            {wallets.length === 0 && <p className="finance-drawer-empty">Chưa có ví đang hoạt động.</p>}
          </div>
        </section>
      </aside>
    </>}
  </div>;
}
