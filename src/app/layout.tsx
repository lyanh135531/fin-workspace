import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./ledger-page.css";
import "./responsive-foundation.css";
import "./overview-desktop.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const initializeAppearance = `
(() => {
  const root = document.documentElement;
  const allowedThemes = ["sunrise", "ocean", "forest", "lavender", "midnight"];
  let theme = "sunrise";
  let mode;

  try {
    const savedTheme = localStorage.getItem("fin-workspace-theme");
    const savedMode = localStorage.getItem("fin-workspace-mode");

    if (allowedThemes.includes(savedTheme)) theme = savedTheme;
    if (savedMode === "light" || savedMode === "dark") mode = savedMode;
    if (localStorage.getItem("fin-sidebar-collapsed") === "true") {
      root.dataset.sidebarCollapsed = "true";
    }
  } catch {}

  mode ??= window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  root.dataset.theme = theme;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
})();
`;

export const metadata: Metadata = {
  title: "Felix",
  applicationName: "Felix",
  description: "Felix — Quản lý tài chính workspace",
  icons: {
    icon: "/felix-logo.svg",
    shortcut: "/felix-logo.svg",
    apple: "/felix-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={geist.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initializeAppearance }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua đến nội dung chính
        </a>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
