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
        stackTrace: form.stackTrace?.trim() || undefined,
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
        <button className="back-btn" onClick={() => navigate('/')}>
          <span>←</span> Back
        </button>
        <div className="header-content">
          <h1>Create New Incident</h1>
          <p className="header-subtitle">Report and track a new incident in your system</p>
        </div>
      </header>

      <form className="new-incident-form" onSubmit={handleSubmit}>
        {error && (
          <div className="form-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Basic Information Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Basic Information</h2>
            <p className="section-description">Core incident details</p>
          </div>

          <div className="form-row full-width">
            <label htmlFor="title">
              Incident Title <span className="required-indicator">*</span>
            </label>
            <p className="field-hint">Give your incident a clear, descriptive title</p>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Database Connection Pool Exhaustion"
              required
            />
          </div>

          <div className="form-row full-width">
            <label htmlFor="description">
              Description <span className="required-indicator">*</span>
            </label>
            <p className="field-hint">Provide detailed information about what happened</p>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe the incident: what was affected, when it occurred, and what you observed..."
              rows={4}
              required
            />
          </div>
        </div>

        {/* Error Information Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Error Information</h2>
            <p className="section-description">Specific error details</p>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="errorCode">
                Error Code <span className="required-indicator">*</span>
              </label>
              <p className="field-hint">Unique error identifier</p>
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
              <label htmlFor="errorMessage">
                Error Message <span className="required-indicator">*</span>
              </label>
              <p className="field-hint">Full error message text</p>
              <input
                id="errorMessage"
                name="errorMessage"
                value={form.errorMessage}
                onChange={handleChange}
                placeholder="All connections in pool exhausted..."
                required
              />
            </div>
          </div>
        </div>

        {/* Component Information Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Component Information</h2>
            <p className="section-description">Affected system component</p>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="componentType">Component Type</label>
              <p className="field-hint">Select the affected component</p>
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
              <label htmlFor="componentId">
                Component ID <span className="required-indicator">*</span>
              </label>
              <p className="field-hint">Unique identifier for the component instance</p>
              <input
                id="componentId"
                name="componentId"
                value={form.componentId}
                onChange={handleChange}
                placeholder="e.g., API_GATEWAY_01"
                required
              />
            </div>
          </div>
        </div>

        {/* Severity and Performance Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Impact Assessment</h2>
            <p className="section-description">Severity level and performance metrics</p>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="severity">Severity Level</label>
              <p className="field-hint">Priority level of this incident</p>
              <div className="severity-selector">
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
                <span className={`severity-badge severity-${form.severity.toLowerCase()}`}>
                  {form.severity}
                </span>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="latencyInput">Latency <span className="optional-indicator">(optional)</span></label>
              <p className="field-hint">Response time in milliseconds</p>
              <input
                id="latencyInput"
                name="latencyInput"
                value={form.latencyInput}
                onChange={handleChange}
                placeholder="30000"
                type="number"
              />
            </div>
          </div>
        </div>

        {/* Additional Details Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Additional Details</h2>
            <p className="section-description">Optional technical and diagnostic information</p>
          </div>

          <div className="form-grid full-width-grid">
            <div className="form-row full-width">
              <label htmlFor="stackTrace">
                Stack Trace <span className="optional-indicator">(optional)</span>
              </label>
              <p className="field-hint">Error stack trace for debugging</p>
              <textarea
                id="stackTrace"
                name="stackTrace"
                value={form.stackTrace}
                onChange={handleChange}
                placeholder="Error: Connection timeout&#10;    at DatabasePool.getConnection (db/pool.ts:45:12)"
                rows={3}
              />
            </div>

            <div className="form-row full-width">
              <label htmlFor="metadataJson">
                Metadata <span className="optional-indicator">(optional, JSON)</span>
              </label>
              <p className="field-hint">Additional context as JSON (e.g., pool stats, resource usage)</p>
              <textarea
                id="metadataJson"
                name="metadataJson"
                value={form.metadataJson}
                onChange={handleChange}
                placeholder='{"poolSize":100,"activeConnections":100,"waitingRequests":5432}'
                rows={4}
              />
            </div>

            <div className="form-row full-width">
              <label htmlFor="assignedTo">
                Assigned To <span className="optional-indicator">(optional)</span>
              </label>
              <p className="field-hint">Team member handling this incident</p>
              <input
                id="assignedTo"
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                placeholder="engineer@company.com"
              />
            </div>
          </div>
        </div>

        <div className="submit-row">
          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner"></span>
                Creating Incident...
              </>
            ) : (
              <>
                <span>✓</span> Create Incident
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
