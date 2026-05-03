/**
 * Rate Limiting Middleware
 */

import { Request, Response, NextFunction } from "express";
import { RateLimiter } from "../utils/RateLimiter";

const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_SIGNALS || "10000", 10),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10)
);

export function rateLimitMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!rateLimiter.isAllowed()) {
    res.status(429).json({
      error: "Rate limit exceeded",
      remaining: rateLimiter.getRemainingRequests(),
    });
    return;
  }

  res.locals.rateLimiterMetrics = rateLimiter.getMetrics();
  next();
}

export { rateLimiter };
