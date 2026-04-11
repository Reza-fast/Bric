import * as jose from "jose";
import { config } from "../config.js";
import { UserRole } from "../domain/enums.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

function parseRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return Object.values(UserRole).includes(value as UserRole) ? (value as UserRole) : null;
}

function secretKey(): Uint8Array {
  const s = config.jwtSecret;
  if (s.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(s);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new jose.SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jose.jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : "";
  const role = parseRole(payload.role);
  if (!sub || !email || !role) {
    throw new Error("INVALID_TOKEN");
  }
  return { sub, email, role };
}
