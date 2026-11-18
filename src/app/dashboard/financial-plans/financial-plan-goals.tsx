"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import {
  cancelFinancialPlanGoalAction, createFinancialPlanGoalAction,
  finishFinancialPlanGoalAction, reorderFinancialPlanGoalsAction, updateFinancialPlanGoalAction,
} from "@/app/dashboard/financial-plans/actions";
import {
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  ConfirmDelete, Input, MoneyInput, MonthPicker, Sheet, SheetContent, SheetFooter, SheetHeader,
} from "@/components/base";
import { formatAmount } from "@/lib/format";
import { usePrivacyMask } from "@/lib/privacy-mask";

export type FinancialGoalView = {
  id: string; name: string; status: "draft" | "active" | "completed" | "cancelled";
  progressSource: "workspace_net_balance";
  targetAmount: string; targetMonth: string; sortOrder: number;
  actualProgress: string; progressPercentage: string; requiredThisMonth: string;
  projectedThisMonth: string; shortfallThisMonth: string; projectedAtDeadline: string;
  health: "ahead" | "on_track" | "behind" | "at_risk" | "goal_reached" | "overdue";
  canManage: boolean;
};
const HEALTH = {
  ahead: "Vượt tiến độ", on_track: "Đúng tiến độ", behind: "Chậm tiến độ",
  at_risk: "Cần chú ý", goal_reached: "Đã đạt mục tiêu", overdue: "Quá hạn",
};
const STATUS = { draft: "Bản nháp", active: "Đang chạy", completed: "Hoàn thành", cancelled: "Đã hủy" };

export function FinancialPlanGoals({ planId, planStatus, goals, currency, businessMonth, canManage }: {
  planId: string; planStatus: "draft" | "active" | "completed" | "cancelled";
  goals: FinancialGoalView[]; wallets: Array<{ id: string; name: string; balance: string }>;
  currency: string; businessMonth: string; canManage: boolean;
}) {
  usePrivacyMask();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FinancialGoalView | null | undefined>(undefined);
  const editable = canManage && (planStatus === "draft" || planStatus === "active");
  const money = (amount: string) => formatAmount(amount) + " " + currency;
  const run = (action: () => Promise<{ ok: boolean; message?: string | null }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) { toast.error(result.message || "Không thể cập nhật mục tiêu."); return; }
      toast.success("Đã cập nhật mục tiêu.");
      router.refresh();
    });
  };
  function reorder(index: number, delta: number) {
    const ids = goals.map(g => g.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    run(() => reorderFinancialPlanGoalsAction({ planId, goalIds: ids }));
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Mục tiêu tích lũy ({goals.length})</h2>
          <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
            Tiến độ tự động từ tổng số dư ví sau toàn bộ dư nợ thẻ, phân bổ theo ưu tiên.
            Mỗi khoản tiền chỉ được tính cho một mục tiêu.
          </p>
        </div>
        {editable && <Button variant="outline" disabled={pending || goals.length >= 20} onClick={() => setEditing(null)}>
          <Plus aria-hidden="true" size={16} />Thêm mục tiêu
        </Button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((goal, index) => (
          <Card key={goal.id}>
            <CardHeader>
              <CardTitle>{goal.name}</CardTitle>
              <CardDescription>
                Ưu tiên {index + 1} · Hạn {goal.targetMonth.split("-").reverse().join("/")} · {STATUS[goal.status]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[var(--text-secondary)]">Tích lũy được phân bổ</dt><dd className="font-semibold tabular-nums text-[var(--foreground)]">{money(goal.actualProgress)}</dd></div>
                  <div><dt className="text-[var(--text-secondary)]">Mục tiêu</dt><dd className="font-semibold tabular-nums text-[var(--foreground)]">{money(goal.targetAmount)}</dd></div>
                  <div><dt className="text-[var(--text-secondary)]">Cần dành tháng này</dt><dd className="tabular-nums text-[var(--foreground)]">{money(goal.requiredThisMonth)}</dd></div>
                  <div><dt className="text-[var(--text-secondary)]">Dự kiến đến hạn</dt><dd className="tabular-nums text-[var(--foreground)]">{money(goal.projectedAtDeadline)}</dd></div>
                </dl>
                <p className="text-sm text-[var(--text-secondary)]">{goal.progressPercentage}% · {HEALTH[goal.health]}</p>
                {editable && <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" aria-label={`Tăng ưu tiên ${goal.name}`} disabled={pending || index === 0} onClick={() => reorder(index,-1)}><ArrowUp aria-hidden="true" size={16} /></Button>
                  <Button variant="outline" size="icon" aria-label={`Giảm ưu tiên ${goal.name}`} disabled={pending || index === goals.length-1} onClick={() => reorder(index,1)}><ArrowDown aria-hidden="true" size={16} /></Button>
                  {(goal.status === "draft" || goal.status === "active") && <>
                    <Button variant="outline" disabled={pending} onClick={() => setEditing(goal)}><Pencil aria-hidden="true" size={16} />Chỉnh sửa</Button>
                    {goal.status === "active" && goal.health === "goal_reached" && <Button variant="outline" disabled={pending} onClick={() => run(() => finishFinancialPlanGoalAction({goalId:goal.id,status:"completed"}))}><Check aria-hidden="true" size={16} />Hoàn thành</Button>}
                    {(goal.status === "active" || goals.length > 1) && <ConfirmDelete
                      ariaLabel={`Hủy mục tiêu ${goal.name}`} title="Hủy mục tiêu?"
                      description="Mục tiêu sẽ ngừng được phân bổ tiền. Số dư ví và giao dịch được giữ nguyên."
                      confirmLabel="Hủy mục tiêu" disabled={pending}
                      onConfirm={async () => {
                        const result = await cancelFinancialPlanGoalAction(goal.id);
                        if (!result.ok) {toast.error(result.message); return false;}
                        router.refresh();
                      }}
                    />}
                  </>}
                </div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing !== undefined && <GoalEditor key={editing?.id ?? "new"} goal={editing} planId={planId} businessMonth={businessMonth}
        onClose={() => setEditing(undefined)} onSaved={() => {setEditing(undefined); router.refresh();}} />}
    </div>
  );
}
function GoalEditor({goal, planId, businessMonth, onClose, onSaved}: {
  goal: FinancialGoalView | null; planId:string; businessMonth:string; onClose:()=>void; onSaved:()=>void;
}) {
  const [name,setName] = useState(goal?.name ?? "");
  const [targetAmount,setAmount] = useState(goal?.targetAmount ?? "");
  const [targetMonth,setMonth] = useState(goal?.targetMonth ?? businessMonth);
  const [error,setError] = useState<string | null>(null);
  const [pending,startTransition] = useTransition();
  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {name,targetAmount,targetMonth};
      const result = goal ? await updateFinancialPlanGoalAction({...payload,goalId:goal.id})
        : await createFinancialPlanGoalAction({...payload,planId});
      if (!result.ok) {setError(result.message || "Không thể lưu mục tiêu."); return;}
      toast.success("Đã lưu mục tiêu.");
      onSaved();
    });
  }
  return <Sheet open onOpenChange={open => {if (!open && !pending) onClose();}}>
    <SheetContent side="right" size="wide" spacing="flush" elevation="flat">
      <SheetHeader icon={Target} title={goal ? "Chỉnh sửa mục tiêu" : "Thêm mục tiêu"} description="Tiến độ được tính tự động từ nguồn tiền ròng của workspace." />
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4 lg:p-6">
        <Input label="Tên mục tiêu" value={name} onChange={event => setName(event.target.value)} required disabled={pending} />
        <MoneyInput label="Số tiền mục tiêu" value={targetAmount} onValueChange={setAmount} required disabled={pending} />
        <MonthPicker label="Tháng hoàn thành" minMonth={businessMonth} value={targetMonth} onValueChange={setMonth} required disabled={pending} />
        {error && <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p>}
      </div>
      <SheetFooter cancelLabel="Hủy" onCancel={onClose} submitLabel="Lưu mục tiêu" submitType="button" onSubmit={submit}
        submitDisabled={pending || !name.trim() || !targetAmount || targetMonth < businessMonth} />
    </SheetContent>
  </Sheet>;
}

