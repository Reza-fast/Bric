import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthController } from "../controllers/auth.controller.js";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import type { ProjectsController } from "../controllers/projects.controller.js";
import type { PlannedTasksController } from "../controllers/plannedTasks.controller.js";
import { ReportsController } from "../controllers/reports.controller.js";
import type { TeamController } from "../controllers/team.controller.js";
import type { TimeLogsController } from "../controllers/timeLogs.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireHr } from "../middleware/requireHr.js";

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
  plannedTasks: PlannedTasksController;
  timeLogs: TimeLogsController;
  reports: ReportsController;
  team: TeamController;
}): Router {
  const r = Router();
  // auth routes
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

  r.get("/projects/:projectId/planned-tasks", deps.plannedTasks.list);
  r.post("/projects/:projectId/planned-tasks", deps.plannedTasks.create);
  r.patch("/projects/:projectId/planned-tasks/:taskId", deps.plannedTasks.update);
  r.delete("/projects/:projectId/planned-tasks/:taskId", deps.plannedTasks.remove);

  r.get("/time-logs", deps.timeLogs.list);
  r.delete("/time-logs/:id", deps.timeLogs.delete);
  r.post("/time-logs", deps.timeLogs.create);
  r.get("/team", requireHr, deps.team.list);
  r.post("/team/invite", requireHr, deps.team.invite);

  r.get("/projects/:projectId/reports", deps.reports.list);
  r.post("/projects/:projectId/reports", deps.reports.createDigital);
  r.post(
    "/projects/:projectId/reports/upload",
    ReportsController.uploadAttachmentMiddleware,
    deps.reports.uploadFile,
  );
  r.patch("/projects/:projectId/reports/:reportId", deps.reports.patch);
  r.patch(
    "/projects/:projectId/reports/:reportId/attachment",
    ReportsController.uploadAttachmentMiddleware,
    deps.reports.replaceAttachment,
  );
  //post 
  r.post(
    "/projects/:projectId/reports/:reportId/photos",
    ReportsController.uploadPhotosMiddleware,
    deps.reports.uploadPhotos,
  );
  r.delete("/projects/:projectId/reports/:reportId/photos/:photoId", deps.reports.deletePhoto);
  r.get("/projects/:projectId/reports/:reportId/photos/:photoId/file", deps.reports.downloadPhoto);
  r.get("/projects/:projectId/reports/:reportId/file", deps.reports.downloadFile);
  r.get("/projects/:projectId/reports/:reportId/pdf", deps.reports.downloadFile);

  return r;
}
