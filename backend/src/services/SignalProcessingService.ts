/**
 * Signal Processing Service
 * Handles ingestion, debouncing, and storage of signals
 */

import { v4 as uuidv4 } from "uuid";
import { Signal, WorkItemState } from "../types";
import { DataLakeStore } from "../storage/DataLakeStore";
import { SourceOfTruthStore } from "../storage/SourceOfTruthStore";
import { CacheStore } from "../storage/CacheStore";
import { SignalDebouncer } from "../utils/SignalDebouncer";
import { Logger } from "../utils/Logger";
import {
  NoopRealtimeBroadcaster,
  RealtimeBroadcaster,
} from "../realtime/ApiChangeBroadcaster";

export class SignalProcessingService {
  private logger: Logger;
  private debouncer: SignalDebouncer;
  private signalCounter: number = 0;
  private lastResetTime: Date = new Date();
  private componentFlushQueue: Map<string, Promise<void>> = new Map();

  constructor(
    private dataLakeStore: DataLakeStore,
    private sourceOfTruthStore: SourceOfTruthStore,
    private cacheStore: CacheStore,
    private realtimeBroadcaster: RealtimeBroadcaster = new NoopRealtimeBroadcaster(),
    debounceWindowMs: number = 10000
  ) {
    this.logger = new Logger("info");
    this.debouncer = new SignalDebouncer(
      debounceWindowMs,
      100,
      this.handleDebounceFlush.bind(this)
    );

    this.startMetricsReporter();
  }

  async processSignal(signal: Signal): Promise<void> {
    // Store immediately in data lake
    await this.dataLakeStore.storeSignal(signal);

    // Add to debouncer
    await this.debouncer.addSignal(signal.componentId, signal.id);

    // Update metrics
    this.signalCounter++;
    await this.cacheStore.incrementMetric("total_signals");
  }

  async getSignalsForWorkItem(signalIds: string[]): Promise<Signal[]> {
    if (signalIds.length === 0) {
      return [];
    }
    return this.dataLakeStore.getSignalsByWorkItem("", signalIds);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withComponentLock<T>(
    componentId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const previous = this.componentFlushQueue.get(componentId) ?? Promise.resolve();
    let releaseQueue: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    const queued = previous.then(() => current);
    this.componentFlushQueue.set(componentId, queued);

    await previous;

    const lockKey = `lock:component:flush:${componentId}`;
    let lockToken: string | null = null;
    const maxLockAttempts = 5;

    try {
      for (let attempt = 1; attempt <= maxLockAttempts; attempt++) {
        lockToken = await this.cacheStore.acquireLock(lockKey, 10);
        if (lockToken) {
          break;
        }
        await this.sleep(25 * attempt);
      }

      if (!lockToken) {
        this.logger.warn(
          `Proceeding without distributed lock for ${componentId} after ${maxLockAttempts} attempts`
        );
      }

      return await fn();
    } finally {
      if (lockToken) {
        await this.cacheStore.releaseLock(lockKey, lockToken);
      }
      releaseQueue();
      if (this.componentFlushQueue.get(componentId) === queued) {
        this.componentFlushQueue.delete(componentId);
      }
    }
  }

  private async handleDebounceFlush(
    componentId: string,
    signalIds: string[]
  ): Promise<void> {
    await this.withComponentLock(componentId, async () => {
      this.logger.info(
        `Debounce flush for ${componentId}: ${signalIds.length} signals`
      );

      // Check if work item already exists for this component (indexed DB lookup)
      let workItem = await this.sourceOfTruthStore.getActiveWorkItemByComponentId(
        componentId
      );

      if (!workItem) {
        // Create new work item
        const signal = await this.dataLakeStore.getSignalsByComponentId(
          componentId,
          1
        );

        if (signal.length === 0) return;

        const firstSignal = signal[0];
        workItem = {
          id: uuidv4(),
          componentId,
          componentType: firstSignal.componentType,
          status: WorkItemState.OPEN,
          severity: firstSignal.severity,
          title: `Incident: ${componentId}`,
          description: `Multiple signals detected for ${componentId}`,
          signalIds,
          signalCount: signalIds.length,
          firstSignalTime: firstSignal.timestamp,
          lastSignalTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.sourceOfTruthStore.createWorkItem(workItem);
        this.logger.info(`Created new work item: ${workItem.id}`);

        void this.realtimeBroadcaster.broadcast({
          type: "api-change",
          resource: "incident",
          action: "created",
          resourceId: workItem.id,
          timestamp: new Date().toISOString(),
          message: `Incident created for ${componentId} after debounce flush`,
        });
      } else {
        // Update existing work item
        workItem.signalIds = [...new Set([...workItem.signalIds, ...signalIds])];
        workItem.signalCount = workItem.signalIds.length;
        workItem.lastSignalTime = new Date();
        workItem.updatedAt = new Date();

        await this.sourceOfTruthStore.updateWorkItem(workItem);
        this.logger.info(`Updated work item: ${workItem.id}`);

        void this.realtimeBroadcaster.broadcast({
          type: "api-change",
          resource: "incident",
          action: "updated",
          resourceId: workItem.id,
          timestamp: new Date().toISOString(),
          message: `Incident updated for ${componentId} after debounce flush`,
        });
      }

      // Cache the work item
      await this.cacheStore.setWorkItem(workItem, 300);
    });
  }

  private startMetricsReporter(): void {
    setInterval(() => {
      const now = new Date();
      const secondsElapsed =
        (now.getTime() - this.lastResetTime.getTime()) / 1000;
      const signalsPerSecond = this.signalCounter / secondsElapsed;

      this.logger.info(`📊 Metrics: ${signalsPerSecond.toFixed(2)} signals/sec`);
      this.logger.info(`Debouncer: ${JSON.stringify(this.debouncer.getMetrics())}`);

      this.signalCounter = 0;
      this.lastResetTime = new Date();
    }, 5000);
  }
}
