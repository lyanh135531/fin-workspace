import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tạo tài khoản",
  robots: { index: false, follow: false },
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
