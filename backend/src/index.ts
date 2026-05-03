/**
 * Main Application Entry Point
 */

import "dotenv/config";
import path from "path";
import express, { Express } from "express";
import cors from "cors";
import { DataLakeStore } from "./storage/DataLakeStore";
import { SourceOfTruthStore } from "./storage/SourceOfTruthStore";
import { CacheStore } from "./storage/CacheStore";
import { SignalProcessingService } from "./services/SignalProcessingService";
import { IncidentManagementService } from "./services/IncidentManagementService";
import { rateLimitMiddleware } from "./middleware/rateLimitMiddleware";
import { createSignalRoutes } from "./routes/signals";
import { Logger } from "./utils/Logger";

class IMSApplication {
  private app: Express;
  private logger: Logger;
  private dataLakeStore: DataLakeStore;
  private sourceOfTruthStore: SourceOfTruthStore;
  private cacheStore: CacheStore;
  private signalService: SignalProcessingService;
  private incidentService: IncidentManagementService;

  constructor() {
    this.app = express();
    this.logger = new Logger("info");
    this.dataLakeStore = new DataLakeStore();
    this.sourceOfTruthStore = new SourceOfTruthStore();
    this.cacheStore = new CacheStore();
    this.signalService = new SignalProcessingService(
      this.dataLakeStore,
      this.sourceOfTruthStore,
      this.cacheStore
    );
    this.incidentService = new IncidentManagementService(
      this.sourceOfTruthStore,
      this.cacheStore
    );
  }

  private async initializeStorage(): Promise<void> {
    this.logger.info("🚀 Initializing storage layers...");

    // Connect to MongoDB (Data Lake)
    await this.dataLakeStore.connect(
      process.env.MONGO_URL || "mongodb://localhost:27017/ims"
    );

    // Connect to Redis (Cache)
    await this.cacheStore.connect(
      process.env.REDIS_URL || "redis://localhost:6379"
    );

    // Connect to PostgreSQL (Source of Truth)
    await this.sourceOfTruthStore.connect({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "ims",
    });

    this.logger.info("✅ All storage layers initialized");
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cors());
    this.app.use(rateLimitMiddleware);
  }

  private setupRoutes(): void {
    const signalRoutes = createSignalRoutes(
      this.signalService,
      this.incidentService
    );
    this.app.use("/api", signalRoutes);

    const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

    // Frontend serving
    this.app.use(express.static(frontendDistPath));

    // Catch-all for SPA routes, but preserve API error behavior
    this.app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "API route not found" });
        return;
      }
      res.sendFile("index.html", { root: frontendDistPath });
    });
  }

  async start(): Promise<void> {
    try {
      await this.initializeStorage();
      this.setupMiddleware();
      this.setupRoutes();

      const PORT = parseInt(process.env.PORT || "3001", 10);
      this.app.listen(PORT, () => {
        this.logger.info(`🎯 IMS Server running on http://localhost:${PORT}`);
        this.logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
        this.logger.info(`🎬 Ready to process signals!`);
      });
    } catch (error) {
      this.logger.error("Failed to start server", error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down...");
    await this.dataLakeStore.disconnect();
    await this.cacheStore.disconnect();
    await this.sourceOfTruthStore.disconnect();
    this.logger.info("Goodbye!");
  }
}

// Start the application
const ims = new IMSApplication();
ims.start();

// Graceful shutdown
process.on("SIGTERM", () => ims.shutdown());
process.on("SIGINT", () => ims.shutdown());
