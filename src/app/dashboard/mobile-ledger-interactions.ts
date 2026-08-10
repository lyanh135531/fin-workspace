import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

export const MOBILE_LONG_PRESS_DELAY = 500;
export const MOBILE_LONG_PRESS_MOVE_TOLERANCE = 10;

export type MobileLedgerAction =
  | "select"
  | "approve"
  | "reject"
  | "approve-early"
  | "edit"
  | "delete";

export function exceededLongPressMoveTolerance(
  start: { x: number; y: number },
  current: { x: number; y: number },
  tolerance = MOBILE_LONG_PRESS_MOVE_TOLERANCE,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > tolerance;
}

export function getMobileLedgerActions({
  canApprove,
  canEdit,
  canDelete,
  hasPendingChange,
  status,
}: {
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hasPendingChange: boolean;
  status: "pending" | "scheduled" | "approved" | "rejected";
}): MobileLedgerAction[] {
  const actions: MobileLedgerAction[] = [];
  if (canApprove) actions.push("select");
  if (canApprove && status === "pending") actions.push("approve", "reject");
  if (canApprove && status === "scheduled") actions.push("approve-early");
  if (canEdit && !hasPendingChange) actions.push("edit");
  if (canDelete && !hasPendingChange) actions.push("delete");
  return actions;
}

export function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setIsPressing(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const open = useCallback(() => {
    if (!enabled) return;
    cancel();
    onLongPress();
  }, [cancel, enabled, onLongPress]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      cancel();
      startRef.current = { x: event.clientX, y: event.clientY };
      setIsPressing(true);
      timerRef.current = setTimeout(open, MOBILE_LONG_PRESS_DELAY);
    },
    [cancel, enabled, open],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (
        startRef.current &&
        exceededLongPressMoveTolerance(startRef.current, {
          x: event.clientX,
          y: event.clientY,
        })
      ) {
        cancel();
      }
    },
    [cancel],
  );

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      open();
    },
    [open],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const opensContextMenu =
        event.key === "ContextMenu" ||
        (event.shiftKey && event.key === "F10") ||
        event.key === "Enter" ||
        event.key === " ";
      if (!opensContextMenu) return;
      event.preventDefault();
      open();
    },
    [open],
  );

  const onClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  return {
    isPressing,
    handlers: {
      onClick,
      onContextMenu,
      onKeyDown,
      onPointerCancel: cancel,
      onPointerDown,
      onPointerLeave: cancel,
      onPointerMove,
      onPointerUp: cancel,
    },
  };
}
