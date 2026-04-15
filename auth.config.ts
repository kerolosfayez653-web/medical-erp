import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");
      const isPublicApi = nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname.startsWith("/api/export");
      const isPublicPage = 
        nextUrl.pathname.startsWith("/pay") || 
        nextUrl.pathname.endsWith("/print");

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (isPublicPage || isPublicApi) {
        return true;
      }

      if (!isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
  },
  secret: process.env.AUTH_SECRET, // Explicitly pass secret for production
  providers: [], // Add empty providers list for edge compatibility
} satisfies NextAuthConfig;
