import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
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

const fraunces = Fraunces({
  subsets: ["latin", "vietnamese"],
  weight: "700",
  variable: "--font-fraunces",
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
  metadataBase: new URL("https://felixwise.io.vn"),
  title: {
    default: "Felix | Quản lý tài chính cá nhân và nhóm",
    template: "%s | Felix",
  },
  applicationName: "Felix",
  description:
    "Felix giúp cá nhân, gia đình và nhóm theo dõi thu chi, quản lý ví, giao dịch định kỳ và số dư trong một không gian chung.",
  keywords: [
    "quản lý tài chính cá nhân",
    "quản lý thu chi",
    "sổ thu chi gia đình",
    "quản lý tài chính nhóm",
    "ứng dụng quản lý chi tiêu",
    "Felix",
  ],
  authors: [{ name: "Felix" }],
  creator: "Felix",
  publisher: "Felix",
  category: "finance",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geist.variable} ${fraunces.variable} scroll-smooth scroll-pt-16 sm:scroll-pt-20 motion-reduce:scroll-auto`}
    >
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
