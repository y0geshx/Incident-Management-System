export interface Signal {
  id: string;
  componentId: string;
  componentType: string;
  errorCode: string;
  errorMessage: string;
  severity: SeverityLevel;
  timestamp: string;
  metadata: Record<string, unknown>;
  stackTrace?: string;
  latency?: number;
}

export interface WorkItem {
  id: string;
  componentId: string;
  componentType: string;
  status: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  signalIds: string[];
  signalCount: number;
  firstSignalTime: string;
  lastSignalTime: string;
  assignedTo?: string;
  rca?: RootCauseAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface RootCauseAnalysis {
  id: string;
  workItemId: string;
  incidentStartTime: string;
  incidentEndTime: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  mttr: number;
  createdAt: string;
  createdBy: string;
}

export interface RCAInput {
  incidentStartTime: string;
  incidentEndTime: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  createdBy: string;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  componentType: string;
  componentId: string;
  severity: SeverityLevel;
  errorCode: string;
  errorMessage: string;
  metadata: Record<string, unknown>;
  stackTrace?: string;
  latency?: number;
  assignedTo?: string;
}

export type SeverityLevel = "P0" | "P1" | "P2" | "P3";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
