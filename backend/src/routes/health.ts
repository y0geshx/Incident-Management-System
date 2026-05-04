/**
 * Health Check Routes
 * Provides endpoints for service status monitoring
 */

import { Router, Request, Response } from "express";
import { HealthCheckService } from "../services/HealthCheckService";
import { DataLakeStore } from "../storage/DataLakeStore";
import { SourceOfTruthStore } from "../storage/SourceOfTruthStore";
import { CacheStore } from "../storage/CacheStore";

export function createHealthRoutes(
  dataLakeStore: DataLakeStore,
  sourceOfTruthStore: SourceOfTruthStore,
  cacheStore: CacheStore
): Router {
  const router = Router();
  const healthCheckService = new HealthCheckService(
    dataLakeStore,
    sourceOfTruthStore,
    cacheStore
  );

  /**
   * GET /api/health
   * Get the status of all services
   */
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const systemStatus = await healthCheckService.checkAllServices();
      const statusCode = systemStatus.status === "operational" ? 200 : 503;
      res.status(statusCode).json(systemStatus);
    } catch (error) {
      res.status(503).json({
        status: "down",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/health/quick
   * Quick health check (just check if API is running)
   */
  router.get("/health/quick", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      message: "API is operational",
    });
  });

  return router;
}
