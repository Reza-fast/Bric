import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthController } from "../controllers/auth.controller.js";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import type { ProjectsController } from "../controllers/projects.controller.js";
import type { TimeLogsController } from "../controllers/timeLogs.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMIT" },
});

export function createApiRouter(deps: {
  auth: AuthController;
  dashboard: DashboardController;
  projects: ProjectsController;
  timeLogs: TimeLogsController;
}): Router {
  const r = Router();

  r.post("/auth/register", authLimiter, deps.auth.register);
  r.post("/auth/login", authLimiter, deps.auth.login);
  r.post("/auth/logout", deps.auth.logout);

  r.use(requireAuth);
  r.get("/auth/me", deps.auth.me);
  r.patch("/auth/me", deps.auth.patchMe);
  r.get("/dashboard", deps.dashboard.get);

  r.get("/projects", deps.projects.list);
  r.get("/projects/:id", deps.projects.getById);
  r.post("/projects", deps.projects.create);
  r.patch("/projects/:id", deps.projects.update);

  r.post("/time-logs", deps.timeLogs.create);

  return r;
}
