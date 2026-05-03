import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/IncidentDetailPage.css';
import { RCAForm } from '../components/RCAForm';
import { SignalsList } from '../components/SignalsList';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem, Signal, IncidentStatus, RCAInput } from '../types';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [incident, setIncident] = useState<WorkItem | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'signals' | 'rca'>('details');
  const [statusTransitioning, setStatusTransitioning] = useState(false);

  const getBackToDashboardPath = (): string => {
    const params = new URLSearchParams();
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const component = searchParams.get('component');
    
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (component) params.set('component', component);
    
    const queryString = params.toString();
    return queryString ? `/?${queryString}` : '/';
  };

  useEffect(() => {
    if (id) {
      fetchIncidentDetail();
      fetchIncidentSignals();
    }
  }, [id]);

  const fetchIncidentDetail = async () => {
    try {
      setError('');
      if (!id) return;
      const data = await apiClient.getIncidentDetail(id);
      setIncident(data);
    } catch (err) {
      setError(`Failed to load incident details: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncidentSignals = async () => {
    try {
      if (!id) return;
      setSignalsLoading(true);
      const response = await apiClient.getIncidentSignals(id);
      setSignals(response.data);
    } catch (err) {
      setError(`Failed to load incident signals: ${getApiErrorMessage(err)}`);
    } finally {
      setSignalsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!id) return;
    setStatusTransitioning(true);
    try {
      const updated = await apiClient.updateIncidentStatus(id, newStatus);
      setIncident(updated);
    } catch (err) {
      alert(`Failed to update status: ${getApiErrorMessage(err)}`);
    } finally {
      setStatusTransitioning(false);
    }
  };

  const handleRCASubmit = async (rcaData: RCAInput) => {
    if (!id) {
      throw new Error('No incident ID provided');
    }
    if (!incident) {
      throw new Error('Incident data not available');
    }
    try {
      await apiClient.submitRCA(id, rcaData);
      // Refresh incident details
      await fetchIncidentDetail();
      setActiveTab('details');
    } catch (err) {
      throw new Error(getApiErrorMessage(err));
    }
  };

  if (loading) {
    return <div className="incident-detail loading">Loading incident details...</div>;
  }

  if (!incident) {
    return (
      <div className="incident-detail error">
        <h2>Incident not found</h2>
        <button onClick={() => navigate(getBackToDashboardPath())}>← Back to Dashboard</button>
      </div>
    );
  }

  const canSubmitRCA = incident.status === 'RESOLVED' && !incident.rca;
  const severityColor = {
    P0: '#d32f2f',
    P1: '#f57c00',
    P2: '#fbc02d',
    P3: '#1976d2',
  }[incident.severity] || '#757575';

  return (
    <div className="incident-detail">
      <header className="incident-detail-header">
        <button className="back-btn" onClick={() => navigate(getBackToDashboardPath())}>
          ← Back to Dashboard
        </button>
        <div className="incident-title">
          <h1>{incident.title}</h1>
          <div className="incident-meta">
            <span style={{ color: severityColor }} className="severity">
              {incident.severity}
            </span>
            <span className={`status status-${incident.status.toLowerCase()}`}>
              {incident.status}
            </span>
            <span className="component">{incident.componentType}: {incident.componentId}</span>
          </div>
        </div>
      </header>

      <div className="incident-tabs">
        <button
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`tab ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          Signals ({incident.signalCount})
        </button>
        {canSubmitRCA && (
          <button
            className={`tab ${activeTab === 'rca' ? 'active' : ''}`}
            onClick={() => setActiveTab('rca')}
          >
            RCA Form
          </button>
        )}
      </div>

      <div className="incident-content">
        {error && <div className="error-message">{error}</div>}

        {activeTab === 'details' && (
          <div className="details-tab">
            <div className="detail-section">
              <h3>Incident Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Description:</span>
                  <span className="value">{incident.description}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Component Type:</span>
                  <span className="value">{incident.componentType}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Component ID:</span>
                  <span className="value">{incident.componentId}</span>
                </div>
                <div className="detail-item">
                  <span className="label">First Signal:</span>
                  <span className="value">{new Date(incident.firstSignalTime).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Last Signal:</span>
                  <span className="value">{new Date(incident.lastSignalTime).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Signal Count:</span>
                  <span className="value">{incident.signalCount}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Assigned To:</span>
                  <span className="value">{incident.assignedTo || 'Unassigned'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Created:</span>
                  <span className="value">{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {incident.rca && (
              <div className="detail-section">
                <h3>Root Cause Analysis</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Category:</span>
                    <span className="value">{incident.rca.rootCauseCategory}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">MTTR:</span>
                    <span className="value">{incident.rca.mttr}s ({(incident.rca.mttr / 60).toFixed(2)}m)</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Fix Applied:</span>
                    <span className="value multiline">{incident.rca.fixApplied}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Prevention Steps:</span>
                    <span className="value multiline">{incident.rca.preventionSteps}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="status-actions">
              <h3>Change Status</h3>
              <div className="button-group">
                {incident.status === 'OPEN' && (
                  <button
                    onClick={() => handleStatusChange('INVESTIGATING')}
                    disabled={statusTransitioning}
                    className="btn-investigate"
                  >
                    Start Investigation
                  </button>
                )}
                {incident.status === 'INVESTIGATING' && (
                  <>
                    <button
                      onClick={() => handleStatusChange('RESOLVED')}
                      disabled={statusTransitioning}
                      className="btn-resolve"
                    >
                      Mark as Resolved
                    </button>
                    <button
                      onClick={() => handleStatusChange('OPEN')}
                      disabled={statusTransitioning}
                      className="btn-reopen"
                    >
                      Reopen
                    </button>
                  </>
                )}
                {incident.status === 'RESOLVED' && (
                  <button disabled className="btn-close" title="Fill RCA form to close">
                    Complete RCA to Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <SignalsList signals={signals} isLoading={signalsLoading} />
        )}

        {activeTab === 'rca' && canSubmitRCA && (
          <RCAForm
            onSubmit={handleRCASubmit}
          />
        )}
      </div>
    </div>
  );
};
