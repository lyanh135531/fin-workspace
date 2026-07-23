import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InvitationsClient } from "@/app/dashboard/invitations/invitations-client";
export default async function InvitationsPage(){const session=await getServerSession(authOptions);if(!session?.user?.id)redirect("/sign-in");const invitations=await prisma.workspaceInvitation.findMany({where:{inviteeId:session.user.id,status:"pending",workspace:{status:"active",deletedAt:null}},include:{workspace:{select:{name:true}},inviter:{select:{username:true}},role:{select:{name:true}}},orderBy:{createdAt:"desc"}});return <div className="workspace-settings-page"><div className="workspace-settings-container"><header className="settings-hero"><div><p className="settings-eyebrow">Tài khoản</p><h1>Lời mời workspace</h1><p className="settings-hero-copy">Bạn chỉ có quyền hoạt động trong workspace sau khi chấp nhận lời mời.</p></div></header><InvitationsClient invitations={invitations.map(item=>({id:item.id,workspaceName:item.workspace.name,inviter:item.inviter.username,role:item.role.name}))}/></div></div>;}
