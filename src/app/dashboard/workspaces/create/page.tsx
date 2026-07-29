import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { CreateWorkspaceForm } from "@/app/dashboard/workspaces/create/create-workspace-form";
import { PageContainer } from "@/components/base";

export default async function CreateWorkspacePage() { const session = await getServerSession(authOptions); if (!session?.user?.id) redirect("/sign-in"); return <PageContainer className="workspace-settings-page"><div className="workspace-settings-container"><CreateWorkspaceForm/></div></PageContainer>; }
