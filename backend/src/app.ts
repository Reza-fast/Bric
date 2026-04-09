import cors from "cors";
import express from "express";
import { createAppContainer } from "./container.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createApiRouter } from "./routes/api.routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { controllers } = createAppContainer();
  app.use(
    "/api",
    createApiRouter({
      dashboard: controllers.dashboard,
      projects: controllers.projects,
      timeLogs: controllers.timeLogs,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}
