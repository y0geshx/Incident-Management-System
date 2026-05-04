/**
 * Health Check Service
 * Monitors the status of all critical services
 */

import { DataLakeStore } from "../storage/DataLakeStore";
import { SourceOfTruthStore } from "../storage/SourceOfTruthStore";
import { CacheStore } from "../storage/CacheStore";
import { Logger } from "../utils/Logger";

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  details?: string;
  lastChecked: string;
}

export interface SystemStatus {
  status: "operational" | "degraded" | "down";
  timestamp: string;
  services: ServiceStatus[];
  uptime: number;
}

export class HealthCheckService {
  private logger: Logger;
  private startTime: number;

  constructor(
    private dataLakeStore: DataLakeStore,
    private sourceOfTruthStore: SourceOfTruthStore,
    private cacheStore: CacheStore
  ) {
    this.logger = new Logger("info");
    this.startTime = Date.now();
  }

  async checkAllServices(): Promise<SystemStatus> {
    const services: ServiceStatus[] = [];

    // Check PostgreSQL (Source of Truth)
    services.push(await this.checkPostgreSQL());

    // Check MongoDB (Data Lake)
    services.push(await this.checkMongoDB());

    // Check Redis (Cache)
    services.push(await this.checkRedis());

    // Check Backend API (implicit - if we're running this, API is up)
    services.push(this.checkBackendAPI());

    // Determine overall system status
    const unhealthyCount = services.filter(
      (s) => s.status === "unhealthy"
    ).length;
    const degradedCount = services.filter(
      (s) => s.status === "degraded"
    ).length;

    let systemStatus: "operational" | "degraded" | "down" = "operational";
    if (unhealthyCount > 0) {
      systemStatus = unhealthyCount > services.length / 2 ? "down" : "degraded";
    } else if (degradedCount > 0) {
      systemStatus = "degraded";
    }

    return {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      services,
      uptime: Date.now() - this.startTime,
    };
  }

  private async checkPostgreSQL(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const result = await this.sourceOfTruthStore.healthCheck?.();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          name: "PostgreSQL (Source of Truth)",
          status: "healthy",
          responseTime,
          details: "Database connection is active",
          lastChecked: new Date().toISOString(),
        };
      } else {
        throw new Error("Health check returned false");
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`PostgreSQL health check failed: ${error}`);
      return {
        name: "PostgreSQL (Source of Truth)",
        status: "unhealthy",
        responseTime,
        details: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkMongoDB(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const result = await this.dataLakeStore.healthCheck?.();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          name: "MongoDB (Data Lake)",
          status: "healthy",
          responseTime,
          details: "Database connection is active",
          lastChecked: new Date().toISOString(),
        };
      } else {
        throw new Error("Health check returned false");
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`MongoDB health check failed: ${error}`);
      return {
        name: "MongoDB (Data Lake)",
        status: "unhealthy",
        responseTime,
        details: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const result = await this.cacheStore.healthCheck?.();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          name: "Redis (Cache)",
          status: "healthy",
          responseTime,
          details: "Cache connection is active",
          lastChecked: new Date().toISOString(),
        };
      } else {
        throw new Error("Health check returned false");
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`Redis health check failed: ${error}`);
      return {
        name: "Redis (Cache)",
        status: "unhealthy",
        responseTime,
        details: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private checkBackendAPI(): ServiceStatus {
    return {
      name: "Backend API",
      status: "healthy",
      responseTime: 0,
      details: "API server is running",
      lastChecked: new Date().toISOString(),
    };
  }
}
