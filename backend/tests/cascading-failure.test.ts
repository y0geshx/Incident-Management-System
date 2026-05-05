import express from "express";
import request from "supertest";
import { createSignalRoutes } from "../src/routes/signals";
import {
  Signal,
  Severity,
  ComponentType,
} from "../src/types";

describe("POST /api/signals/cascading-failure - Cascading Failure Simulation", () => {
  let mockSignalService: any;
  let mockIncidentService: any;
  let app: express.Application;

  beforeEach(() => {
    mockSignalService = {
      processSignal: jest.fn().mockResolvedValue(undefined),
      getSignalsForWorkItem: jest.fn(),
    };

    mockIncidentService = {
      getWorkItem: jest.fn(),
      getAllWorkItems: jest.fn().mockResolvedValue([]),
      createWorkItem: jest.fn(),
      updateWorkItem: jest.fn(),
      closeWorkItem: jest.fn(),
    };

    app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(mockSignalService, mockIncidentService)
    );
  });

  test("should process cascading failure with 20 signals", async () => {
    const response = await request(app).post("/api/signals/cascading-failure");

    expect(response.status).toBe(202);
    expect(response.body.message).toContain("Cascading failure signals accepted");
    expect(response.body.count).toBe(20);
  });

  test("should call processSignal 20 times for each cascading signal", async () => {
    await request(app).post("/api/signals/cascading-failure");

    expect(mockSignalService.processSignal).toHaveBeenCalledTimes(20);
  });

  test("should include RDBMS failure as P0 critical", async () => {
    await request(app).post("/api/signals/cascading-failure");

    // Find the call with RDBMS signal
    const rdbmsCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "RDBMS_CLUSTER_01"
    );

    expect(rdbmsCall).toBeDefined();
    const signal = rdbmsCall[0];
    expect(signal.severity).toBe(Severity.P0);
    expect(signal.errorCode).toBe("CONNECTION_POOL_EXHAUSTED");
    expect(signal.componentType).toBe(ComponentType.RDBMS);
  });

  test("should include API Gateway failure as P1 with metadata", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const apiCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "API_GATEWAY_01"
    );

    expect(apiCall).toBeDefined();
    const signal = apiCall[0];
    expect(signal.severity).toBe(Severity.P1);
    expect(signal.errorCode).toBe("DOWNSTREAM_ERROR");
    expect(signal.metadata.downstreamService).toBe("RDBMS_CLUSTER_01");
    expect(signal.metadata.errorRate).toBe(0.95);
  });

  test("should include Cache degradation as P2", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const cacheCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "CACHE_CLUSTER_01"
    );

    expect(cacheCall).toBeDefined();
    const signal = cacheCall[0];
    expect(signal.severity).toBe(Severity.P2);
    expect(signal.errorCode).toBe("HIGH_MEMORY_USAGE");
    expect(signal.componentType).toBe(ComponentType.CACHE_CLUSTER);
  });

  test("should include Async Queue backlog as P1", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const queueCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "ASYNC_QUEUE_01"
    );

    expect(queueCall).toBeDefined();
    const signal = queueCall[0];
    expect(signal.severity).toBe(Severity.P1);
    expect(signal.errorCode).toBe("QUEUE_BACKLOG");
    expect(signal.metadata.pendingJobs).toBe(50000);
  });

  test("should include MCP Host failure as P0", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const mcpCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "MCP_HOST_02"
    );

    expect(mcpCall).toBeDefined();
    const signal = mcpCall[0];
    expect(signal.severity).toBe(Severity.P0);
    expect(signal.errorCode).toBe("SERVICE_UNAVAILABLE");
    expect(signal.componentType).toBe(ComponentType.MCP_HOST);
  });

  test("should include NoSQL replication lag as P2", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const nosqlCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "NOSQL_STORE_01"
    );

    expect(nosqlCall).toBeDefined();
    const signal = nosqlCall[0];
    expect(signal.severity).toBe(Severity.P2);
    expect(signal.errorCode).toBe("REPLICATION_LAG_HIGH");
    expect(signal.componentType).toBe(ComponentType.NOSQL_STORE);
    expect(signal.metadata.replicationLagMs).toBe(5000);
  });

  test("all cascading signals should have timestamps", async () => {
    await request(app).post("/api/signals/cascading-failure");

    mockSignalService.processSignal.mock.calls.forEach((call: any[]) => {
      const signal = call[0];
      expect(signal.timestamp).toBeInstanceOf(Date);
      expect(signal.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  test("all cascading signals should have unique IDs", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const ids = mockSignalService.processSignal.mock.calls.map(
      (call: any[]) => call[0].id
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(6);
  });

  test("should include stack traces for critical failures", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const rdbmsCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "RDBMS_CLUSTER_01"
    );
    const mcpCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "MCP_HOST_02"
    );

    expect(rdbmsCall[0].stackTrace).toBeDefined();
    expect(rdbmsCall[0].stackTrace).toContain("DatabasePool");
    expect(mcpCall[0].stackTrace).toBeDefined();
    expect(mcpCall[0].stackTrace).toContain("ECONNREFUSED");
  });

  test("RDBMS failure should be the root cause with highest latency", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const rdbmsCall = mockSignalService.processSignal.mock.calls.find(
      (call: any[]) =>
        call[0].componentId === "RDBMS_CLUSTER_01"
    );

    // RDBMS latency should be highest
    const rdbmsLatency = rdbmsCall[0].latency;
    const allLatencies = mockSignalService.processSignal.mock.calls.map(
      (call: any[]) => call[0].latency || 0
    );

    const maxLatency = Math.max(...allLatencies.filter((l: number) => l > 0));
    expect(rdbmsLatency).toBe(maxLatency);
  });

  test("should handle processing errors gracefully", async () => {
    mockSignalService.processSignal.mockRejectedValueOnce(
      new Error("Database connection failed")
    );

    const response = await request(app).post("/api/signals/cascading-failure");

    // Should still return 202 as long as we handle the error
    expect(response.status).toBe(500);
    expect(response.body.error).toContain("Database connection failed");
  });

  test("cascading signals should include detailed metadata", async () => {
    await request(app).post("/api/signals/cascading-failure");

    // Verify metadata richness for critical components
    const signals = mockSignalService.processSignal.mock.calls.map(
      (call: any[]) => call[0]
    );

    const rdbmsSignal = signals.find(
      (s: Signal) => s.componentId === "RDBMS_CLUSTER_01"
    );
    expect(rdbmsSignal.metadata).toHaveProperty("poolSize");
    expect(rdbmsSignal.metadata).toHaveProperty("activeConnections");
    expect(rdbmsSignal.metadata).toHaveProperty("waitingRequests");

    const apiSignal = signals.find(
      (s: Signal) => s.componentId === "API_GATEWAY_01"
    );
    expect(apiSignal.metadata).toHaveProperty("downstreamService");
    expect(apiSignal.metadata).toHaveProperty("errorRate");
  });

  test("should respect component type mapping for all signals", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const signals = mockSignalService.processSignal.mock.calls.map(
      (call: any[]) => call[0]
    );

    const expectedMappings: Record<string, ComponentType> = {
      RDBMS_CLUSTER_01: ComponentType.RDBMS,
      API_GATEWAY_01: ComponentType.API,
      CACHE_CLUSTER_01: ComponentType.CACHE_CLUSTER,
      ASYNC_QUEUE_01: ComponentType.ASYNC_QUEUE,
      MCP_HOST_02: ComponentType.MCP_HOST,
      NOSQL_STORE_01: ComponentType.NOSQL_STORE,
    };

    signals.forEach((signal: Signal) => {
      expect(signal.componentType).toBe(expectedMappings[signal.componentId]);
    });
  });
});

describe("Cascading Failure Detection and Correlation", () => {
  let mockSignalService: any;
  let mockIncidentService: any;
  let app: express.Application;

  beforeEach(() => {
    mockSignalService = {
      processSignal: jest.fn().mockResolvedValue(undefined),
    };

    mockIncidentService = {
      getWorkItem: jest.fn(),
      getAllWorkItems: jest.fn().mockResolvedValue([]),
    };

    app = express();
    app.use(express.json());
    app.use(
      "/api",
      createSignalRoutes(mockSignalService, mockIncidentService)
    );
  });

  test("should identify cascading patterns from signals", async () => {
    // This test verifies that signals have metadata indicating cascade relationships
    await request(app).post("/api/signals/cascading-failure");

    const signals = mockSignalService.processSignal.mock.calls.map(
      (call: any[]) => call[0]
    );

    // API Gateway signal should reference RDBMS as downstream
    const apiSignal = signals.find(
      (s: Signal) => s.componentId === "API_GATEWAY_01"
    );
    expect(apiSignal.metadata.downstreamService).toBe("RDBMS_CLUSTER_01");

    // All signals should have timestamps close to each other (within 1 second)
    const timestamps = signals.map((s: Signal) => s.timestamp.getTime());
    const maxTime = Math.max(...timestamps);
    const minTime = Math.min(...timestamps);
    expect(maxTime - minTime).toBeLessThanOrEqual(1000);
  });

  test("critical signals should trigger P0 severity", async () => {
    await request(app).post("/api/signals/cascading-failure");

    const p0Signals = mockSignalService.processSignal.mock.calls
      .map((call: any[]) => call[0])
      .filter((signal: Signal) => signal.severity === Severity.P0);

    expect(p0Signals.length).toBeGreaterThanOrEqual(2);
  });
});
