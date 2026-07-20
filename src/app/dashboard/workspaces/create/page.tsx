import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { CreateWorkspaceForm } from "@/app/dashboard/workspaces/create/create-workspace-form";
export default async function CreateWorkspacePage() { const session = await getServerSession(authOptions); if (!session?.user?.id) redirect("/sign-in"); return <div className="mx-auto max-w-4xl"><a href="/dashboard" className="settings-back">← Quay lại sổ thu chi</a><div className="mt-6"><CreateWorkspaceForm/></div></div>; }
