import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/NewIncidentPage.css';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { CreateIncidentInput, SeverityLevel } from '../types';

const componentOptions = [
  'API',
  'MCP_HOST',
  'CACHE_CLUSTER',
  'ASYNC_QUEUE',
  'RDBMS',
  'NOSQL_STORE',
];

const severityOptions: SeverityLevel[] = ['P0', 'P1', 'P2', 'P3'];

export const NewIncidentPage: React.FC = () => {
  const navigate = useNavigate();
  type NewIncidentFormState = CreateIncidentInput & {
    metadataJson: string;
    latencyInput: string;
  };

  const [form, setForm] = useState<NewIncidentFormState>({
    title: '',
    description: '',
    componentType: componentOptions[0],
    componentId: '',
    severity: 'P1',
    errorCode: '',
    errorMessage: '',
    metadata: {},
    metadataJson: '{"poolSize":100,"activeConnections":100,"waitingRequests":5432}',
    stackTrace: '',
    latency: undefined,
    latencyInput: '30000',
    assignedTo: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.componentId.trim() ||
      !form.errorCode.trim() ||
      !form.errorMessage.trim()
    ) {
      setError('Title, description, component ID, error code, and error message are required.');
      return;
    }

    let metadata: Record<string, unknown> = {};
    if (form.metadataJson.trim()) {
      try {
        metadata = JSON.parse(form.metadataJson);
      } catch (err) {
        setError('Metadata must be valid JSON.');
        return;
      }
    }

    const latency = form.latencyInput.trim() ? Number(form.latencyInput) : undefined;
    if (form.latencyInput.trim() && Number.isNaN(latency)) {
      setError('Latency must be a valid number.');
      return;
    }

    setSubmitting(true);

    try {
      const createdIncident = await apiClient.createIncident({
        title: form.title.trim(),
        description: form.description.trim(),
        componentType: form.componentType,
        componentId: form.componentId.trim(),
        severity: form.severity,
        errorCode: form.errorCode.trim(),
        errorMessage: form.errorMessage.trim(),
        metadata,
        stackTrace: form.stackTrace.trim() || undefined,
        latency,
        assignedTo: form.assignedTo?.trim() || undefined,
      });

      navigate(`/incident/${createdIncident.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-incident-page">
      <header className="new-incident-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>
        <h1>Create New Incident</h1>
      </header>

      <form className="new-incident-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-row">
          <label htmlFor="title">Incident Title</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Enter an incident title"
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the incident"
            rows={5}
            required
          />
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="errorCode">Error Code</label>
            <input
              id="errorCode"
              name="errorCode"
              value={form.errorCode}
              onChange={handleChange}
              placeholder="CONNECTION_POOL_EXHAUSTED"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="errorMessage">Error Message</label>
            <input
              id="errorMessage"
              name="errorMessage"
              value={form.errorMessage}
              onChange={handleChange}
              placeholder="All connections in pool exhausted. Database unavailable."
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="componentType">Component Type</label>
            <select
              id="componentType"
              name="componentType"
              value={form.componentType}
              onChange={handleChange}
            >
              {componentOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="componentId">Component ID</label>
            <input
              id="componentId"
              name="componentId"
              value={form.componentId}
              onChange={handleChange}
              placeholder="e.g. API_GATEWAY_01"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="severity">Severity</label>
            <select
              id="severity"
              name="severity"
              value={form.severity}
              onChange={handleChange}
            >
              {severityOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="latencyInput">Latency (ms)</label>
            <input
              id="latencyInput"
              name="latencyInput"
              value={form.latencyInput}
              onChange={handleChange}
              placeholder="30000"
            />
          </div>

          <div className="form-row">
            <label htmlFor="stackTrace">Stack Trace</label>
            <textarea
              id="stackTrace"
              name="stackTrace"
              value={form.stackTrace}
              onChange={handleChange}
              placeholder="Error: Connection timeout\n    at DatabasePool.getConnection (db/pool.ts:45:12)"
              rows={4}
            />
          </div>

          <div className="form-row">
            <label htmlFor="metadataJson">Metadata</label>
            <textarea
              id="metadataJson"
              name="metadataJson"
              value={form.metadataJson}
              onChange={handleChange}
              placeholder='{"poolSize":100,"activeConnections":100,"waitingRequests":5432}'
              rows={5}
            />
          </div>

          <div className="form-row">
            <label htmlFor="assignedTo">Assigned To</label>
            <input
              id="assignedTo"
              name="assignedTo"
              value={form.assignedTo}
              onChange={handleChange}
              placeholder="Optional assignee"
            />
          </div>
        </div>

        <div className="submit-row">
          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Creating Incident...' : 'Create Incident'}
          </button>
        </div>
      </form>
    </div>
  );
};
