/**
 * Cache Store (Redis)
 * Maintains Real-time Dashboard State to avoid querying Source of Truth frequently
 */

import { RedisClientType, createClient } from "redis";
import { randomUUID } from "crypto";
import { WorkItem, DashboardState, Signal } from "../types";

export class CacheStore {
  private client: RedisClientType | null = null;

  async connect(redisUrl: string): Promise<void> {
    this.client = createClient({ url: redisUrl });
    this.client.on("error", (err: Error) => console.log("Redis error:", err));
    await this.client.connect();
    console.log("✓ Connected to Cache Store (Redis)");
  }

  async setWorkItem(workItem: WorkItem, ttlSeconds: number = 300): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `work_item:${workItem.id}`;
    await this.client.setEx(
      key,
      ttlSeconds,
      JSON.stringify(workItem)
    );
  }

  async getWorkItem(id: string): Promise<WorkItem | null> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `work_item:${id}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteWorkItem(id: string): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `work_item:${id}`;
    await this.client.del(key);
  }

  async setDashboardState(
    state: DashboardState,
    ttlSeconds: number = 60
  ): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = "dashboard:state";
    await this.client.setEx(key, ttlSeconds, JSON.stringify(state));
  }

  async getDashboardState(): Promise<DashboardState | null> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = "dashboard:state";
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async incrementSignalCount(
    componentId: string,
    amount: number = 1
  ): Promise<number> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `signal_count:${componentId}:${new Date().getHours()}h`;
    return await this.client.incrBy(key, amount);
  }

  async setSignalBucket(
    componentId: string,
    timestamp: number,
    count: number,
    ttlSeconds: number = 86400
  ): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `signals:${componentId}:${timestamp}`;
    await this.client.setEx(key, ttlSeconds, count.toString());
  }

  async getSignalBucket(
    componentId: string,
    timestamp: number
  ): Promise<number | null> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = `signals:${componentId}:${timestamp}`;
    const data = await this.client.get(key);
    return data ? parseInt(data, 10) : null;
  }

  async setRecentSignals(
    signals: Signal[],
    ttlSeconds: number = 300
  ): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = "recent:signals";
    await this.client.setEx(key, ttlSeconds, JSON.stringify(signals));
  }

  async getRecentSignals(): Promise<Signal[]> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const key = "recent:signals";
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : [];
  }

  async incrementMetric(metricName: string, amount: number = 1): Promise<number> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    return await this.client.incrBy(`metric:${metricName}`, amount);
  }

  async getMetric(metricName: string): Promise<number> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const data = await this.client.get(`metric:${metricName}`);
    return data ? parseInt(data, 10) : 0;
  }

  async resetMetric(metricName: string): Promise<void> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    await this.client.del(`metric:${metricName}`);
  }

  async acquireLock(lockKey: string, ttlSeconds: number = 10): Promise<string | null> {
    if (!this.client) throw new Error("Not connected to Cache Store");
    const token = randomUUID();
    const result = await this.client.set(lockKey, token, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === "OK" ? token : null;
  }

  async releaseLock(lockKey: string, token: string): Promise<boolean> {
    if (!this.client) throw new Error("Not connected to Cache Store");

    const releaseScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(releaseScript, {
      keys: [lockKey],
      arguments: [token],
    });

    return result === 1;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      console.log("✓ Disconnected from Cache Store");
    }
  }
}
