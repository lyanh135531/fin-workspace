"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setError(null);
    const result = await signIn("credentials", { username: String(formData.get("username")), password: String(formData.get("password")), redirect: false });
    if (result?.error) return setError("Invalid username or password.");
    window.location.assign("/dashboard");
  }
  return <main className="mx-auto flex min-h-[100dvh] max-w-md items-center p-6"><form action={submit} className="w-full space-y-4"><h1 className="text-3xl font-semibold">Sign in</h1><label className="block">Username<input required name="username" className="mt-1 w-full border p-2" /></label><label className="block">Password<input required name="password" type="password" className="mt-1 w-full border p-2" /></label>{error && <p role="alert">{error}</p>}<button className="bg-zinc-900 px-4 py-2 text-white">Sign in</button></form></main>;
}
