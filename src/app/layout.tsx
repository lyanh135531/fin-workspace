import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fin Workspace",
  description: "Workspace financial management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('fin-workspace-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}" }} /></head>
      <body>{children}</body>
    </html>
  );
}
