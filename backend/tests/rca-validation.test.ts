/**
 * Unit Tests for RCA Validation Logic
 * Tests mandatory field validation and business logic
 */

import { v4 as uuidv4 } from "uuid";
import { RootCauseAnalysis, WorkItemState } from "../src/types";

describe("RCA Validation Logic", () => {
  describe("RCA Field Validation", () => {
    test("should reject RCA with missing rootCauseCategory", () => {
      const invalidRCA = {
        incidentStartTime: new Date(),
        incidentEndTime: new Date(),
        rootCauseCategory: "", // Empty
        fixApplied: "Restarted service",
        preventionSteps: "Add monitoring",
      };

      expect(validateRCA(invalidRCA)).toBe(false);
    });

    test("should reject RCA with missing fixApplied", () => {
      const invalidRCA = {
        incidentStartTime: new Date(),
        incidentEndTime: new Date(),
        rootCauseCategory: "Database Failure",
        fixApplied: "", // Empty
        preventionSteps: "Add monitoring",
      };

      expect(validateRCA(invalidRCA)).toBe(false);
    });

    test("should reject RCA with missing preventionSteps", () => {
      const invalidRCA = {
        incidentStartTime: new Date(),
        incidentEndTime: new Date(),
        rootCauseCategory: "Database Failure",
        fixApplied: "Restarted service",
        preventionSteps: "", // Empty
      };

      expect(validateRCA(invalidRCA)).toBe(false);
    });

    test("should accept valid RCA with all fields", () => {
      const validRCA = {
        incidentStartTime: new Date("2024-01-15T10:00:00Z"),
        incidentEndTime: new Date("2024-01-15T10:30:00Z"),
        rootCauseCategory: "Database Failure",
        fixApplied: "Restarted PostgreSQL cluster",
        preventionSteps: "Implement connection pool monitoring",
      };

      expect(validateRCA(validRCA)).toBe(true);
    });
  });

  describe("MTTR Calculation", () => {
    test("should correctly calculate MTTR in seconds", () => {
      const start = new Date("2024-01-15T10:00:00Z");
      const end = new Date("2024-01-15T10:30:00Z");

      const mttr = calculateMTTR(start, end);
      expect(mttr).toBe(1800); // 30 minutes = 1800 seconds
    });

    test("should calculate MTTR for longer durations", () => {
      const start = new Date("2024-01-15T10:00:00Z");
      const end = new Date("2024-01-15T12:15:30Z");

      const mttr = calculateMTTR(start, end);
      expect(mttr).toBe(8130); // 2 hours 15 minutes 30 seconds
    });

    test("should handle MTTR less than one minute", () => {
      const start = new Date("2024-01-15T10:00:00Z");
      const end = new Date("2024-01-15T10:00:45Z");

      const mttr = calculateMTTR(start, end);
      expect(mttr).toBe(45);
    });
  });

  describe("RCA Completion Validation", () => {
    test("should prevent closing incident without RCA", () => {
      const canClose = canCloseIncident(
        WorkItemState.RESOLVED,
        null // No RCA
      );
      expect(canClose).toBe(false);
    });

    test("should allow closing incident with complete RCA", () => {
      const rca: Partial<RootCauseAnalysis> = {
        id: uuidv4(),
        rootCauseCategory: "Database Failure",
        fixApplied: "Restarted cluster",
        preventionSteps: "Add monitoring",
      };

      const canClose = canCloseIncident(WorkItemState.RESOLVED, rca);
      expect(canClose).toBe(true);
    });

    test("should allow manual transition to RESOLVED without RCA", () => {
      const canTransition = canTransitionTo(
        WorkItemState.INVESTIGATING,
        WorkItemState.RESOLVED,
        null // No RCA required for RESOLVED state
      );
      expect(canTransition).toBe(true);
    });

    test("should prevent transition to CLOSED without RCA", () => {
      const canTransition = canTransitionTo(
        WorkItemState.RESOLVED,
        WorkItemState.CLOSED,
        null // No RCA
      );
      expect(canTransition).toBe(false);
    });
  });
});

// Helper functions
function validateRCA(rca: any): boolean {
  return !!(
    rca.rootCauseCategory &&
    rca.rootCauseCategory.trim() !== "" &&
    rca.fixApplied &&
    rca.fixApplied.trim() !== "" &&
    rca.preventionSteps &&
    rca.preventionSteps.trim() !== ""
  );
}

function calculateMTTR(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

function canCloseIncident(
  currentState: WorkItemState,
  rca: Partial<RootCauseAnalysis> | null
): boolean {
  return currentState === WorkItemState.RESOLVED && !!rca;
}

function canTransitionTo(
  currentState: WorkItemState,
  targetState: WorkItemState,
  rca: Partial<RootCauseAnalysis> | null
): boolean {
  if (targetState === WorkItemState.CLOSED && !rca) {
    return false;
  }

  // Implement other transition rules as needed
  const validTransitions: Record<WorkItemState, WorkItemState[]> = {
    [WorkItemState.OPEN]: [WorkItemState.INVESTIGATING],
    [WorkItemState.INVESTIGATING]: [
      WorkItemState.RESOLVED,
      WorkItemState.OPEN,
    ],
    [WorkItemState.RESOLVED]: [WorkItemState.CLOSED],
    [WorkItemState.CLOSED]: [],
  };

  return validTransitions[currentState].includes(targetState);
}

export { validateRCA, calculateMTTR, canCloseIncident, canTransitionTo };
