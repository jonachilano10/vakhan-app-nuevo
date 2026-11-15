import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { signInClaims } from "@/lib/server-auth";
import { STUDENT_ACCESS_MAX_AGE_SECONDS, verifyAccess } from "@/lib/student-access";
import { studentAccessRepository } from "@/lib/student-access-server";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "acceso",
      name: "Acceso por QR",
      credentials: {
        token: { label: "Token", type: "password" },
      },
      async authorize(credentials) {
        if (typeof credentials?.token !== "string") return null;
        try {
          const verified = await verifyAccess(studentAccessRepository, credentials.token);
          return {
            id: verified.alumnoId,
            name: "Alumno",
            alumnoId: verified.alumnoId,
            accessId: verified.accessId,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        const claims = signInClaims(account?.provider, user);
        token.email = claims.email;
        token.role = claims.role;
        token.alumnoId = claims.alumnoId;
        token.accessId = claims.accessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = typeof token.email === "string" ? token.email : null;
        session.user.role = token.role;
        session.user.alumnoId = token.alumnoId;
        session.user.accessId = token.accessId;
      }
      return session;
    },
  },
  session: {
    maxAge: STUDENT_ACCESS_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
