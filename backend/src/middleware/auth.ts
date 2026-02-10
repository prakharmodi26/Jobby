import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthPayload {
  userId: number;
  username: string;
  isDemo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    // Handle old tokens with `email` instead of `username`
    const username = (decoded.username ?? decoded.email) as string;
    const userId = decoded.userId as number;
    const isDemo = (decoded.isDemo as boolean) ?? false;
    req.user = { userId, username, isDemo };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
