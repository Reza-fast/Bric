import type { Request, Response } from "express";
import { z } from "zod";
import { UserRole } from "../domain/index.js";
import type { TeamService } from "../services/team.service.js";

const inviteSchema = z.object({
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(200),
  role: z.nativeEnum(UserRole),
  functionTitle: z.string().trim().max(200).optional().nullable(),
  projectIds: z.array(z.string().uuid()).min(1).max(30),
});

export class TeamController {
  constructor(private readonly team: TeamService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.authUser?.id) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const members = await this.team.listOrgDirectory();
    res.json({ members });
  };

  invite = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    try {
      const invited = await this.team.inviteForUser({
        inviterUserId: userId,
        email: b.email,
        displayName: b.displayName,
        role: b.role,
        functionTitle: b.functionTitle ?? null,
        projectIds: b.projectIds,
      });
      if (!invited) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(201).json({ member: invited.member, temporaryPassword: invited.temporaryPassword });
    } catch (e) {
      if (e instanceof Error && e.message === "HR_INVITE_NOT_ALLOWED") {
        res.status(400).json({ error: "HR_INVITE_NOT_ALLOWED", message: "Creating HR accounts is not allowed from this form." });
        return;
      }
      throw e;
    }
  };
}
