import { v4 as uuidv4 } from "uuid";
import { ComponentType, Severity, Signal } from "../types";

interface RandomSignalOptions {
  componentType?: ComponentType;
  severity?: Severity;
}

interface SignalTemplate {
  componentType: ComponentType;
  componentPrefix: string;
  errorCode: string;
  errorMessage: string;
  severity: Severity;
  metadata: () => Record<string, unknown>;
  stackTrace?: () => string;
  latency?: () => number;
}

const SIGNAL_TEMPLATES: SignalTemplate[] = [
  {
    componentType: ComponentType.API,
    componentPrefix: "API_GATEWAY",
    errorCode: "REQUEST_TIMEOUT",
    errorMessage: "Intermittent API timeout detected",
    severity: Severity.P3,
    metadata: () => ({
      averageResponseTimeMs: randomInt(2500, 12000),
      timeoutThresholdMs: 30000,
      retryCount: randomInt(1, 12),
    }),
    latency: () => randomInt(2500, 12000),
  },
  {
    componentType: ComponentType.MCP_HOST,
    componentPrefix: "MCP_HOST",
    errorCode: "SERVICE_UNAVAILABLE",
    errorMessage: "MCP host health checks are failing",
    severity: Severity.P1,
    metadata: () => ({
      healthCheckAttempts: randomInt(2, 6),
      lastSuccessfulCheckMinutesAgo: randomInt(5, 45),
      failureReason: "Connection refused",
    }),
    stackTrace: () =>
      `Error: connect ECONNREFUSED 192.168.1.${randomInt(10, 250)}:8080`,
  },
  {
    componentType: ComponentType.CACHE_CLUSTER,
    componentPrefix: "CACHE_CLUSTER",
    errorCode: "HIGH_MEMORY_USAGE",
    errorMessage: "Cache cluster memory usage is above threshold",
    severity: Severity.P2,
    metadata: () => ({
      memoryUsagePercent: randomInt(85, 99),
      evictionRate: randomInt(500, 1500),
      hitRate: Number((Math.random() * 0.5 + 0.35).toFixed(2)),
    }),
  },
  {
    componentType: ComponentType.ASYNC_QUEUE,
    componentPrefix: "ASYNC_QUEUE",
    errorCode: "QUEUE_BACKLOG",
    errorMessage: "Async queue backlog exceeds threshold",
    severity: Severity.P1,
    metadata: () => ({
      pendingJobs: randomInt(10000, 75000),
      processingRate: randomInt(50, 300),
      estimatedClearTimeHours: randomInt(2, 12),
    }),
  },
  {
    componentType: ComponentType.RDBMS,
    componentPrefix: "RDBMS_CLUSTER",
    errorCode: "CONNECTION_POOL_EXHAUSTED",
    errorMessage: "All database connections in the pool are exhausted",
    severity: Severity.P0,
    metadata: () => ({
      poolSize: randomInt(50, 200),
      activeConnections: randomInt(50, 200),
      waitingRequests: randomInt(200, 8000),
    }),
    stackTrace: () =>
      "Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)",
    latency: () => randomInt(15000, 45000),
  },
  {
    componentType: ComponentType.NOSQL_STORE,
    componentPrefix: "NOSQL_STORE",
    errorCode: "REPLICATION_LAG_HIGH",
    errorMessage: "NoSQL replication lag has exceeded the safe threshold",
    severity: Severity.P2,
    metadata: () => ({
      replicationLagMs: randomInt(1000, 9000),
      primaryWriteRate: randomInt(3000, 8000),
      secondaryReadLag: randomInt(1200, 10000),
    }),
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickTemplate(options: RandomSignalOptions): SignalTemplate {
  const filteredTemplates = options.componentType
    ? SIGNAL_TEMPLATES.filter((template) => template.componentType === options.componentType)
    : SIGNAL_TEMPLATES;

  const template = filteredTemplates[randomInt(0, filteredTemplates.length - 1)];

  return {
    ...template,
    severity: options.severity || template.severity,
  };
}

export function buildRandomSignal(options: RandomSignalOptions = {}): Signal {
  const template = pickTemplate(options);
  const suffix = randomInt(1, 99).toString().padStart(2, "0");

  return {
    id: uuidv4(),
    componentId: `${template.componentPrefix}_${suffix}`,
    componentType: template.componentType,
    errorCode: template.errorCode,
    errorMessage: template.errorMessage,
    severity: template.severity,
    timestamp: new Date(),
    metadata: template.metadata(),
    stackTrace: template.stackTrace?.(),
    latency: template.latency?.(),
  };
}