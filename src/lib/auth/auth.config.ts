import type { NextAuthConfig } from "next-auth";

/** Edge-safe Auth.js config (middleware). Geen DB/bcrypt hier. */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "staff" | "artist";
      }
      return session;
    },
    authorized() {
      // Route-bescherming gebeurt in middleware.ts
      return true;
    },
  },
} satisfies NextAuthConfig;
