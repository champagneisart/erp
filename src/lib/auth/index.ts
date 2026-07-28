import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

function authSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: authSecret(),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [{ db }, { users }, bcrypt, { eq }] = await Promise.all([
          import("@/lib/db"),
          import("@/db/schema"),
          import("bcryptjs"),
          import("drizzle-orm"),
        ]);

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role as "admin" | "staff" | "artist",
        };
      },
    }),
  ],
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
  },
}));
