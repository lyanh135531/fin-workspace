"use client";

import { GripVertical } from "lucide-react";
import type { PointerEvent } from "react";

export type CategoryDragItem = {
  id: string;
  name: string;
  parentId: string | null;
};

type CategoryMobileDragHandleProps = {
  category: CategoryDragItem;
  disabled: boolean;
  isMobile: boolean;
  size: number;
  onDragStart: (category: CategoryDragItem) => void;
  onDragTargetChange: (categoryId: string | null) => void;
  onDrop: (source: CategoryDragItem, targetId: string) => void;
  onDragCancel: () => void;
};

function findDropTargetId(
  clientX: number,
  clientY: number,
  source: CategoryDragItem,
): string | null {
  const element = document.elementFromPoint(clientX, clientY);
  const row = element?.closest<HTMLElement>("[data-category-sort-id]");
  const targetId = row?.dataset.categorySortId;
  const targetParentId = row?.dataset.categorySortParent;
  const sourceParentId = source.parentId ?? "root";

  if (
    !targetId ||
    targetId === source.id ||
    targetParentId !== sourceParentId
  ) {
    return null;
  }

  return targetId;
}

function findScrollContainer(element: Element | null): Element {
  let current = element?.parentElement ?? null;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (
      /(auto|scroll)/.test(overflowY) &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }

  return document.scrollingElement ?? document.documentElement;
}

function scrollNearEdge(clientX: number, clientY: number): void {
  const element = document.elementFromPoint(clientX, clientY);
  const container = findScrollContainer(element);
  const isDocument =
    container === document.scrollingElement || container === document.documentElement;
  const bounds = isDocument
    ? { top: 0, bottom: window.innerHeight }
    : container.getBoundingClientRect();
  const edgeSize = 64;

  if (clientY < bounds.top + edgeSize) {
    container.scrollBy({ top: -12 });
  } else if (clientY > bounds.bottom - edgeSize) {
    container.scrollBy({ top: 12 });
  }
}

export function CategoryMobileDragHandle({
  category,
  disabled,
  isMobile,
  size,
  onDragStart,
  onDragTargetChange,
  onDrop,
  onDragCancel,
}: CategoryMobileDragHandleProps) {
  const enabled = isMobile && !disabled;

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>): void {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragStart(category);
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>): void {
    if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    scrollNearEdge(event.clientX, event.clientY);
    onDragTargetChange(
      findDropTargetId(event.clientX, event.clientY, category),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLSpanElement>): void {
    if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const targetId = findDropTargetId(
      event.clientX,
      event.clientY,
      category,
    );
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (targetId) {
      onDrop(category, targetId);
      return;
    }
    onDragCancel();
  }

  function handlePointerCancel(event: PointerEvent<HTMLSpanElement>): void {
    if (!enabled) return;
    event.stopPropagation();
    onDragCancel();
  }

  return (
    <span
      className="category-mobile-drag-handle -m-2 inline-grid size-10 shrink-0 touch-none select-none place-items-center text-[var(--text-muted)] sm:m-0 sm:size-auto"
      onClick={(event) => {
        if (!isMobile) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      title={`Kéo để sắp xếp ${category.name}`}
    >
      <GripVertical
        size={size}
        aria-label={`Kéo để sắp xếp ${category.name}`}
      />
    </span>
  );
}
