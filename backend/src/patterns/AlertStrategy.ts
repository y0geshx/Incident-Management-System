/**
 * Strategy Pattern Implementation for Alerting
 * Different component failures require different alert strategies
 */

import { ComponentType, Severity, AlertChannel } from "../types";

export interface AlertStrategy {
  getAlertChannels(): AlertChannel[];
  getPriority(): Severity;
  formatMessage(componentId: string, error: string): string;
  getRecipient(): string;
}

/**
 * Strategy for RDBMS failures - P0 severity, immediate PagerDuty alert
 */
export class RdbmsAlertStrategy implements AlertStrategy {
  getAlertChannels(): AlertChannel[] {
    return [AlertChannel.PAGERDUTY, AlertChannel.EMAIL, AlertChannel.SMS];
  }

  getPriority(): Severity {
    return Severity.P0;
  }

  formatMessage(componentId: string, error: string): string {
    return `🚨 CRITICAL: RDBMS ${componentId} is down!\n${error}\nImmediate action required!`;
  }

  getRecipient(): string {
    return "oncall-dba@company.com";
  }
}

/**
 * Strategy for MCP/Queue failures - P1 severity
 */
export class McpQueueAlertStrategy implements AlertStrategy {
  getAlertChannels(): AlertChannel[] {
    return [AlertChannel.SLACK, AlertChannel.EMAIL];
  }

  getPriority(): Severity {
    return Severity.P1;
  }

  formatMessage(componentId: string, error: string): string {
    return `⚠️ HIGH: MCP/Queue ${componentId} has issues.\n${error}\nInvestigate soon.`;
  }

  getRecipient(): string {
    return "backend-team@company.com";
  }
}

/**
 * Strategy for Cache failures - P2 severity
 */
export class CacheAlertStrategy implements AlertStrategy {
  getAlertChannels(): AlertChannel[] {
    return [AlertChannel.SLACK];
  }

  getPriority(): Severity {
    return Severity.P2;
  }

  formatMessage(componentId: string, error: string): string {
    return `⏱️ MEDIUM: Cache ${componentId} degradation.\n${error}`;
  }

  getRecipient(): string {
    return "platform-team@company.com";
  }
}

/**
 * Strategy for API failures - P3 severity
 */
export class ApiAlertStrategy implements AlertStrategy {
  getAlertChannels(): AlertChannel[] {
    return [AlertChannel.EMAIL];
  }

  getPriority(): Severity {
    return Severity.P3;
  }

  formatMessage(componentId: string, error: string): string {
    return `ℹ️ LOW: API ${componentId} latency spike.\n${error}`;
  }

  getRecipient(): string {
    return "logs@company.com";
  }
}

/**
 * Factory to get appropriate alert strategy based on component type
 */
export class AlertStrategyFactory {
  static getStrategy(componentType: ComponentType): AlertStrategy {
    switch (componentType) {
      case ComponentType.RDBMS:
        return new RdbmsAlertStrategy();
      case ComponentType.MCP_HOST:
      case ComponentType.ASYNC_QUEUE:
        return new McpQueueAlertStrategy();
      case ComponentType.CACHE_CLUSTER:
        return new CacheAlertStrategy();
      case ComponentType.API:
      default:
        return new ApiAlertStrategy();
    }
  }
}
