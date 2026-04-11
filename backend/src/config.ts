import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

/** Comma-separated list, e.g. `http://localhost:3000` */
function parseOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") {
    return ["http://localhost:3000"];
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Dev-only fallback; set JWT_SECRET in production */
const jwtSecretDefault =
  "dev-only-change-me-use-openssl-rand-base64-32-min-chars!!";

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  isProd,
  databaseUrl: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/bric"),
  jwtSecret: required("JWT_SECRET", isProd ? undefined : jwtSecretDefault),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  cookieName: process.env.AUTH_COOKIE_NAME ?? "bric_token",
  corsOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
};
