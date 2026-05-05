/**
 * API Routes for Signal Ingestion and Incident Management
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Signal, ComponentType, Severity, WorkItemState, WorkItem } from "../types";
import { SignalProcessingService } from "../services/SignalProcessingService";
import { IncidentManagementService } from "../services/IncidentManagementService";
import { buildRandomSignal } from "../utils/randomSignal";

interface SignalPayload {
  componentId: string;
  componentType: ComponentType;
  errorCode: string;
  errorMessage: string;
  severity?: Severity;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  latency?: number;
}

interface RandomSignalRequestBody {
  componentType?: ComponentType;
  severity?: Severity;
}

interface RCARequestBody {
  incidentStartTime: string;
  incidentEndTime: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  createdBy?: string;
}

interface IncidentCreateRequest {
  title: string;
  description: string;
  componentType: ComponentType;
  componentId: string;
  severity: Severity;
  errorCode: string;
  errorMessage: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  latency?: number;
  assignedTo?: string;
}

export function createSignalRoutes(
  signalService: SignalProcessingService,
  incidentService: IncidentManagementService
): Router {
  const router = Router();

  /**
   * POST /api/signals
   * Ingest a single signal
   */
  router.post("/signals", async (req: Request, res: Response) => {
    try {
      const {
        componentId,
        componentType,
        errorCode,
        errorMessage,
        severity,
        metadata,
        stackTrace,
        latency,
      } = req.body;

      if (!componentId || !componentType || !errorCode || !errorMessage) {
        res.status(400).json({
          error:
            "Missing required fields: componentId, componentType, errorCode, errorMessage",
        });
        return;
      }

      const signal: Signal = {
        id: uuidv4(),
        componentId,
        componentType: componentType as ComponentType,
        errorCode,
        errorMessage,
        severity: (severity as Severity) || Severity.P3,
        timestamp: new Date(),
        metadata: metadata || {},
        stackTrace,
        latency,
      };

      await signalService.processSignal(signal);

      res.status(202).json({
        message: "Signal accepted for processing",
        signalId: signal.id,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * POST /api/signals/random
   * Generate and ingest a random signal
   */
  router.post("/signals/random", async (req: Request, res: Response) => {
    try {
      const { componentType, severity } = req.body as RandomSignalRequestBody;

      if (componentType && !Object.values(ComponentType).includes(componentType)) {
        res.status(400).json({ error: "Invalid componentType" });
        return;
      }

      if (severity && !Object.values(Severity).includes(severity)) {
        res.status(400).json({ error: "Invalid severity" });
        return;
      }

      const signal = buildRandomSignal({ componentType, severity });

      await signalService.processSignal(signal);

      res.status(202).json({
        message: "Random signal accepted for processing",
        signal,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * POST /api/signals/cascading-failure
   * Simulate a cascading failure scenario with multiple signals
   * 
   * Cascade Pattern:
   * RDBMS Failure (root) → API Gateway (downstream) → Cache/Queue/NoSQL (secondary impacts)
   */
  router.post("/signals/cascading-failure", async (_req: Request, res: Response) => {
    try {
      const cascadeId = uuidv4(); // Correlation ID for entire cascade
      const cascadeTimestamp = new Date();

      const cascadingSignals: SignalPayload[] = [
        // RDBMS Failure - P0 Critical (ROOT CAUSE)
        {
          componentId: "RDBMS_CLUSTER_01",
          componentType: ComponentType.RDBMS,
          errorCode: "CONNECTION_POOL_EXHAUSTED",
          errorMessage: "All connections in pool exhausted. Database unavailable.",
          severity: Severity.P0,
          metadata: {
            poolSize: 100,
            activeConnections: 100,
            waitingRequests: 5432,
            cascadeId, // Add cascade correlation
            cascadeRole: "root_cause",
            cascadeLevel: 0,
            timestamp: cascadeTimestamp.toISOString(),
          },
          stackTrace: `Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)\n    at Query.execute (db/query.ts:78:9)`,
          latency: 30000,
        },
        // Cascading API failures - P1 (SECONDARY - depends on RDBMS)
        {
          componentId: "API_GATEWAY_01",
          componentType: ComponentType.API,
          errorCode: "DOWNSTREAM_ERROR",
          errorMessage: "Database unavailable - cascading failure detected",
          severity: Severity.P1,
          metadata: {
            downstreamService: "RDBMS_CLUSTER_01",
            errorRate: 0.95,
            averageLatency: 25000,
            cascadeId, // Link to cascade
            cascadeRole: "impacted_service",
            cascadeLevel: 1,
            dependsOn: ["RDBMS_CLUSTER_01"],
            timestamp: cascadeTimestamp.toISOString(),
          },
          latency: 25000,
        },
        // Cache cluster degradation - P2 (TERTIARY - secondary impact)
        {
          componentId: "CACHE_CLUSTER_01",
          componentType: ComponentType.CACHE_CLUSTER,
          errorCode: "HIGH_MEMORY_USAGE",
          errorMessage: "Cache cluster memory usage at 92%",
          severity: Severity.P2,
          metadata: {
            memoryUsagePercent: 92,
            evictionRate: 1200,
            hitRate: 0.45,
            cascadeId,
            cascadeRole: "secondary_impact",
            cascadeLevel: 2,
            dependsOn: ["API_GATEWAY_01"],
            timestamp: cascadeTimestamp.toISOString(),
          },
        },
        // Async Queue backed up - P1 (TERTIARY - secondary impact)
        {
          componentId: "ASYNC_QUEUE_01",
          componentType: ComponentType.ASYNC_QUEUE,
          errorCode: "QUEUE_BACKLOG",
          errorMessage: "Queue backlog exceeds threshold: 50000 jobs pending",
          severity: Severity.P1,
          metadata: {
            pendingJobs: 50000,
            processingRate: 100,
            estimatedClearTime: "8 hours",
            cascadeId,
            cascadeRole: "secondary_impact",
            cascadeLevel: 2,
            dependsOn: ["API_GATEWAY_01", "RDBMS_CLUSTER_01"],
            timestamp: cascadeTimestamp.toISOString(),
          },
        },
        // MCP Host failure - P0 (INDEPENDENT)
        {
          componentId: "MCP_HOST_02",
          componentType: ComponentType.MCP_HOST,
          errorCode: "SERVICE_UNAVAILABLE",
          errorMessage: "MCP Host 02 is down - health checks failing",
          severity: Severity.P0,
          metadata: {
            healthCheckAttempts: 5,
            lastSuccessfulCheck: "2024-01-15T10:25:00Z",
            failureReason: "Connection refused",
            cascadeId,
            cascadeRole: "parallel_incident",
            cascadeLevel: 0,
            timestamp: cascadeTimestamp.toISOString(),
          },
          stackTrace: `Error: connect ECONNREFUSED 192.168.1.52:8080\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:15)`,
        },
        // NoSQL store replication lag - P2 (TERTIARY - secondary impact)
        {
          componentId: "NOSQL_STORE_01",
          componentType: ComponentType.NOSQL_STORE,
          errorCode: "REPLICATION_LAG_HIGH",
          errorMessage: "MongoDB replication lag exceeds acceptable threshold: 5000ms",
          severity: Severity.P2,
          metadata: {
            replicationLagMs: 5000,
            primaryWriteRate: 5000,
            secondaryReadLag: 5200,
            cascadeId,
            cascadeRole: "secondary_impact",
            cascadeLevel: 2,
            dependsOn: ["RDBMS_CLUSTER_01"],
            timestamp: cascadeTimestamp.toISOString(),
          },
        },
      ];

      const signals: Signal[] = cascadingSignals.map((payload: SignalPayload) => ({
        id: uuidv4(),
        componentId: payload.componentId,
        componentType: payload.componentType,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        severity: payload.severity || Severity.P3,
        timestamp: cascadeTimestamp,
        metadata: payload.metadata || {},
        stackTrace: payload.stackTrace,
        latency: payload.latency,
      }));

      for (const signal of signals) {
        await signalService.processSignal(signal);
      }

      res.status(202).json({
        message: "Cascading failure signals accepted for processing",
        count: signals.length,
        cascadeId,
        cascadeStructure: {
          rootCause: "RDBMS_CLUSTER_01 (connection pool exhausted)",
          directImpact: ["API_GATEWAY_01"],
          secondaryImpacts: ["CACHE_CLUSTER_01", "ASYNC_QUEUE_01", "NOSQL_STORE_01"],
          parallelIncidents: ["MCP_HOST_02"],
          estimatedMTTR: "30-60 minutes (depending on RDBMS recovery)",
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/signals/cascade-analysis
   * Analyze and detect cascade patterns in recent signals
   * Helps identify when cascading failures have occurred
   */
  router.get("/signals/cascade-analysis", async (_req: Request, res: Response) => {
    try {
      // Get all work items to analyze cascade relationships
      const allWorkItems = await incidentService.getAllIncidents();

      // Group incidents by cascade patterns
      const cascadePatterns: Record<string, any> = {};
      const rootCauses: string[] = [];

      // Identify P0 incidents (likely root causes)
      const criticalIncidents = allWorkItems.filter(
        (wi: WorkItem) => wi.severity === Severity.P0
      );

      criticalIncidents.forEach((critical: WorkItem) => {
        rootCauses.push(critical.componentId);

        // Find incidents created shortly after critical incident
        const timeWindow = 60000; // 1 minute
        const relatedIncidents = allWorkItems.filter(
          (wi: WorkItem) =>
            wi.componentId !== critical.componentId &&
            wi.severity !== Severity.P0 &&
            Math.abs(
              wi.createdAt.getTime() - critical.createdAt.getTime()
            ) <= timeWindow
        );

        cascadePatterns[critical.componentId] = {
          rootCause: critical.componentId,
          severity: critical.severity,
          createdAt: critical.createdAt,
          relatedIncidents: relatedIncidents.map((wi: WorkItem) => ({
            componentId: wi.componentId,
            severity: wi.severity,
            title: wi.title,
          })),
          cascadeDetected: relatedIncidents.length > 0,
          estimatedBlastRadius: relatedIncidents.length,
        };
      });

      res.status(200).json({
        cascadeAnalysis: {
          analysisTime: new Date(),
          totalIncidents: allWorkItems.length,
          criticalIncidents: criticalIncidents.length,
          cascadeDetected: rootCauses.length > 0,
          patterns: cascadePatterns,
          rootCauses,
          recommendation:
            rootCauses.length > 0
              ? `Focus on resolving: ${rootCauses.join(", ")} to mitigate cascade effects`
              : "No cascade patterns detected",
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * POST /api/signals/batch
   * Ingest multiple signals
   */
  router.post("/signals/batch", async (req: Request, res: Response) => {
    try {
      const { signals: signalPayloads } = req.body as { signals?: SignalPayload[] };

      if (!Array.isArray(signalPayloads)) {
        res.status(400).json({ error: "signals must be an array" });
        return;
      }

      const signals: Signal[] = signalPayloads.map((payload: SignalPayload) => ({
        id: uuidv4(),
        componentId: payload.componentId,
        componentType: payload.componentType,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        severity: payload.severity || Severity.P3,
        timestamp: new Date(),
        metadata: payload.metadata || {},
        stackTrace: payload.stackTrace,
        latency: payload.latency,
      }));

      for (const signal of signals) {
        await signalService.processSignal(signal);
      }

      res.status(202).json({
        message: "Signals accepted for processing",
        count: signals.length,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * POST /api/incidents
   * Create a new incident manually
   */
  router.post("/incidents", async (req: Request, res: Response) => {
    try {
      const {
        title,
        description,
        componentType,
        componentId,
        severity,
        errorCode,
        errorMessage,
        metadata,
        stackTrace,
        latency,
        assignedTo,
      } = req.body as IncidentCreateRequest;

      if (
        !title ||
        !description ||
        !componentType ||
        !componentId ||
        !severity ||
        !errorCode ||
        !errorMessage
      ) {
        res.status(400).json({
          error:
            "Missing required fields: title, description, componentType, componentId, severity, errorCode, errorMessage",
        });
        return;
      }

      const signalId = uuidv4();
      const now = new Date();
      const initialSignal: Signal = {
        id: signalId,
        componentId,
        componentType,
        errorCode,
        errorMessage,
        severity,
        timestamp: now,
        metadata: metadata || {},
        stackTrace,
        latency,
      };

      const newIncident = await incidentService.createIncident({
        title,
        description,
        componentType,
        componentId,
        severity,
        assignedTo,
        initialSignalId: signalId,
        initialSignalTime: now,
      });

      await signalService.processSignal(initialSignal);

      res.status(201).json(newIncident);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  router.get("/incidents", async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      
      let incidents: WorkItem[];
      if (status && typeof status === 'string') {
        // Get incidents by specific status
        incidents = await incidentService.getWorkItemsByStatus(status as WorkItemState);
      } else {
        // Get all incidents including closed ones
        incidents = await incidentService.getAllIncidents();
      }
      
      res.json({
        data: incidents,
        total: incidents.length,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/incidents/:id
   * Get incident details
   */
  router.get("/incidents/:id", async (req: Request, res: Response) => {
    try {
      const workItem = await incidentService.getWorkItem(req.params.id);
      if (!workItem) {
        res.status(404).json({ error: "Incident not found" });
        return;
      }
      res.json(workItem);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/incidents/:id/signals
   * Get raw signals linked to incident
   */
  router.get("/incidents/:id/signals", async (req: Request, res: Response) => {
    try {
      const workItem = await incidentService.getWorkItem(req.params.id);
      if (!workItem) {
        res.status(404).json({ error: "Incident not found" });
        return;
      }

      const signals = await signalService.getSignalsForWorkItem(workItem.signalIds);
      res.json({
        data: signals,
        total: signals.length,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * PUT /api/incidents/:id/status
   * Update incident status
   */
  router.put("/incidents/:id/status", async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ error: "status is required" });
        return;
      }

      await incidentService.transitionWorkItemState(req.params.id, status);
      const updated = await incidentService.getWorkItem(req.params.id);
      res.json(updated);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid state transition",
      });
    }
  });

  /**
   * POST /api/incidents/:id/rca
   * Submit RCA for incident
   */
  router.post("/incidents/:id/rca", async (req: Request, res: Response) => {
    try {
      const workItemId = req.params.id;
      const {
        incidentStartTime,
        incidentEndTime,
        rootCauseCategory,
        fixApplied,
        preventionSteps,
        createdBy,
      } = req.body as RCARequestBody;

      // Validate work item ID format
      if (!workItemId || workItemId.trim() === '') {
        res.status(400).json({
          error: "Invalid incident ID",
        });
        return;
      }

      // Validate all required fields are present and not empty
      if (
        !incidentStartTime ||
        !incidentEndTime ||
        !rootCauseCategory ||
        !fixApplied ||
        !preventionSteps
      ) {
        res.status(400).json({
          error:
            "Missing required RCA fields: incidentStartTime, incidentEndTime, rootCauseCategory, fixApplied, preventionSteps",
        });
        return;
      }

      // Validate that values are not just whitespace
      if (typeof fixApplied !== 'string' || fixApplied.trim() === '' ||
          typeof preventionSteps !== 'string' || preventionSteps.trim() === '') {
        res.status(400).json({
          error: "fixApplied and preventionSteps must be non-empty text",
        });
        return;
      }

      // Parse and validate dates
      let startDateObj: Date;
      let endDateObj: Date;
      try {
        startDateObj = new Date(incidentStartTime);
        endDateObj = new Date(incidentEndTime);
        
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
          throw new Error('Invalid date format');
        }
      } catch (err) {
        res.status(400).json({
          error: "Invalid date format. Please use ISO 8601 format.",
        });
        return;
      }

      // Validate that end time is after start time
      if (endDateObj <= startDateObj) {
        res.status(400).json({
          error: "Incident end time must be after start time",
        });
        return;
      }

      // RCA can only be submitted once incident is resolved
      const workItem = await incidentService.getWorkItem(workItemId);
      if (!workItem) {
        res.status(404).json({
          error: "Incident not found",
        });
        return;
      }

      if (workItem.status !== WorkItemState.RESOLVED) {
        res.status(400).json({
          error: `Incident must be in RESOLVED state before RCA submission. Current state: ${workItem.status}`,
        });
        return;
      }

      const rca = await incidentService.submitRCA(workItemId, {
        incidentStartTime: startDateObj,
        incidentEndTime: endDateObj,
        rootCauseCategory,
        fixApplied: fixApplied.trim(),
        preventionSteps: preventionSteps.trim(),
        createdBy: createdBy || "system",
        workItemId: workItemId,
        mttr: Math.floor((endDateObj.getTime() - startDateObj.getTime()) / 1000),
      });

      // Auto-transition to CLOSED after RCA submission
      await incidentService.transitionWorkItemState(
        workItemId,
        WorkItemState.CLOSED
      );

      res.status(201).json({
        message: "RCA submitted successfully",
        rca,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "RCA submission failed";
      res.status(400).json({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/health
   * Health check endpoint
   */
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date(),
      uptime: process.uptime(),
      rateLimiter: res.locals.rateLimiterMetrics,
    });
  });

  return router;
}
