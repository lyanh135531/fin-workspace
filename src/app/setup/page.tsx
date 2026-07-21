"use client";

import { useState } from "react";
import { setupInitialAdmin } from "@/app/setup/actions";

export default function SetupPage() {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(formData: FormData) {
    try { await setupInitialAdmin({ username: String(formData.get("username")), password: String(formData.get("password")), workspaceName: String(formData.get("workspaceName")) }); window.location.assign("/sign-in"); }
    catch { setMessage("Không thể khởi tạo hệ thống hoặc thông tin chưa hợp lệ."); }
  }
  return <main className="auth-shell"><form action={submit} className="sunrise-card auth-card"><div><p className="public-eyebrow">Khởi tạo hệ thống</p><h1>Tạo quản trị viên đầu tiên</h1><p className="auth-copy">Biểu mẫu chỉ hoạt động khi hệ thống chưa có tài khoản.</p></div><label>Tên đăng nhập<input required name="username" autoComplete="username" className="field" /></label><label>Tên workspace<input required name="workspaceName" className="field" /></label><label>Mật khẩu<input required minLength={12} name="password" type="password" autoComplete="new-password" className="field" /><small>Tối thiểu 12 ký tự.</small></label>{message && <p className="auth-error" role="alert">{message}</p>}<button className="button-primary">Tạo quản trị viên</button></form></main>;
}
