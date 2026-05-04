import axios, { AxiosInstance } from 'axios';
import { WorkItem, RootCauseAnalysis, Signal, RCAInput } from '../types';

const apiBaseUrl = '/api';

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const response = error.response;
    const body = response?.data as Record<string, unknown> | undefined;
    const apiMessage =
      body && typeof body === 'object' && typeof body.error === 'string'
        ? body.error
        : undefined;
    if (apiMessage) return apiMessage;
    if (response) return `${response.status} ${response.statusText}`.trim();
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

class IMSApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getIncidents(): Promise<{ data: WorkItem[]; total: number }> {
    const response = await this.client.get<{ data: WorkItem[]; total: number }>('/incidents');
    return response.data;
  }

  async getIncidentDetail(id: string): Promise<WorkItem> {
    const response = await this.client.get<WorkItem>(`/incidents/${id}`);
    return response.data;
  }

  async createIncident(data: {
    title: string;
    description: string;
    componentType: string;
    componentId: string;
    severity: string;
    errorCode: string;
    errorMessage: string;
    metadata: Record<string, unknown>;
    stackTrace?: string;
    latency?: number;
    assignedTo?: string;
  }): Promise<WorkItem> {
    const response = await this.client.post<WorkItem>('/incidents', data);
    return response.data;
  }

  async emitRandomSignal(data?: {
    componentType?: string;
    severity?: string;
  }): Promise<{ message: string; signal: Signal }> {
    const response = await this.client.post<{ message: string; signal: Signal }>('/signals/random', data ?? {});
    return response.data;
  }

  async simulateCascadingFailure(): Promise<{ message: string; count: number }> {
    const response = await this.client.post<{ message: string; count: number }>('/signals/cascading-failure', {});
    return response.data;
  }

  async getIncidentSignals(id: string): Promise<{ data: Signal[]; total: number }> {
    const response = await this.client.get<{ data: Signal[]; total: number }>(`/incidents/${id}/signals`);
    return response.data;
  }

  async updateIncidentStatus(id: string, status: string): Promise<WorkItem> {
    const response = await this.client.put<WorkItem>(`/incidents/${id}/status`, { status });
    return response.data;
  }

  async submitRCA(
    id: string,
    data: RCAInput
  ): Promise<{ message: string; rca: RootCauseAnalysis }> {
    if (!id || id.trim() === '') {
      throw new Error('Invalid incident ID');
    }
    const response = await this.client.post<{ message: string; rca: RootCauseAnalysis }>(
      `/incidents/${id}/rca`,
      data
    );
    return response.data;
  }

  async getHealth(): Promise<any> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const apiClient = new IMSApiClient();
