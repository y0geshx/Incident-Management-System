/**
 * API Routes for Signal Ingestion and Incident Management
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Signal, ComponentType, Severity, WorkItemState, WorkItem } from "../types";
import { SignalProcessingService } from "../services/SignalProcessingService";
import { IncidentManagementService } from "../services/IncidentManagementService";

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

interface RCARequestBody {
  incidentStartTime: string;
  incidentEndTime: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  createdBy?: string;
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
   * GET /api/incidents
   * Get all incidents (or filter by status)
   */
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
