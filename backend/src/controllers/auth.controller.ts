import type { Request, Response } from "express";
import { z } from "zod";
import { ACCESS_TOKEN_MAX_AGE_MS, accessTokenCookieOptions } from "../auth/cookieOptions.js";
import { signAccessToken } from "../auth/jwt.js";
import { config } from "../config.js";
import { UserRole } from "../domain/index.js";
import { AuthError, type AuthService } from "../services/auth.service.js";
import { ProfileError, type ProfileService } from "../services/profile.service.js";

const registerSchema = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(10).max(200),
    displayName: z.string().min(1).max(200),
    role: z.nativeEnum(UserRole).optional(),
  })
  .refine((d) => d.role !== UserRole.Hr, {
    message: "HR accounts cannot be created via public registration",
    path: ["role"],
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const avatarUrlSchema = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const patchMeSchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
    avatarUrl: avatarUrlSchema,
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: z.string().min(10).max(200).optional(),
  })
  .strict();

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    try {
      const { accessToken, user } = await this.auth.register(parsed.data);
      res.cookie(config.cookieName, accessToken, accessTokenCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
      res.status(201).json({ user });
    } catch (e) {
      if (e instanceof AuthError) {
        if (e.code === "EMAIL_IN_USE") {
          res.status(409).json({ error: e.code });
          return;
        }
        if (e.code === "WEAK_PASSWORD") {
          res.status(400).json({ error: e.code, message: e.message });
          return;
        }
      }
      throw e;
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    try {
      const { accessToken, user } = await this.auth.login(parsed.data.email, parsed.data.password);
      res.cookie(config.cookieName, accessToken, accessTokenCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
      res.json({ user });
    } catch (e) {
      if (e instanceof AuthError && e.code === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
        return;
      }
      throw e;
    }
  };

  logout = (_req: Request, res: Response): void => {
    const opts = accessTokenCookieOptions(0);
    res.clearCookie(config.cookieName, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path ?? "/",
    });
    res.status(204).end();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const id = req.authUser?.id;
    if (!id) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const user = await this.auth.me(id);
    if (!user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    res.json({ user });
  };

  patchMe = async (req: Request, res: Response): Promise<void> => {
    const id = req.authUser?.id;
    if (!id) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const hasProfileFields = body.displayName !== undefined || body.avatarUrl !== undefined;
    const hasPasswordFields = body.newPassword !== undefined || body.currentPassword !== undefined;
    if (!hasProfileFields && !hasPasswordFields) {
      res.status(400).json({ error: "NO_CHANGES" });
      return;
    }
    try {
      const user = await this.profile.updateMe(id, {
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      if (!user) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      res.cookie(config.cookieName, accessToken, accessTokenCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
      res.json({ user });
    } catch (e) {
      if (e instanceof ProfileError) {
        const map: Record<ProfileError["code"], number> = {
          USER_NOT_FOUND: 404,
          NO_PASSWORD_SET: 400,
          INVALID_CURRENT_PASSWORD: 400,
          WEAK_PASSWORD: 400,
          CURRENT_PASSWORD_REQUIRED: 400,
        };
        res.status(map[e.code]).json({ error: e.code, message: e.message });
        return;
      }
      throw e;
    }
  };
}
