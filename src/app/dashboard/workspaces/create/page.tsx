import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { CreateWorkspaceForm } from "@/app/dashboard/workspaces/create/create-workspace-form";
export default async function CreateWorkspacePage() { const session = await getServerSession(authOptions); if (!session?.user?.id) redirect("/sign-in"); return <div className="workspace-settings-page"><div className="workspace-settings-container"><CreateWorkspaceForm/></div></div>; }
