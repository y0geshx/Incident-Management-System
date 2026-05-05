/**
 * Incident Management Service
 * Manages work items and their state transitions
 */

import { v4 as uuidv4 } from "uuid";
import {
  WorkItem,
  RootCauseAnalysis,
  WorkItemState,
  ComponentType,
  Severity,
  AlertMessage,
  AlertStatus,
} from "../types";
import { SourceOfTruthStore } from "../storage/SourceOfTruthStore";
import { CacheStore } from "../storage/CacheStore";
import {
  AlertStrategyFactory,
  AlertStrategy,
} from "../patterns/AlertStrategy";
import { WorkItemStateContext } from "../patterns/StatePattern";
import { Logger } from "../utils/Logger";
import {
  NoopRealtimeBroadcaster,
  RealtimeBroadcaster,
} from "../realtime/ApiChangeBroadcaster";

export class IncidentManagementService {
  private logger: Logger;
  private stateContext: WorkItemStateContext;
  private alerts: AlertMessage[] = [];

  constructor(
    private sourceOfTruthStore: SourceOfTruthStore,
    private cacheStore: CacheStore,
    private realtimeBroadcaster: RealtimeBroadcaster = new NoopRealtimeBroadcaster()
  ) {
    this.logger = new Logger("info");
    this.stateContext = new WorkItemStateContext();
  }

  private emitChange(
    action: "created" | "updated",
    workItemId: string,
    message: string
  ): void {
    void this.realtimeBroadcaster.broadcast({
      type: "api-change",
      resource: "incident",
      action,
      resourceId: workItemId,
      timestamp: new Date().toISOString(),
      message,
    });
  }

  async transitionWorkItemState(
    workItemId: string,
    newState: WorkItemState
  ): Promise<void> {
    const workItem = await this.sourceOfTruthStore.getWorkItem(workItemId);
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    // Prevent transition to CLOSED without RCA
    if (newState === WorkItemState.CLOSED) {
      const rca = await this.sourceOfTruthStore.getRCA(workItemId);
      if (!rca) {
        throw new Error(
          "Cannot close incident without mandatory RCA. Fill out the RCA form first."
        );
      }
    }

    // Validate state transition
    await this.stateContext.setState(newState, workItem);

    // Update work item
    workItem.status = newState;
    workItem.updatedAt = new Date();
    await this.sourceOfTruthStore.updateWorkItem(workItem);

    // Clear cache
    await this.cacheStore.deleteWorkItem(workItemId);

    this.emitChange(
      "updated",
      workItemId,
      `Work item ${workItemId} transitioned to ${newState}`
    );

    this.logger.info(`Work item ${workItemId} transitioned to ${newState}`);
  }

  async submitRCA(
    workItemId: string,
    rca: Omit<RootCauseAnalysis, "id" | "createdAt">
  ): Promise<RootCauseAnalysis> {
    const workItem = await this.sourceOfTruthStore.getWorkItem(workItemId);
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    const existingRca = await this.sourceOfTruthStore.getRCA(workItemId);
    if (existingRca) {
      throw new Error("RCA has already been submitted for this incident");
    }

    // Validate RCA fields
    if (
      !rca.rootCauseCategory ||
      !rca.fixApplied ||
      !rca.preventionSteps
    ) {
      throw new Error("RCA must have all required fields filled");
    }

    // Calculate MTTR
    const mttr = Math.floor(
      (rca.incidentEndTime.getTime() - rca.incidentStartTime.getTime()) / 1000
    );

    const rcaRecord: RootCauseAnalysis = {
      id: uuidv4(),
      workItemId,
      incidentStartTime: rca.incidentStartTime,
      incidentEndTime: rca.incidentEndTime,
      rootCauseCategory: rca.rootCauseCategory,
      fixApplied: rca.fixApplied,
      preventionSteps: rca.preventionSteps,
      mttr,
      createdAt: new Date(),
      createdBy: rca.createdBy,
    };

    // Store RCA
    await this.sourceOfTruthStore.storeRCA(rcaRecord);

    this.emitChange(
      "updated",
      workItemId,
      `RCA submitted for work item ${workItemId}`
    );

    this.logger.info(
      `RCA submitted for work item ${workItemId}, MTTR: ${mttr}s`
    );

    return rcaRecord;
  }

  async triggerAlert(workItem: WorkItem): Promise<void> {
    const strategy: AlertStrategy = AlertStrategyFactory.getStrategy(
      workItem.componentType
    );

    const channels = strategy.getAlertChannels();
    const recipient = strategy.getRecipient();
    const message = strategy.formatMessage(
      workItem.componentId,
      workItem.description
    );

    for (const channel of channels) {
      const alert: AlertMessage = {
        id: uuidv4(),
        workItemId: workItem.id,
        priority: strategy.getPriority(),
        channel,
        message,
        recipient,
        sentAt: new Date(),
        status: AlertStatus.SENT,
      };

      this.alerts.push(alert);
      this.logger.info(`Alert sent via ${channel} to ${recipient}`);
    }
  }

  async getActiveIncidents(): Promise<WorkItem[]> {
    return await this.sourceOfTruthStore.getAllActiveWorkItems();
  }

  async getAllIncidents(): Promise<WorkItem[]> {
    return await this.sourceOfTruthStore.getAllWorkItems();
  }

  async getWorkItemsByStatus(status: WorkItemState): Promise<WorkItem[]> {
    return await this.sourceOfTruthStore.getWorkItemsByStatus(status);
  }

  async getWorkItem(id: string): Promise<WorkItem | null> {
    // Try cache first
    const cached = await this.cacheStore.getWorkItem(id);
    if (cached) return cached;

    // Fetch from source of truth
    const workItem = await this.sourceOfTruthStore.getWorkItem(id);
    if (workItem) {
      // Cache it
      await this.cacheStore.setWorkItem(workItem, 300);
    }

    return workItem;
  }

  async createIncident(input: {
    componentId: string;
    componentType: ComponentType;
    severity: Severity;
    title: string;
    description: string;
    assignedTo?: string;
    initialSignalId?: string;
    initialSignalTime?: Date;
  }): Promise<WorkItem> {
    const now = new Date();
    const workItem: WorkItem = {
      id: uuidv4(),
      componentId: input.componentId,
      componentType: input.componentType,
      status: WorkItemState.OPEN,
      severity: input.severity,
      title: input.title,
      description: input.description,
      signalIds: input.initialSignalId ? [input.initialSignalId] : [],
      signalCount: input.initialSignalId ? 1 : 0,
      firstSignalTime: input.initialSignalTime || now,
      lastSignalTime: input.initialSignalTime || now,
      assignedTo: input.assignedTo,
      createdAt: now,
      updatedAt: now,
    };

    await this.sourceOfTruthStore.createWorkItem(workItem);
    await this.cacheStore.setWorkItem(workItem, 300);

    this.emitChange(
      "created",
      workItem.id,
      `Incident created for ${workItem.componentId}`
    );

    return workItem;
  }

  getAlerts(): AlertMessage[] {
    return this.alerts;
  }
}
