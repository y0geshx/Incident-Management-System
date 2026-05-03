/**
 * State Pattern Implementation for Work Item State Management
 * Manages transitions: OPEN → INVESTIGATING → RESOLVED → CLOSED
 */

import { WorkItemState, WorkItem } from "../types";

export interface IWorkItemState {
  canTransitionTo(targetState: WorkItemState): boolean;
  getValidTransitions(): WorkItemState[];
  onEnter?(workItem: WorkItem): Promise<void>;
  onExit?(workItem: WorkItem): Promise<void>;
}

export class OpenState implements IWorkItemState {
  canTransitionTo(_targetState: WorkItemState): boolean {
    return _targetState === WorkItemState.INVESTIGATING;
  }

  getValidTransitions(): WorkItemState[] {
    return [WorkItemState.INVESTIGATING];
  }

  async onEnter(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} is now OPEN`);
  }

  async onExit(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} transitioning from OPEN`);
  }
}

export class InvestigatingState implements IWorkItemState {
  canTransitionTo(_targetState: WorkItemState): boolean {
    return (
      _targetState === WorkItemState.RESOLVED ||
      _targetState === WorkItemState.OPEN
    );
  }

  getValidTransitions(): WorkItemState[] {
    return [WorkItemState.RESOLVED, WorkItemState.OPEN];
  }

  async onEnter(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} is now INVESTIGATING`);
  }

  async onExit(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} transitioning from INVESTIGATING`);
  }
}

export class ResolvedState implements IWorkItemState {
  canTransitionTo(_targetState: WorkItemState): boolean {
    return _targetState === WorkItemState.CLOSED;
  }

  getValidTransitions(): WorkItemState[] {
    return [WorkItemState.CLOSED];
  }

  async onEnter(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} is now RESOLVED`);
  }

  async onExit(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} transitioning from RESOLVED`);
  }
}

export class ClosedState implements IWorkItemState {
  canTransitionTo(_targetState: WorkItemState): boolean {
    // Closed state is terminal - no further transitions
    return false;
  }

  getValidTransitions(): WorkItemState[] {
    return [];
  }

  async onEnter(_workItem: WorkItem): Promise<void> {
    console.log(`WorkItem ${_workItem.id} is now CLOSED - incident resolved`);
  }

  async onExit(_workItem: WorkItem): Promise<void> {
    // Cannot exit from closed state
    throw new Error("Cannot transition from CLOSED state");
  }
}

/**
 * State context that manages transitions
 */
export class WorkItemStateContext {
  private states: Map<WorkItemState, IWorkItemState>;

  constructor() {
    this.states = new Map([
      [WorkItemState.OPEN, new OpenState()],
      [WorkItemState.INVESTIGATING, new InvestigatingState()],
      [WorkItemState.RESOLVED, new ResolvedState()],
      [WorkItemState.CLOSED, new ClosedState()],
    ]);
  }

  getState(state: WorkItemState): IWorkItemState {
    const s = this.states.get(state);
    if (!s) {
      throw new Error(`Invalid state: ${state}`);
    }
    return s;
  }

  async setState(newState: WorkItemState, workItem: WorkItem): Promise<void> {
    const currentState = this.getState(workItem.status);

    if (!currentState.canTransitionTo(newState)) {
      throw new Error(
        `Cannot transition from ${workItem.status} to ${newState}`
      );
    }

    // Exit current state
    if (currentState.onExit) {
      await currentState.onExit(workItem);
    }

    // Enter target state
    const targetState = this.getState(newState);
    if (targetState.onEnter) {
      await targetState.onEnter(workItem);
    }
  }

  getValidTransitions(fromState: WorkItemState): WorkItemState[] {
    return this.getState(fromState).getValidTransitions();
  }
}
