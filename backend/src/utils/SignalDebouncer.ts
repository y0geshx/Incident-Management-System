/**
 * Debouncing Logic
 * If 100 signals arrive for the same component within 10 seconds, create only 1 Work Item
 */

interface DebounceBucket {
  signalIds: string[];
  firstSignalTime: Date;
  lastSignalTime: Date;
  timeout: NodeJS.Timeout;
}

export class SignalDebouncer {
  private buckets: Map<string, DebounceBucket> = new Map();
  private readonly windowMs: number;
  private readonly threshold: number;
  private readonly onFlush: (
    componentId: string,
    signalIds: string[]
  ) => Promise<void>;

  constructor(
    windowMs: number = 10000,
    threshold: number = 100,
    onFlush: (componentId: string, signalIds: string[]) => Promise<void>
  ) {
    this.windowMs = windowMs;
    this.threshold = threshold;
    this.onFlush = onFlush;
  }

  async addSignal(componentId: string, signalId: string): Promise<void> {
    let bucket = this.buckets.get(componentId);

    if (!bucket) {
      // Create new bucket
      bucket = {
        signalIds: [signalId],
        firstSignalTime: new Date(),
        lastSignalTime: new Date(),
        timeout: this.scheduleFlush(componentId),
      };
      this.buckets.set(componentId, bucket);
    } else {
      // Add to existing bucket
      bucket.signalIds.push(signalId);
      bucket.lastSignalTime = new Date();

      // Check if threshold reached
      if (bucket.signalIds.length >= this.threshold) {
        await this.flushBucket(componentId);
      }
    }
  }

  private scheduleFlush(componentId: string): NodeJS.Timeout {
    return setTimeout(async () => {
      await this.flushBucket(componentId);
    }, this.windowMs);
  }

  private async flushBucket(componentId: string): Promise<void> {
    const bucket = this.buckets.get(componentId);
    if (!bucket) return;

    clearTimeout(bucket.timeout);
    this.buckets.delete(componentId);

    // Trigger flush callback
    await this.onFlush(componentId, bucket.signalIds);
  }

  getMetrics(): {
    activeComponents: number;
    totalBufferedSignals: number;
  } {
    let totalSignals = 0;
    for (const bucket of this.buckets.values()) {
      totalSignals += bucket.signalIds.length;
    }
    return {
      activeComponents: this.buckets.size,
      totalBufferedSignals: totalSignals,
    };
  }
}
