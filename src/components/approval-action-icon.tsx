import { CircleCheckBig, CircleX } from "lucide-react";

import { Button, type ButtonProps } from "@/components/base/button";

export function ApprovalActionIcon({
  decision,
}: {
  decision: "approve" | "reject";
}) {
  const Icon = decision === "approve" ? CircleCheckBig : CircleX;

  return (
    <Icon
      size={16}
      strokeWidth={2}
      className={
        decision === "approve"
          ? "text-[var(--success)]"
          : "text-[var(--danger)]"
      }
      aria-hidden="true"
    />
  );
}

type ApprovalActionButtonProps = Omit<
  ButtonProps,
  "aria-label" | "children" | "size" | "title" | "variant"
> & {
  decision: "approve" | "reject";
};

export function ApprovalActionButton({
  decision,
  ...props
}: ApprovalActionButtonProps) {
  const label = decision === "approve" ? "Duyệt" : "Từ chối";

  return (
    <Button
      size="sm"
      variant={decision === "approve" ? "success" : "destructive"}
      title={label}
      aria-label={label}
      {...props}
    >
      <ApprovalActionIcon decision={decision} />
      {label}
    </Button>
  );
}
