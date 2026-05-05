import { IncidentManagementService } from "../src/services/IncidentManagementService";
import { ComponentType, Severity, WorkItemState } from "../src/types";

describe("incident realtime broadcasts", () => {
  const makeStores = () => ({
    sourceOfTruthStore: {
      createWorkItem: jest.fn().mockResolvedValue(undefined),
      updateWorkItem: jest.fn().mockResolvedValue(undefined),
      getWorkItem: jest.fn().mockResolvedValue(null),
      getRCA: jest.fn().mockResolvedValue(null),
      storeRCA: jest.fn().mockResolvedValue(undefined),
    },
    cacheStore: {
      setWorkItem: jest.fn().mockResolvedValue(undefined),
      deleteWorkItem: jest.fn().mockResolvedValue(undefined),
    },
    broadcaster: {
      broadcast: jest.fn(),
    },
  });

  test("broadcasts when an incident is created", async () => {
    const { sourceOfTruthStore, cacheStore, broadcaster } = makeStores();
    const service = new IncidentManagementService(
      sourceOfTruthStore as any,
      cacheStore as any,
      broadcaster as any
    );

    await service.createIncident({
      componentId: "API_GATEWAY_01",
      componentType: ComponentType.API,
      severity: Severity.P1,
      title: "New incident",
      description: "Created during test",
    });

    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "api-change",
        resource: "incident",
        action: "created",
        resourceId: expect.any(String),
      })
    );
  });

  test("broadcasts when an incident transitions state", async () => {
    const { sourceOfTruthStore, cacheStore, broadcaster } = makeStores();
    sourceOfTruthStore.getWorkItem.mockResolvedValue({
      id: "inc-1",
      componentId: "API_GATEWAY_01",
      componentType: ComponentType.API,
      status: WorkItemState.OPEN,
      severity: Severity.P1,
      title: "Incident",
      description: "Test",
      signalIds: [],
      signalCount: 0,
      firstSignalTime: new Date(),
      lastSignalTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sourceOfTruthStore.getRCA.mockResolvedValue({
      id: "rca-1",
      workItemId: "inc-1",
      incidentStartTime: new Date(),
      incidentEndTime: new Date(),
      rootCauseCategory: "Test",
      fixApplied: "Fixed",
      preventionSteps: "Prevent",
      mttr: 1,
      createdAt: new Date(),
      createdBy: "tester",
    });

    const service = new IncidentManagementService(
      sourceOfTruthStore as any,
      cacheStore as any,
      broadcaster as any
    );

    await service.transitionWorkItemState("inc-1", WorkItemState.INVESTIGATING);

    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "api-change",
        resource: "incident",
        action: "updated",
        resourceId: "inc-1",
      })
    );
  });
});