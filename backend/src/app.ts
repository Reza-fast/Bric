import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { createAppContainer } from "./container.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createApiRouter } from "./routes/api.routes.js";

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  const { controllers } = createAppContainer();
  app.use(
    "/api",
    createApiRouter({
      auth: controllers.auth,
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
