import { Request, Response, NextFunction } from "express";

/**
 * Middleware that blocks demo users from accessing write/API-consuming routes.
 * Must be applied AFTER authMiddleware so req.user is available.
 */
export function demoGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.isDemo) {
    res.status(403).json({
      error: "This feature is disabled for demo accounts.",
    });
    return;
  }
  next();
}
