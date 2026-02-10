import dotenv from "dotenv";

// Load .env from project root (CWD) or parent dir when running from backend/
dotenv.config();
dotenv.config({ path: "../.env" });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middleware/auth.js";
import { demoGuard } from "./middleware/demoGuard.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { jobsRouter } from "./routes/jobs.js";
import { profileRouter } from "./routes/profile.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { coverLetterRouter } from "./routes/coverLetter.js";
import { openrouterRouter } from "./routes/openrouter.js";
import { profileAIRouter } from "./routes/profileAI.js";
import { startScheduler } from "./scheduler/cron.js";

const app = express();
const PORT = parseInt(process.env.PORT || "4000");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`
    );
  });
  next();
});

// Public routes
app.use("/api/auth", authRouter);

// Protected routes
app.use("/api/dashboard", authMiddleware, dashboardRouter);
app.use("/api/jobs", authMiddleware, jobsRouter);
app.use("/api/profile", authMiddleware, profileRouter);
app.use("/api/admin", authMiddleware, adminRouter);
app.use("/api/settings", authMiddleware, settingsRouter);
app.use("/api/cover-letter", authMiddleware, demoGuard, coverLetterRouter);
app.use("/api/openrouter", authMiddleware, demoGuard, openrouterRouter);
app.use("/api/profile", authMiddleware, demoGuard, profileAIRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.message });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Backend] Running on http://localhost:${PORT}`);
  startScheduler().catch((err) =>
    console.error("[CRON] Failed to start scheduler:", err)
  );
});
