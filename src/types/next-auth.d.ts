import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "staff" | "artist";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "staff" | "artist";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "staff" | "artist";
  }
}
