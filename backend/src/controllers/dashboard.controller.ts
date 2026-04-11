import type { Request, Response } from "express";
import type { DashboardService } from "../services/dashboard.service.js";

export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const ref = new Date();
    const payload = await this.dashboard.getDashboardForUser(userId, ref);
    res.json(payload);
  };
}
