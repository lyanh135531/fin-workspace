import { redirect } from "next/navigation";

export default function LegacyJoinRequestsPage() {
  redirect("/settings/workspace?tab=joinRequests");
}
