export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Mission-Critical Incident Management System API",
    version: "1.0.0",
    description:
      "OpenAPI specification for signal ingestion, incident management, RCA submission, and health checks.",
  },
  servers: [
    {
      url: "http://localhost:3001/api",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Health", description: "Service and dependency health checks" },
    { name: "Signals", description: "Signal ingestion and simulation endpoints" },
    { name: "Incidents", description: "Incident lifecycle and RCA endpoints" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Get the current system health",
        responses: {
          200: {
            description: "The system is operational",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemStatus" },
              },
            },
          },
          503: {
            description: "One or more services are degraded or down",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemStatus" },
              },
            },
          },
        },
      },
    },
    "/health/quick": {
      get: {
        tags: ["Health"],
        summary: "Get a lightweight API liveness check",
        responses: {
          200: {
            description: "API is reachable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuickHealthResponse" },
              },
            },
          },
        },
      },
    },
    "/signals": {
      post: {
        tags: ["Signals"],
        summary: "Ingest a single signal",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignalCreateRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Signal accepted for processing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SignalAcceptedResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/signals/random": {
      post: {
        tags: ["Signals"],
        summary: "Generate and ingest a random signal",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RandomSignalRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Random signal accepted for processing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RandomSignalResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/signals/cascading-failure": {
      post: {
        tags: ["Signals"],
        summary: "Simulate a cascading failure scenario",
        responses: {
          202: {
            description: "Cascading failure signals accepted for processing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CascadingFailureResponse" },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/signals/batch": {
      post: {
        tags: ["Signals"],
        summary: "Ingest multiple signals in a single request",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchSignalRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Signals accepted for processing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchSignalResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/incidents": {
      get: {
        tags: ["Incidents"],
        summary: "List incidents",
        parameters: [
          {
            in: "query",
            name: "status",
            required: false,
            schema: { $ref: "#/components/schemas/WorkItemState" },
            description: "Filter incidents by state",
          },
        ],
        responses: {
          200: {
            description: "A list of incidents",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IncidentListResponse" },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
      post: {
        tags: ["Incidents"],
        summary: "Create a new incident manually",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IncidentCreateRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Incident created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WorkItem" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/incidents/{id}": {
      get: {
        tags: ["Incidents"],
        summary: "Get a single incident by ID",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Incident details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WorkItem" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/incidents/{id}/signals": {
      get: {
        tags: ["Incidents"],
        summary: "Get raw signals linked to an incident",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Signals linked to the incident",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SignalListResponse" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/incidents/{id}/status": {
      put: {
        tags: ["Incidents"],
        summary: "Update the status of an incident",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IncidentStatusUpdateRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Updated incident",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WorkItem" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
    "/incidents/{id}/rca": {
      post: {
        tags: ["Incidents"],
        summary: "Submit a mandatory RCA for a resolved incident",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RCARequest" },
            },
          },
        },
        responses: {
          201: {
            description: "RCA submitted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RCAResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description: "The request could not be processed",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFound: {
        description: "The requested resource was not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      InternalServerError: {
        description: "An unexpected server error occurred",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
    schemas: {
      ComponentType: {
        type: "string",
        enum: ["API", "MCP_HOST", "CACHE_CLUSTER", "ASYNC_QUEUE", "RDBMS", "NOSQL_STORE"],
      },
      Severity: {
        type: "string",
        enum: ["P0", "P1", "P2", "P3"],
      },
      WorkItemState: {
        type: "string",
        enum: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
      },
      Signal: {
        type: "object",
        required: ["id", "componentId", "componentType", "errorCode", "errorMessage", "severity", "timestamp", "metadata"],
        properties: {
          id: { type: "string" },
          componentId: { type: "string" },
          componentType: { $ref: "#/components/schemas/ComponentType" },
          errorCode: { type: "string" },
          errorMessage: { type: "string" },
          severity: { $ref: "#/components/schemas/Severity" },
          timestamp: { type: "string", format: "date-time" },
          metadata: { type: "object", additionalProperties: true },
          stackTrace: { type: ["string", "null"] },
          latency: { type: ["number", "null"] },
        },
      },
      SignalCreateRequest: {
        type: "object",
        required: ["componentId", "componentType", "errorCode", "errorMessage"],
        properties: {
          componentId: { type: "string" },
          componentType: { $ref: "#/components/schemas/ComponentType" },
          errorCode: { type: "string" },
          errorMessage: { type: "string" },
          severity: { $ref: "#/components/schemas/Severity" },
          metadata: { type: "object", additionalProperties: true },
          stackTrace: { type: "string" },
          latency: { type: "number" },
        },
        example: {
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
          stackTrace: "Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)",
          latency: 30000,
        },
      },
      RandomSignalRequest: {
        type: "object",
        properties: {
          componentType: { $ref: "#/components/schemas/ComponentType" },
          severity: { $ref: "#/components/schemas/Severity" },
        },
      },
      BatchSignalRequest: {
        type: "object",
        required: ["signals"],
        properties: {
          signals: {
            type: "array",
            items: { $ref: "#/components/schemas/SignalCreateRequest" },
          },
        },
      },
      SignalAcceptedResponse: {
        type: "object",
        required: ["message", "signalId"],
        properties: {
          message: { type: "string" },
          signalId: { type: "string" },
        },
      },
      RandomSignalResponse: {
        type: "object",
        required: ["message", "signal"],
        properties: {
          message: { type: "string" },
          signal: { $ref: "#/components/schemas/Signal" },
        },
      },
      CascadingFailureResponse: {
        type: "object",
        required: ["message", "count"],
        properties: {
          message: { type: "string" },
          count: { type: "number" },
        },
      },
      BatchSignalResponse: {
        type: "object",
        required: ["message", "count"],
        properties: {
          message: { type: "string" },
          count: { type: "number" },
        },
      },
      IncidentCreateRequest: {
        type: "object",
        required: ["title", "description", "componentType", "componentId", "severity", "errorCode", "errorMessage"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          componentType: { $ref: "#/components/schemas/ComponentType" },
          componentId: { type: "string" },
          severity: { $ref: "#/components/schemas/Severity" },
          errorCode: { type: "string" },
          errorMessage: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          stackTrace: { type: "string" },
          latency: { type: "number" },
          assignedTo: { type: "string" },
        },
      },
      IncidentStatusUpdateRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { $ref: "#/components/schemas/WorkItemState" },
        },
      },
      RCARequest: {
        type: "object",
        required: ["incidentStartTime", "incidentEndTime", "rootCauseCategory", "fixApplied", "preventionSteps"],
        properties: {
          incidentStartTime: { type: "string", format: "date-time" },
          incidentEndTime: { type: "string", format: "date-time" },
          rootCauseCategory: { type: "string" },
          fixApplied: { type: "string" },
          preventionSteps: { type: "string" },
          createdBy: { type: "string" },
        },
      },
      RCAResponse: {
        type: "object",
        required: ["message", "rca"],
        properties: {
          message: { type: "string" },
          rca: { $ref: "#/components/schemas/RootCauseAnalysis" },
        },
      },
      RootCauseAnalysis: {
        type: "object",
        required: ["id", "workItemId", "incidentStartTime", "incidentEndTime", "rootCauseCategory", "fixApplied", "preventionSteps", "mttr", "createdAt", "createdBy"],
        properties: {
          id: { type: "string" },
          workItemId: { type: "string" },
          incidentStartTime: { type: "string", format: "date-time" },
          incidentEndTime: { type: "string", format: "date-time" },
          rootCauseCategory: { type: "string" },
          fixApplied: { type: "string" },
          preventionSteps: { type: "string" },
          mttr: { type: "number" },
          createdAt: { type: "string", format: "date-time" },
          createdBy: { type: "string" },
        },
      },
      WorkItem: {
        type: "object",
        required: ["id", "componentId", "componentType", "status", "severity", "title", "description", "signalIds", "signalCount", "firstSignalTime", "lastSignalTime", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" },
          componentId: { type: "string" },
          componentType: { $ref: "#/components/schemas/ComponentType" },
          status: { $ref: "#/components/schemas/WorkItemState" },
          severity: { $ref: "#/components/schemas/Severity" },
          title: { type: "string" },
          description: { type: "string" },
          signalIds: { type: "array", items: { type: "string" } },
          signalCount: { type: "number" },
          firstSignalTime: { type: "string", format: "date-time" },
          lastSignalTime: { type: "string", format: "date-time" },
          assignedTo: { anyOf: [{ type: "string" }, { type: "null" }] },
          rca: { anyOf: [{ $ref: "#/components/schemas/RootCauseAnalysis" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      IncidentListResponse: {
        type: "object",
        required: ["data", "total"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/WorkItem" } },
          total: { type: "number" },
        },
      },
      SignalListResponse: {
        type: "object",
        required: ["data", "total"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Signal" } },
          total: { type: "number" },
        },
      },
      QuickHealthResponse: {
        type: "object",
        required: ["status", "timestamp", "message"],
        properties: {
          status: { type: "string", example: "healthy" },
          timestamp: { type: "string", format: "date-time" },
          message: { type: "string" },
        },
      },
      ServiceStatus: {
        type: "object",
        required: ["name", "status", "responseTime", "lastChecked"],
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
          responseTime: { type: "number" },
          details: { type: ["string", "null"] },
          lastChecked: { type: "string", format: "date-time" },
        },
      },
      SystemStatus: {
        type: "object",
        required: ["status", "timestamp", "services", "uptime"],
        properties: {
          status: { type: "string", enum: ["operational", "degraded", "down"] },
          timestamp: { type: "string", format: "date-time" },
          services: {
            type: "array",
            items: { $ref: "#/components/schemas/ServiceStatus" },
          },
          uptime: { type: "number" },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
} as const;
