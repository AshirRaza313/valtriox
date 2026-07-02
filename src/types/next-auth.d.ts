// ============================================================================
// NextAuth Type Augmentation
// ============================================================================
// Phase 8: Properly type NextAuth's User, JWT, and Session interfaces
// instead of using `as any` casts throughout the codebase.
// ============================================================================

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    organizationId?: string;
    organizationName?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: string;
      organizationName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId?: string;
    organizationName?: string;
  }
}
