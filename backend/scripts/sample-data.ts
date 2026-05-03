/**
 * Sample Data - Mock Failure Events
 * Simulates an RDBMS outage followed by an MCP failure
 */

export const SAMPLE_SIGNALS = [
  // RDBMS Failure - P0 Critical
  {
    componentId: "RDBMS_CLUSTER_01",
    componentType: "RDBMS",
    errorCode: "CONNECTION_POOL_EXHAUSTED",
    errorMessage: "All connections in pool exhausted. Database unavailable.",
    severity: "P0",
    metadata: {
      poolSize: 100,
      activeConnections: 100,
      waitingRequests: 5432,
    },
    stackTrace: `Error: Connection timeout
    at DatabasePool.getConnection (db/pool.ts:45:12)
    at Query.execute (db/query.ts:78:9)`,
    latency: 30000,
  },

  // Cascading API failures
  {
    componentId: "API_GATEWAY_01",
    componentType: "API",
    errorCode: "DOWNSTREAM_ERROR",
    errorMessage: "Database unavailable - cascading failure detected",
    severity: "P1",
    metadata: {
      downstreamService: "RDBMS_CLUSTER_01",
      errorRate: 0.95,
      averageLatency: 25000,
    },
    latency: 25000,
  },

  // Cache cluster degradation
  {
    componentId: "CACHE_CLUSTER_01",
    componentType: "CACHE_CLUSTER",
    errorCode: "HIGH_MEMORY_USAGE",
    errorMessage: "Cache cluster memory usage at 92%",
    severity: "P2",
    metadata: {
      memoryUsagePercent: 92,
      evictionRate: 1200,
      hitRate: 0.45,
    },
  },

  // Async Queue backed up
  {
    componentId: "ASYNC_QUEUE_01",
    componentType: "ASYNC_QUEUE",
    errorCode: "QUEUE_BACKLOG",
    errorMessage: "Queue backlog exceeds threshold: 50000 jobs pending",
    severity: "P1",
    metadata: {
      pendingJobs: 50000,
      processingRate: 100,
      estimatedClearTime: "8 hours",
    },
  },

  // MCP Host failure
  {
    componentId: "MCP_HOST_02",
    componentType: "MCP_HOST",
    errorCode: "SERVICE_UNAVAILABLE",
    errorMessage: "MCP Host 02 is down - health checks failing",
    severity: "P0",
    metadata: {
      healthCheckAttempts: 5,
      lastSuccessfulCheck: "2024-01-15T10:25:00Z",
      failureReason: "Connection refused",
    },
    stackTrace: `Error: connect ECONNREFUSED 192.168.1.52:8080
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:15)`,
  },

  // NoSQL store replication lag
  {
    componentId: "NOSQL_STORE_01",
    componentType: "NOSQL_STORE",
    errorCode: "REPLICATION_LAG_HIGH",
    errorMessage: "MongoDB replication lag exceeds acceptable threshold: 5000ms",
    severity: "P2",
    metadata: {
      replicationLagMs: 5000,
      primaryWriteRate: 5000,
      secondaryReadLag: 5200,
    },
  },

  // Additional API timeouts
  {
    componentId: "API_GATEWAY_02",
    componentType: "API",
    errorCode: "REQUEST_TIMEOUT",
    errorMessage: "Request timeout after 30 seconds",
    severity: "P2",
    metadata: {
      timeoutThreshold: 30000,
      averageResponseTime: 28500,
    },
    latency: 30001,
  },

  // MCP Host partial failure
  {
    componentId: "MCP_HOST_01",
    componentType: "MCP_HOST",
    errorCode: "HIGH_ERROR_RATE",
    errorMessage: "MCP Host 01 error rate at 15%",
    severity: "P1",
    metadata: {
      errorRate: 0.15,
      requestsPerSecond: 1000,
      errorCount: 150,
    },
  },

  // Low-priority API degradation
  {
    componentId: "API_GATEWAY_03",
    componentType: "API",
    errorCode: "SLOW_RESPONSE",
    errorMessage: "Intermittent slow responses from payment service",
    severity: "P3",
    metadata: {
      averageLatencyMs: 5200,
      errorRate: 0.02,
      retryCount: 120,
    },
    latency: 5200,
  },
];

/**
 * Sends signals to the IMS backend
 * Run with: npx ts-node scripts/sample-data.ts
 */
export async function generateSampleIncidents(): Promise<void> {
  const API_URL = process.env.API_URL || "http://localhost:3001/api";

  console.log("🚀 Generating sample incident data...");
  console.log(`📡 Target: ${API_URL}/signals/batch\n`);

  try {
    // Send batch of signals
    const response = await fetch(`${API_URL}/signals/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signals: SAMPLE_SIGNALS }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { count: number };
    console.log(
      `✅ Successfully sent ${data.count} sample signals to IMS`
    );
    console.log(
      "📊 Dashboard URL: http://localhost:3000"
    );
  } catch (error) {
    console.error("❌ Error sending sample data:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateSampleIncidents();
}
