/**
 * Data Lake Storage (MongoDB NoSQL)
 * Stores raw signal payloads for audit trail
 */

import { MongoClient, Db, Collection } from "mongodb";
import { Signal } from "../types";
import { retryWithBackoff } from "../utils/retryWithBackoff";

export class DataLakeStore {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private signalsCollection: Collection | null = null;

  async connect(mongoUrl: string): Promise<void> {
    this.client = new MongoClient(mongoUrl);
    await this.client.connect();
    this.db = this.client.db("ims_data_lake");
    this.signalsCollection = this.db.collection("signals");

    // Create indexes for efficient querying
    await this.signalsCollection.createIndex({ componentId: 1, timestamp: -1 });
    await this.signalsCollection.createIndex({ timestamp: -1 });
    await this.signalsCollection.createIndex({ severity: 1 });

    console.log("✓ Connected to Data Lake (MongoDB)");
  }

  async storeSignal(signal: Signal): Promise<void> {
    if (!this.signalsCollection) throw new Error("Not connected to Data Lake");
    await retryWithBackoff(async () => {
      await this.signalsCollection!.insertOne({
        ...signal,
        storedAt: new Date(),
      });
    });
  }

  async storeSignalsBatch(signals: Signal[]): Promise<void> {
    if (!this.signalsCollection) throw new Error("Not connected to Data Lake");
    if (signals.length === 0) return;
    await retryWithBackoff(async () => {
      await this.signalsCollection!.insertMany(
        signals.map((s) => ({
          ...s,
          storedAt: new Date(),
        }))
      );
    });
  }

  async getSignalsByComponentId(
    componentId: string,
    limit: number = 1000
  ): Promise<Signal[]> {
    if (!this.signalsCollection)
      throw new Error("Not connected to Data Lake");
    return await this.signalsCollection
      .find({ componentId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray() as unknown as Signal[];
  }

  async getSignalsByWorkItem(
    _workItemId: string,
    signalIds: string[]
  ): Promise<Signal[]> {
    if (!this.signalsCollection)
      throw new Error("Not connected to Data Lake");
    const signals = await this.signalsCollection
      .find({ id: { $in: signalIds } })
      .sort({ timestamp: -1 })
      .toArray() as unknown as Signal[];
    return signals;
  }

  async getRecentSignals(
    hours: number = 1,
    limit: number = 100
  ): Promise<Signal[]> {
    if (!this.signalsCollection)
      throw new Error("Not connected to Data Lake");
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const signals = await this.signalsCollection
      .find({ timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray() as unknown as Signal[];
    return signals;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      throw new Error("Not connected to Data Lake");
    }
    try {
      // Perform a simple operation to verify connection
      await this.db!.admin().ping();
      return true;
    } catch (error) {
      throw new Error(
        `MongoDB health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log("✓ Disconnected from Data Lake");
    }
  }
}
