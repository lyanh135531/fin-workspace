"use client";

import { useEffect, useState } from "react";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

export function FooterClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Initial render after mount (avoids hydration mismatch)
    setTime(formatTime(new Date()));
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <time className="footer-clock" dateTime={new Date().toISOString()} aria-label={`Giờ hiện tại: ${time} ICT`}>
      {time}
    </time>
  );
}
