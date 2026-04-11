import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/jwt.js";
import { config } from "../config.js";

function readBearer(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const t = authHeader.slice(7).trim();
  return t.length > 0 ? t : null;
}

/** Attaches `req.authUser` or responds with 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const fromCookie = req.cookies?.[config.cookieName] as string | undefined;
    const token = fromCookie ?? readBearer(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    try {
      const payload = await verifyAccessToken(token);
      req.authUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      next();
    } catch {
      res.status(401).json({ error: "UNAUTHORIZED" });
    }
  })().catch(next);
}
