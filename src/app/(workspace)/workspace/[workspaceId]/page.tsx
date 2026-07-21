import { WorkspaceDashboard } from "@/app/dashboard/page";
export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) { return <WorkspaceDashboard targetWorkspaceId={(await params).workspaceId}/>; }
