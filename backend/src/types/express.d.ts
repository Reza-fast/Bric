import type { UserRole } from "../domain/enums.js";

export interface AuthUserClaims {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` after JWT verification */
      authUser?: AuthUserClaims;
    }
  }
}

export {};
