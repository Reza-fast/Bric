import { Router } from "express";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import type { ProjectsController } from "../controllers/projects.controller.js";
import type { TimeLogsController } from "../controllers/timeLogs.controller.js";

export function createApiRouter(deps: {
  dashboard: DashboardController;
  projects: ProjectsController;
  timeLogs: TimeLogsController;
}): Router {
  const r = Router();

  r.get("/dashboard", deps.dashboard.get);

  r.get("/projects", deps.projects.list);
  r.get("/projects/:id", deps.projects.getById);
  r.post("/projects", deps.projects.create);
  r.patch("/projects/:id", deps.projects.update);

  r.post("/time-logs", deps.timeLogs.create);

  return r;
}
