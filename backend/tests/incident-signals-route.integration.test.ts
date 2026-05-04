import express from "express";
import request from "supertest";
import { createSignalRoutes } from "../src/routes/signals";
import { Signal, WorkItemState, Severity, ComponentType, WorkItem } from "../src/types";

describe("GET /api/incidents/:id/signals", () => {
  const makeWorkItem = (id: string): WorkItem => ({
    id,
    componentId: "API_GATEWAY_01",
    componentType: ComponentType.API,
    status: WorkItemState.OPEN,
    severity: Severity.P1,
    title: "Incident: API_GATEWAY_01",
    description: "Multiple signals detected",
    signalIds: ["sig-1", "sig-2"],
    signalCount: 2,
    firstSignalTime: new Date("2026-01-01T10:00:00Z"),
    lastSignalTime: new Date("2026-01-01T10:05:00Z"),
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:05:00Z"),
  });

  const makeSignals = (): Signal[] => [
    {
      id: "sig-1",
      componentId: "API_GATEWAY_01",
      componentType: ComponentType.API,
      errorCode: "E_TIMEOUT",
      errorMessage: "Timeout",
      severity: Severity.P1,
      timestamp: new Date("2026-01-01T10:00:00Z"),
      metadata: {},
    },
    {
      id: "sig-2",
      componentId: "API_GATEWAY_01",
      componentType: ComponentType.API,
      errorCode: "E_CONN",
      errorMessage: "Connection failed",
      severity: Severity.P1,
      timestamp: new Date("2026-01-01T10:01:00Z"),
      metadata: {},
    },
  ];

  test("returns linked signals for an existing incident", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn().mockResolvedValue(makeSignals()),
    };
    const incidentService = {
      getWorkItem: jest.fn().mockResolvedValue(makeWorkItem("inc-1")),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app).get("/api/incidents/inc-1/signals");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.data[0]).toMatchObject({ id: "sig-1", errorCode: "E_TIMEOUT" });
    expect(incidentService.getWorkItem).toHaveBeenCalledWith("inc-1");
    expect(signalService.getSignalsForWorkItem).toHaveBeenCalledWith(["sig-1", "sig-2"]);
  });

  test("returns 404 when incident is not found", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      getWorkItem: jest.fn().mockResolvedValue(null),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app).get("/api/incidents/missing/signals");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Incident not found");
    expect(signalService.getSignalsForWorkItem).not.toHaveBeenCalled();
  });
});

describe("POST /api/incidents/:id/rca state gating", () => {
  const makeWorkItem = (id: string, status: WorkItemState): WorkItem => ({
    id,
    componentId: "API_GATEWAY_01",
    componentType: ComponentType.API,
    status,
    severity: Severity.P1,
    title: "Incident: API_GATEWAY_01",
    description: "Multiple signals detected",
    signalIds: ["sig-1"],
    signalCount: 1,
    firstSignalTime: new Date("2026-01-01T10:00:00Z"),
    lastSignalTime: new Date("2026-01-01T10:05:00Z"),
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:05:00Z"),
  });

  test("rejects RCA submission when incident is OPEN", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      getWorkItem: jest.fn().mockResolvedValue(makeWorkItem("inc-open", WorkItemState.OPEN)),
      submitRCA: jest.fn(),
      transitionWorkItemState: jest.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app)
      .post("/api/incidents/inc-open/rca")
      .send({
        incidentStartTime: "2026-01-01T10:00:00Z",
        incidentEndTime: "2026-01-01T10:30:00Z",
        rootCauseCategory: "Service Crash",
        fixApplied: "Restarted service",
        preventionSteps: "Add monitoring",
        createdBy: "test-user",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Incident must be in RESOLVED state");
    expect(response.body.error).toContain("OPEN");
    expect(incidentService.submitRCA).not.toHaveBeenCalled();
    expect(incidentService.transitionWorkItemState).not.toHaveBeenCalled();
  });

  test("accepts RCA submission when incident is RESOLVED and transitions to CLOSED", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      getWorkItem: jest.fn().mockResolvedValue(makeWorkItem("inc-resolved", WorkItemState.RESOLVED)),
      submitRCA: jest.fn().mockResolvedValue({
        id: "rca-1",
        workItemId: "inc-resolved",
        incidentStartTime: new Date("2026-01-01T10:00:00Z"),
        incidentEndTime: new Date("2026-01-01T10:30:00Z"),
        rootCauseCategory: "Service Crash",
        fixApplied: "Restarted service",
        preventionSteps: "Add monitoring",
        mttr: 1800,
        createdAt: new Date("2026-01-01T10:31:00Z"),
        createdBy: "test-user",
      }),
      transitionWorkItemState: jest.fn().mockResolvedValue(undefined),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app)
      .post("/api/incidents/inc-resolved/rca")
      .send({
        incidentStartTime: "2026-01-01T10:00:00Z",
        incidentEndTime: "2026-01-01T10:30:00Z",
        rootCauseCategory: "Service Crash",
        fixApplied: "Restarted service",
        preventionSteps: "Add monitoring",
        createdBy: "test-user",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("RCA submitted successfully");
    expect(incidentService.submitRCA).toHaveBeenCalledTimes(1);
    expect(incidentService.transitionWorkItemState).toHaveBeenCalledWith(
      "inc-resolved",
      WorkItemState.CLOSED
    );
  });
});

describe("POST /api/incidents", () => {
  test("creates a new incident and returns 201", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
      processSignal: jest.fn().mockResolvedValue(undefined),
    };

    const incidentService = {
      createIncident: jest.fn().mockResolvedValue({
        id: "inc-new",
        componentId: "WEB_FRONTEND_01",
        componentType: ComponentType.API,
        status: WorkItemState.OPEN,
        severity: Severity.P2,
        title: "New incident created",
        description: "A manually created incident",
        signalIds: ["sig-1"],
        signalCount: 1,
        firstSignalTime: new Date("2026-05-04T12:00:00Z"),
        lastSignalTime: new Date("2026-05-04T12:00:00Z"),
        createdAt: new Date("2026-05-04T12:00:00Z"),
        updatedAt: new Date("2026-05-04T12:00:00Z"),
      }),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app)
      .post("/api/incidents")
      .send({
        title: "New incident created",
        description: "A manually created incident",
        componentType: ComponentType.API,
        componentId: "WEB_FRONTEND_01",
        severity: Severity.P2,
        errorCode: "CONNECTION_POOL_EXHAUSTED",
        errorMessage: "All connections in pool exhausted. Database unavailable.",
        metadata: {
          poolSize: 100,
          activeConnections: 100,
          waitingRequests: 5432,
        },
        stackTrace: "Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)",
        latency: 30000,
        assignedTo: "ops-team",
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("inc-new");
    expect(incidentService.createIncident).toHaveBeenCalledWith({
      title: "New incident created",
      description: "A manually created incident",
      componentType: ComponentType.API,
      componentId: "WEB_FRONTEND_01",
      severity: Severity.P2,
      assignedTo: "ops-team",
      initialSignalId: expect.any(String),
      initialSignalTime: expect.any(Date),
    });
    expect(signalService.processSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: "WEB_FRONTEND_01",
        componentType: ComponentType.API,
        errorCode: "CONNECTION_POOL_EXHAUSTED",
        errorMessage: "All connections in pool exhausted. Database unavailable.",
        severity: Severity.P2,
        metadata: {
          poolSize: 100,
          activeConnections: 100,
          waitingRequests: 5432,
        },
        stackTrace: "Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)",
        latency: 30000,
      })
    );
  });

  test("returns 400 when required fields are missing", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      createIncident: jest.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(
        signalService as any,
        incidentService as any
      )
    );

    const response = await request(app)
      .post("/api/incidents")
      .send({
        title: "",
        description: "",
        componentType: ComponentType.API,
        componentId: "",
        severity: "P1",
        errorCode: "",
        errorMessage: "",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Missing required fields");
    expect(incidentService.createIncident).not.toHaveBeenCalled();
  });
});

describe("PUT /api/incidents/:id/status workflow", () => {
  const makeWorkItem = (id: string, status: WorkItemState): WorkItem => ({
    id,
    componentId: "API_GATEWAY_01",
    componentType: ComponentType.API,
    status,
    severity: Severity.P1,
    title: "Incident: API_GATEWAY_01",
    description: "Multiple signals detected",
    signalIds: ["sig-1"],
    signalCount: 1,
    firstSignalTime: new Date("2026-01-01T10:00:00Z"),
    lastSignalTime: new Date("2026-01-01T10:05:00Z"),
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:05:00Z"),
  });

  test("supports OPEN -> INVESTIGATING -> RESOLVED transitions", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };

    const stateById: Record<string, WorkItemState> = {
      "inc-flow": WorkItemState.OPEN,
    };

    const incidentService = {
      transitionWorkItemState: jest
        .fn()
        .mockImplementation(async (id: string, newState: WorkItemState) => {
          stateById[id] = newState;
        }),
      getWorkItem: jest
        .fn()
        .mockImplementation(async (id: string) => makeWorkItem(id, stateById[id])),
    };

    const app = express();
    app.use(express.json());
    app.use("/api", createSignalRoutes(signalService as any, incidentService as any));

    const response1 = await request(app)
      .put("/api/incidents/inc-flow/status")
      .send({ status: WorkItemState.INVESTIGATING });

    expect(response1.status).toBe(200);
    expect(response1.body.status).toBe(WorkItemState.INVESTIGATING);

    const response2 = await request(app)
      .put("/api/incidents/inc-flow/status")
      .send({ status: WorkItemState.RESOLVED });

    expect(response2.status).toBe(200);
    expect(response2.body.status).toBe(WorkItemState.RESOLVED);
    expect(incidentService.transitionWorkItemState).toHaveBeenNthCalledWith(
      1,
      "inc-flow",
      WorkItemState.INVESTIGATING
    );
    expect(incidentService.transitionWorkItemState).toHaveBeenNthCalledWith(
      2,
      "inc-flow",
      WorkItemState.RESOLVED
    );
  });

  test("returns 400 when status is missing", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      transitionWorkItemState: jest.fn(),
      getWorkItem: jest.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use("/api", createSignalRoutes(signalService as any, incidentService as any));

    const response = await request(app).put("/api/incidents/inc-flow/status").send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("status is required");
    expect(incidentService.transitionWorkItemState).not.toHaveBeenCalled();
  });

  test("returns 400 when transition is invalid", async () => {
    const signalService = {
      getSignalsForWorkItem: jest.fn(),
    };
    const incidentService = {
      transitionWorkItemState: jest
        .fn()
        .mockRejectedValue(new Error("Cannot transition from OPEN to CLOSED")),
      getWorkItem: jest.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use("/api", createSignalRoutes(signalService as any, incidentService as any));

    const response = await request(app)
      .put("/api/incidents/inc-flow/status")
      .send({ status: WorkItemState.CLOSED });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Cannot transition from OPEN to CLOSED");
  });
});
