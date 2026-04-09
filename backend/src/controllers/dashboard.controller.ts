import type { Request, Response } from "express";
import type { DashboardService } from "../services/dashboard.service.js";

export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    const ref = new Date();
    const payload = await this.dashboard.getDashboard(ref);
    res.json(payload);
  };
}
