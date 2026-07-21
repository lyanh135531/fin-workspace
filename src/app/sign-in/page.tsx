"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setError(null);
    const result = await signIn("credentials", { username: String(formData.get("username")), password: String(formData.get("password")), redirect: false });
    if (result?.error) return setError("Tên đăng nhập hoặc mật khẩu không đúng.");
    window.location.assign("/overview");
  }
  return <main className="auth-shell"><form action={submit} className="sunrise-card auth-card"><div><p className="public-eyebrow">Fin Workspace</p><h1>Đăng nhập</h1><p className="auth-copy">Tiếp tục vào không gian tài chính của bạn.</p></div><label>Tên đăng nhập<input required name="username" autoComplete="username" className="field" /></label><label>Mật khẩu<input required name="password" type="password" autoComplete="current-password" className="field" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button-primary">Đăng nhập</button></form></main>;
}
