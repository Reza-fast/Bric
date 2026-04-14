import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "FILE_TOO_LARGE" });
      return;
    }
  }
  console.error(err);
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  res.status(Number.isFinite(status) ? status : 500).json({
    error: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "development" ? String(err) : undefined,
  });
};
