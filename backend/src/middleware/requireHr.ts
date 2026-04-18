import type { NextFunction, Request, Response } from "express";
import { UserRole } from "../domain/enums.js";

/** Must run after `requireAuth`. */
export function requireHr(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser?.role !== UserRole.Hr) {
    res.status(403).json({ error: "FORBIDDEN", message: "HR role required" });
    return;
  }
  next();
}
