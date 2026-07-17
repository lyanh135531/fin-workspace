import { prisma } from "@/lib/prisma";
import { NotificationsMenu } from "@/app/dashboard/notifications-menu";
export async function WorkspaceNotifications({workspaceId,isAdmin}:{workspaceId:string;isAdmin:boolean}){const items=isAdmin?await prisma.workspaceJoinRequest.findMany({where:{workspaceId,status:"pending"},include:{requester:{select:{username:true}}},orderBy:{createdAt:"desc"},take:10}):[];return isAdmin?<NotificationsMenu items={items.map(x=>({id:x.id,username:x.requester.username}))}/>:null;}
