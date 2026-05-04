/**
 * Source of Truth Storage (PostgreSQL RDBMS)
 * Stores structured Work Items and RCA records with transactional guarantees
 */

import { Pool } from "pg";
import { WorkItem, RootCauseAnalysis, WorkItemState } from "../types";
import { retryWithBackoff } from "../utils/retryWithBackoff";

export class SourceOfTruthStore {
  private pool: Pool | null = null;

  async connect(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Promise<void> {
    this.pool = new Pool(config);

    // Test connection
    const client = await this.pool.connect();
    await client.release();

    // Create tables if they don't exist
    await this.createTables();
    console.log("✓ Connected to Source of Truth (PostgreSQL)");
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const client = await this.pool.connect();
    try {
      // Work Items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS work_items (
          id VARCHAR(36) PRIMARY KEY,
          component_id VARCHAR(255) NOT NULL,
          component_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          severity VARCHAR(5) NOT NULL,
          title VARCHAR(255),
          description TEXT,
          signal_ids TEXT[],
          signal_count INTEGER DEFAULT 0,
          first_signal_time TIMESTAMP NOT NULL,
          last_signal_time TIMESTAMP NOT NULL,
          assigned_to VARCHAR(255),
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          CONSTRAINT valid_status CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'))
        );
      `);

      // RCA table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rcas (
          id VARCHAR(36) PRIMARY KEY,
          work_item_id VARCHAR(36) NOT NULL UNIQUE,
          incident_start_time TIMESTAMP NOT NULL,
          incident_end_time TIMESTAMP NOT NULL,
          root_cause_category VARCHAR(255) NOT NULL,
          fix_applied TEXT,
          prevention_steps TEXT,
          mttr INTEGER,
          created_at TIMESTAMP NOT NULL,
          created_by VARCHAR(255),
          FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
        CREATE INDEX IF NOT EXISTS idx_work_items_component ON work_items(component_id);
        CREATE INDEX IF NOT EXISTS idx_work_items_created ON work_items(created_at DESC);
      `);

      console.log("✓ Database tables initialized");
    } finally {
      await client.release();
    }
  }

  async createWorkItem(workItem: WorkItem): Promise<void> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    await retryWithBackoff(async () => {
      const client = await this.pool!.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `INSERT INTO work_items (
            id, component_id, component_type, status, severity, title, description,
            signal_ids, signal_count, first_signal_time, last_signal_time, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            workItem.id,
            workItem.componentId,
            workItem.componentType,
            workItem.status,
            workItem.severity,
            workItem.title,
            workItem.description,
            workItem.signalIds,
            workItem.signalCount,
            workItem.firstSignalTime,
            workItem.lastSignalTime,
            workItem.createdAt,
            workItem.updatedAt,
          ]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        await client.release();
      }
    });
  }

  async updateWorkItem(workItem: WorkItem): Promise<void> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    await retryWithBackoff(async () => {
      const client = await this.pool!.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `UPDATE work_items SET
            status = $1, title = $2, description = $3,
            signal_ids = $4, signal_count = $5,
            last_signal_time = $6, assigned_to = $7, updated_at = $8
           WHERE id = $9`,
          [
            workItem.status,
            workItem.title,
            workItem.description,
            workItem.signalIds,
            workItem.signalCount,
            workItem.lastSignalTime,
            workItem.assignedTo,
            workItem.updatedAt,
            workItem.id,
          ]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        await client.release();
      }
    });
  }

  async getWorkItem(id: string): Promise<WorkItem | null> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT
        w.*,
        r.id AS rca_id,
        r.work_item_id AS rca_work_item_id,
        r.incident_start_time AS rca_incident_start_time,
        r.incident_end_time AS rca_incident_end_time,
        r.root_cause_category AS rca_root_cause_category,
        r.fix_applied AS rca_fix_applied,
        r.prevention_steps AS rca_prevention_steps,
        r.mttr AS rca_mttr,
        r.created_at AS rca_created_at,
        r.created_by AS rca_created_by
       FROM work_items w
       LEFT JOIN rcas r ON r.work_item_id = w.id
       WHERE w.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as any;
    return {
      id: row.id,
      componentId: row.component_id,
      componentType: row.component_type,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      signalIds: row.signal_ids,
      signalCount: row.signal_count,
      firstSignalTime: row.first_signal_time,
      lastSignalTime: row.last_signal_time,
      assignedTo: row.assigned_to,
      rca: row.rca_id
        ? {
            id: row.rca_id,
            workItemId: row.rca_work_item_id,
            incidentStartTime: row.rca_incident_start_time,
            incidentEndTime: row.rca_incident_end_time,
            rootCauseCategory: row.rca_root_cause_category,
            fixApplied: row.rca_fix_applied,
            preventionSteps: row.rca_prevention_steps,
            mttr: row.rca_mttr,
            createdAt: row.rca_created_at,
            createdBy: row.rca_created_by,
          }
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getWorkItemsByStatus(status: WorkItemState): Promise<WorkItem[]> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT * FROM work_items WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      componentId: row.component_id,
      componentType: row.component_type,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      signalIds: row.signal_ids,
      signalCount: row.signal_count,
      firstSignalTime: row.first_signal_time,
      lastSignalTime: row.last_signal_time,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getAllActiveWorkItems(): Promise<WorkItem[]> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT * FROM work_items WHERE status != 'CLOSED' ORDER BY created_at DESC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      componentId: row.component_id,
      componentType: row.component_type,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      signalIds: row.signal_ids,
      signalCount: row.signal_count,
      firstSignalTime: row.first_signal_time,
      lastSignalTime: row.last_signal_time,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getActiveWorkItemByComponentId(componentId: string): Promise<WorkItem | null> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT *
       FROM work_items
       WHERE component_id = $1 AND status != 'CLOSED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [componentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      componentId: row.component_id,
      componentType: row.component_type,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      signalIds: row.signal_ids,
      signalCount: row.signal_count,
      firstSignalTime: row.first_signal_time,
      lastSignalTime: row.last_signal_time,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async storeRCA(rca: RootCauseAnalysis): Promise<void> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    await retryWithBackoff(async () => {
      const client = await this.pool!.connect();
      try {
        await client.query("BEGIN");

        // Verify work item exists
        const workItem = await client.query(
          `SELECT id FROM work_items WHERE id = $1`,
          [rca.workItemId]
        );

        if (workItem.rows.length === 0) {
          throw new Error(`Work item ${rca.workItemId} not found`);
        }

        // Insert RCA
        await client.query(
          `INSERT INTO rcas (
            id, work_item_id, incident_start_time, incident_end_time,
            root_cause_category, fix_applied, prevention_steps, mttr, created_at, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            rca.id,
            rca.workItemId,
            rca.incidentStartTime,
            rca.incidentEndTime,
            rca.rootCauseCategory,
            rca.fixApplied,
            rca.preventionSteps,
            rca.mttr,
            rca.createdAt,
            rca.createdBy,
          ]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        await client.release();
      }
    });
  }

  async getRCA(workItemId: string): Promise<RootCauseAnalysis | null> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT * FROM rcas WHERE work_item_id = $1`,
      [workItemId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      workItemId: row.work_item_id,
      incidentStartTime: row.incident_start_time,
      incidentEndTime: row.incident_end_time,
      rootCauseCategory: row.root_cause_category,
      fixApplied: row.fix_applied,
      preventionSteps: row.prevention_steps,
      mttr: row.mttr,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  async getAllWorkItems(): Promise<WorkItem[]> {
    if (!this.pool) throw new Error("Not connected to Source of Truth");

    const result = await this.pool.query(
      `SELECT * FROM work_items ORDER BY created_at DESC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      componentId: row.component_id,
      componentType: row.component_type,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      signalIds: row.signal_ids,
      signalCount: row.signal_count,
      firstSignalTime: row.first_signal_time,
      lastSignalTime: row.last_signal_time,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async healthCheck(): Promise<boolean> {
    if (!this.pool) {
      throw new Error("Not connected to Source of Truth");
    }
    try {
      // Test connection by executing a simple query
      const result = await this.pool.query("SELECT 1");
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(
        `PostgreSQL health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log("✓ Disconnected from Source of Truth");
    }
  }
}
