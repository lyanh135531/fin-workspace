"use client";

import { useState } from "react";
import { setupInitialAdmin } from "@/app/setup/actions";

export default function SetupPage() {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(formData: FormData) {
    try { await setupInitialAdmin({ username: String(formData.get("username")), password: String(formData.get("password")), workspaceName: String(formData.get("workspaceName")) }); window.location.assign("/sign-in"); }
    catch { setMessage("Setup is unavailable or the input is invalid."); }
  }
  return <main className="mx-auto flex min-h-[100dvh] max-w-md items-center p-6"><form action={submit} className="w-full space-y-4"><h1 className="text-3xl font-semibold">Create initial admin</h1><p>This form works only before the first user exists.</p><label className="block">Username<input required name="username" className="mt-1 w-full border p-2" /></label><label className="block">Workspace<input required name="workspaceName" className="mt-1 w-full border p-2" /></label><label className="block">Password<input required minLength={12} name="password" type="password" className="mt-1 w-full border p-2" /></label>{message && <p role="alert">{message}</p>}<button className="bg-zinc-900 px-4 py-2 text-white">Create admin</button></form></main>;
}
