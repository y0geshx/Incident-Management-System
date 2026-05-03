import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ApiDocsPage.css';

const signalExample = `curl -X POST http://localhost:3001/api/signals \\
  -H "Content-Type: application/json" \\
  -d '{
    "componentId": "RDBMS_CLUSTER_01",
    "componentType": "RDBMS",
    "errorCode": "CONNECTION_POOL_EXHAUSTED",
    "errorMessage": "All connections in pool exhausted. Database unavailable.",
    "severity": "P0"
  }'`;

const incidentsExample = `curl http://localhost:3001/api/incidents`;

const statusTransitionExample = `curl -X PUT http://localhost:3001/api/incidents/{incidentId}/status \\
  -H "Content-Type: application/json" \\
  -d '{"status": "INVESTIGATING"}'`;

const rcaExample = `curl -X POST http://localhost:3001/api/incidents/{incidentId}/rca \\
  -H "Content-Type: application/json" \\
  -d '{
    "incidentStartTime": "2024-01-15T10:00:00Z",
    "incidentEndTime": "2024-01-15T10:30:00Z",
    "rootCauseCategory": "Database Failure",
    "fixApplied": "Restarted PostgreSQL cluster and restored from backup.",
    "preventionSteps": "Add failover and connection pool monitoring.",
    "createdBy": "john.doe@company.com"
  }'`;

const healthExample = `curl http://localhost:3001/api/health`;

export const ApiDocsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="api-docs-page">
      <header className="api-docs-header">
        <button className="api-docs-back-btn" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
        <h1>API Documentation</h1>
        <p>Reference for incident, signals, RCA, and health endpoints.</p>
      </header>

      <main className="api-docs-content">
        <section className="api-docs-section">
          <h2>Base URL</h2>
          <code>http://localhost:3001/api</code>
        </section>

        <section className="api-docs-section">
          <h2>Signal Ingestion</h2>
          <ul>
            <li><strong>POST</strong> /signals</li>
            <li><strong>POST</strong> /signals/batch</li>
          </ul>
          <pre>{signalExample}</pre>
        </section>

        <section className="api-docs-section">
          <h2>Incident Management</h2>
          <ul>
            <li><strong>GET</strong> /incidents</li>
            <li><strong>GET</strong> /incidents/{'{incidentId}'}</li>
            <li><strong>PUT</strong> /incidents/{'{incidentId}'}/status</li>
            <li><strong>POST</strong> /incidents/{'{incidentId}'}/rca</li>
          </ul>
          <pre>{incidentsExample}</pre>
          <pre>{statusTransitionExample}</pre>
          <pre>{rcaExample}</pre>
        </section>

        <section className="api-docs-section">
          <h2>Health Check</h2>
          <ul>
            <li><strong>GET</strong> /health</li>
          </ul>
          <pre>{healthExample}</pre>
        </section>

        <section className="api-docs-section">
          <h2>Status Flow</h2>
          <p>OPEN -&gt; INVESTIGATING -&gt; RESOLVED -&gt; CLOSED</p>
          <p>INVESTIGATING can also transition back to OPEN.</p>
          <p>CLOSED is a terminal state and requires complete RCA submission.</p>
        </section>
      </main>
    </div>
  );
};
