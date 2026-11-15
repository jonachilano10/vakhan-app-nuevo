import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

import { isTrainerEmail } from "./lib/auth-roles";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    const isTrainer =
      token?.role === "trainer" || (!token?.role && isTrainerEmail(token?.email));

    if (pathname === "/dashboard") {
      const destination = isTrainer ? "/trainer" : "/student";
      return NextResponse.redirect(new URL(destination, req.url));
    }

    if (pathname.startsWith("/trainer") && !isTrainer) {
      return NextResponse.redirect(new URL("/student", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/auth") || req.nextUrl.pathname === "/acceso") {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/acceso", "/dashboard", "/trainer/:path*", "/student/:path*"],
};
