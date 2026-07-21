"use client";

import { useEffect } from "react";

export function DashboardFooterNotice({ message }: { message: string }) {
  useEffect(() => {
    const target = document.getElementById("dashboard-footer-notice");
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
    return () => {
      target.textContent = "";
      target.hidden = true;
    };
  }, [message]);

  return null;
}
