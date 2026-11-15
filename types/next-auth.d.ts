import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    alumnoId?: string;
    accessId?: string;
  }

  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "trainer" | "student";
      alumnoId?: string;
      accessId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "trainer" | "student";
    alumnoId?: string;
    accessId?: string;
  }
}
