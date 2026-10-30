import { NotificationsMenu } from "@/app/dashboard/notifications-menu";
import { getWorkspaceNotificationBadgeSummary } from "@/services/workspace-notification-query";

export async function WorkspaceNotifications({
  workspaceId,
  memberId,
  userId,
  currency,
  timeZone,
  isAdmin,
}: {
  workspaceId: string;
  memberId: string;
  userId: string;
  currency: string;
  timeZone: string;
  isAdmin: boolean;
}) {
  const { initialCount, reminderState } =
    await getWorkspaceNotificationBadgeSummary({
      workspaceId,
      memberId,
      userId,
      timeZone,
      isAdmin,
    });

  return (
    <NotificationsMenu
      workspaceId={workspaceId}
      initialCount={initialCount}
      currency={currency}
      canReview={isAdmin}
      reminderState={reminderState}
    />
  );
}
