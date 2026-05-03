/**
 * Type definitions for the IMS system
 */

export interface Signal {
  id: string;
  componentId: string;
  componentType: ComponentType;
  errorCode: string;
  errorMessage: string;
  severity: Severity;
  timestamp: Date;
  metadata: Record<string, unknown>;
  stackTrace?: string;
  latency?: number;
}

export enum ComponentType {
  API = "API",
  MCP_HOST = "MCP_HOST",
  CACHE_CLUSTER = "CACHE_CLUSTER",
  ASYNC_QUEUE = "ASYNC_QUEUE",
  RDBMS = "RDBMS",
  NOSQL_STORE = "NOSQL_STORE",
}

export enum Severity {
  P0 = "P0", // Critical - RDBMS failure
  P1 = "P1", // High - MCP/Queue failure
  P2 = "P2", // Medium - Cache failure
  P3 = "P3", // Low - API timeout
}

export enum WorkItemState {
  OPEN = "OPEN",
  INVESTIGATING = "INVESTIGATING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export interface WorkItem {
  id: string;
  componentId: string;
  componentType: ComponentType;
  status: WorkItemState;
  severity: Severity;
  title: string;
  description: string;
  signalIds: string[];
  signalCount: number;
  firstSignalTime: Date;
  lastSignalTime: Date;
  assignedTo?: string;
  rca?: RootCauseAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface RootCauseAnalysis {
  id: string;
  workItemId: string;
  incidentStartTime: Date;
  incidentEndTime: Date;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  mttr: number; // in seconds
  createdAt: Date;
  createdBy: string;
}

export interface AlertMessage {
  id: string;
  workItemId: string;
  priority: Severity;
  channel: AlertChannel;
  message: string;
  recipient: string;
  sentAt: Date;
  status: AlertStatus;
}

export enum AlertChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  SLACK = "SLACK",
  PAGERDUTY = "PAGERDUTY",
}

export enum AlertStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface DashboardState {
  activeIncidents: WorkItem[];
  recentSignals: Signal[];
  totalSignalsPerSecond: number;
  systemHealth: SystemHealth;
  timeseriesData: TimeseriesData[];
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  components: ComponentHealth[];
  lastUpdated: Date;
}

export interface ComponentHealth {
  componentId: string;
  componentType: ComponentType;
  status: "healthy" | "degraded" | "failing";
  signalCount: number;
  lastSignalTime: Date;
}

export interface TimeseriesData {
  timestamp: Date;
  componentType: ComponentType;
  signalCount: number;
  avgLatency: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
