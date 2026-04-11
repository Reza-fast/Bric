import type { CookieOptions } from "express";
import { config } from "../config.js";

export function accessTokenCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? "strict" : "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

/** ~7 days default */
export const ACCESS_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
