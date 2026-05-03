/**
 * Aggregations Store
 * Stores timeseries aggregations for analytics and monitoring
 */

import { TimeseriesData, ComponentType } from "../types";
import { CacheStore } from "./CacheStore";

export class AggregationsStore {
  constructor(private cacheStore: CacheStore) {}

  async recordTimeseries(data: TimeseriesData): Promise<void> {
    await this.cacheStore.setSignalBucket(
      data.componentType,
      Math.floor(data.timestamp.getTime() / 60000),
      data.signalCount,
      86400
    );
  }

  async getTimeseriesData(
    componentType: ComponentType,
    hoursBack: number = 24
  ): Promise<TimeseriesData[]> {
    const data: TimeseriesData[] = [];
    const now = new Date();

    for (let i = 0; i < hoursBack * 60; i++) {
      const timestamp = new Date(now.getTime() - i * 60000);
      const bucket = await this.cacheStore.getSignalBucket(
        componentType,
        Math.floor(timestamp.getTime() / 60000)
      );

      if (bucket !== null) {
        data.push({
          timestamp,
          componentType,
          signalCount: bucket,
          avgLatency: 0,
        });
      }
    }

    return data.reverse();
  }

  async aggregateByComponentType(
    componentType: ComponentType,
    windowMinutes: number = 60
  ): Promise<{ totalSignals: number; avgLatency: number }> {
    let totalSignals = 0;
    const now = new Date();

    for (let i = 0; i < windowMinutes; i++) {
      const timestamp = new Date(now.getTime() - i * 60000);
      const bucket = await this.cacheStore.getSignalBucket(
        componentType,
        Math.floor(timestamp.getTime() / 60000)
      );

      if (bucket !== null) {
        totalSignals += bucket;
      }
    }

    return {
      totalSignals,
      avgLatency: 0,
    };
  }
}
