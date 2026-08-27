import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; username: string | null; profileCompleted: boolean };
  }

  interface User {
    username: string | null;
    profileCompleted: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string | null;
    profileCompleted?: boolean;
  }
}
