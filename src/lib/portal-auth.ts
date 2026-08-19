import { isPlatformAdminUsername } from "@/domain/platform-user/schemas";
import { isPortalHostname } from "@/lib/host-routing";

export function isSignInAllowedOnHostname(
  username: string,
  hostname: string,
  configuredUsernames = process.env.PLATFORM_ADMIN_USERNAMES,
) {
  return (
    !isPortalHostname(hostname) ||
    isPlatformAdminUsername(username, configuredUsernames)
  );
}
