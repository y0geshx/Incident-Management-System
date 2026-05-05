import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/IncidentDetailPage.css';
import { RCAForm } from '../components/RCAForm';
import { SignalsList } from '../components/SignalsList';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem, Signal, IncidentStatus, RCAInput } from '../types';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [incident, setIncident] = useState<WorkItem | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'timeline' | 'rca'>('overview');
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

  // Setup realtime updates via WebSocket
  const handleIncidentUpdate = useCallback(
    (resourceId?: string) => {
      if (resourceId === id || !resourceId) {
        void fetchIncidentDetail();
      }
    },
    [id]
  );

  useRealtimeUpdates({
    onIncidentUpdated: handleIncidentUpdate,
    enabled: !!id,
  });

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
      setActiveTab('overview');
    } catch (err) {
      throw new Error(getApiErrorMessage(err));
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      OPEN: '#d32f2f',
      INVESTIGATING: '#f57c00',
      RESOLVED: '#2e7d32',
      CLOSED: '#1565c0'
    };
    return colors[status as keyof typeof colors] || '#757575';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      P0: '#d32f2f',
      P1: '#f57c00',
      P2: '#fbc02d',
      P3: '#1976d2',
    };
    return colors[severity as keyof typeof colors] || '#757575';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      OPEN: '🚨',
      INVESTIGATING: '🔍',
      RESOLVED: '✅',
      CLOSED: '🔒'
    };
    return icons[status as keyof typeof icons] || '❓';
  };

  const getSeverityIcon = (severity: string) => {
    const icons = {
      P0: '🔴',
      P1: '🟠',
      P2: '🟡',
      P3: '🔵',
    };
    return icons[severity as keyof typeof icons] || '⚪';
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  if (loading) {
    return (
      <div className="incident-detail">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-content"></div>
          <div className="skeleton-tabs"></div>
          <div className="skeleton-body"></div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="incident-detail error">
        <div className="error-icon">⚠️</div>
        <h2>Incident not found</h2>
        <p>The incident you're looking for doesn't exist or has been removed.</p>
        <button className="back-btn primary" onClick={() => navigate(getBackToDashboardPath())}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const canSubmitRCA = incident.status === 'RESOLVED' && !incident.rca;
  const incidentDuration = formatDuration(incident.firstSignalTime, incident.lastSignalTime);

  return (
    <div className="incident-detail">
      {/* Enhanced Header */}
      <header className="incident-detail-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(getBackToDashboardPath())}>
              ← Back to Dashboard
          </button>
        </div>

        <div className="header-center">
          <div className="incident-title-section">
            <div className="incident-title-row">
              <h1>{incident.title}</h1>
              <div className="incident-badges">
                <span className="badge severity" style={{ backgroundColor: getSeverityColor(incident.severity) }}>
                  {getSeverityIcon(incident.severity)} {incident.severity}
                </span>
                <span className="badge status" style={{ backgroundColor: getStatusColor(incident.status) }}>
                  {getStatusIcon(incident.status)} {incident.status}
                </span>
              </div>
            </div>
            <div className="incident-subtitle">
              <span className="component-info">
                {incident.componentType}: {incident.componentId}
              </span>
              <span className="duration-info">
                Duration: {incidentDuration}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="quick-stats">
            <div className="stat">
              <span className="stat-value">{incident.signalCount}</span>
              <span className="stat-label">Signals</span>
            </div>
            <div className="stat">
              <span className="stat-value">{new Date(incident.createdAt).toLocaleDateString()}</span>
              <span className="stat-label">Created</span>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Tabs */}
      <div className="incident-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
            📊 Overview
        </button>
        <button
          className={`tab ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
            📡 Signals ({incident.signalCount})
        </button>
        <button
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
            ⏱️ Timeline
        </button>
        {canSubmitRCA && (
          <button
            className={`tab ${activeTab === 'rca' ? 'active' : ''}`}
            onClick={() => setActiveTab('rca')}
          >
              🔍 RCA Form
          </button>
        )}
      </div>

      {/* Enhanced Content */}
      <div className="incident-content">
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError('')}>×</button>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Key Metrics Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📊</div>
                <div className="metric-content">
                  <div className="metric-value">{incident.signalCount}</div>
                  <div className="metric-label">Total Signals</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">⏱️</div>
                <div className="metric-content">
                  <div className="metric-value">{incidentDuration}</div>
                  <div className="metric-label">Duration</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">👤</div>
                <div className="metric-content">
                  <div className="metric-value">{incident.assignedTo || 'Unassigned'}</div>
                  <div className="metric-label">Assigned To</div>
                </div>
              </div>

              {incident.rca && (
                <div className="metric-card">
                  <div className="metric-icon">🎯</div>
                  <div className="metric-content">
                    <div className="metric-value">{Math.floor(incident.rca.mttr / 60)}m</div>
                    <div className="metric-label">MTTR</div>
                  </div>
                </div>
              )}
            </div>

            {/* Incident Details */}
            <div className="details-section">
              <h3>📋 Incident Details</h3>
              <div className="details-cards">
                <div className="detail-card">
                  <h4>Basic Information</h4>
                  <div className="detail-items">
                    <div className="detail-item">
                      <span className="label">Incident ID:</span>
                      <span className="value code">{incident.id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Component:</span>
                      <span className="value">{incident.componentType} - {incident.componentId}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Created:</span>
                      <span className="value">{new Date(incident.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Last Updated:</span>
                      <span className="value">{new Date(incident.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-card">
                  <h4>Signal Timeline</h4>
                  <div className="detail-items">
                    <div className="detail-item">
                      <span className="label">First Signal:</span>
                      <span className="value">{new Date(incident.firstSignalTime).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Last Signal:</span>
                      <span className="value">{new Date(incident.lastSignalTime).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Signal Frequency:</span>
                      <span className="value">
                        {incident.signalCount > 0
                          ? `${(incident.signalCount / ((new Date(incident.lastSignalTime).getTime() - new Date(incident.firstSignalTime).getTime()) / (1000 * 60))).toFixed(1)}/min`
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RCA Section */}
            {incident.rca && (
              <div className="details-section">
                <h3>🔍 Root Cause Analysis</h3>
                <div className="rca-card">
                  <div className="rca-header">
                    <span className="rca-category">{incident.rca.rootCauseCategory}</span>
                    <span className="rca-mttr">MTTR: {Math.floor(incident.rca.mttr / 60)}m {incident.rca.mttr % 60}s</span>
                  </div>
                  <div className="rca-content">
                    <div className="rca-section">
                      <h4>Fix Applied</h4>
                      <p>{incident.rca.fixApplied}</p>
                    </div>
                    <div className="rca-section">
                      <h4>Prevention Steps</h4>
                      <p>{incident.rca.preventionSteps}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Actions */}
            <div className="status-actions-section">
              <h3>⚡ Status Actions</h3>
              <div className="status-workflow">
                <div className={`workflow-step ${incident.status === 'OPEN' ? 'active' : incident.status === 'INVESTIGATING' || incident.status === 'RESOLVED' || incident.status === 'CLOSED' ? 'completed' : ''}`}>
                  <div className="step-icon">🚨</div>
                  <div className="step-label">Open</div>
                </div>
                <div className={`workflow-step ${incident.status === 'INVESTIGATING' ? 'active' : incident.status === 'RESOLVED' || incident.status === 'CLOSED' ? 'completed' : ''}`}>
                  <div className="step-icon">🔍</div>
                  <div className="step-label">Investigating</div>
                </div>
                <div className={`workflow-step ${incident.status === 'RESOLVED' ? 'active' : incident.status === 'CLOSED' ? 'completed' : ''}`}>
                  <div className="step-icon">✅</div>
                  <div className="step-label">Resolved</div>
                </div>
                <div className={`workflow-step ${incident.status === 'CLOSED' ? 'active' : ''}`}>
                  <div className="step-icon">🔒</div>
                  <div className="step-label">Closed</div>
                </div>
              </div>

              <div className="action-buttons">
                {incident.status === 'OPEN' && (
                  <button
                    onClick={() => handleStatusChange('INVESTIGATING')}
                    disabled={statusTransitioning}
                    className="btn-action primary"
                  >
                      {statusTransitioning ? (
                        <>
                          <span className="status-spinner" aria-hidden="true" />
                          Starting...
                        </>
                      ) : (
                        '🔍 Start Investigation'
                      )}
                  </button>
                )}
                {incident.status === 'INVESTIGATING' && (
                  <>
                    <button
                      onClick={() => handleStatusChange('RESOLVED')}
                      disabled={statusTransitioning}
                      className="btn-action success"
                    >
                        {statusTransitioning ? (
                          <>
                            <span className="status-spinner" aria-hidden="true" />
                            Resolving...
                          </>
                        ) : (
                          '✅ Mark as Resolved'
                        )}
                    </button>
                    <button
                      onClick={() => handleStatusChange('OPEN')}
                      disabled={statusTransitioning}
                      className="btn-action secondary"
                    >
                        {statusTransitioning ? (
                          <>
                            <span className="status-spinner" aria-hidden="true" />
                            Reopening...
                          </>
                        ) : (
                          '🔄 Reopen'
                        )}
                    </button>
                  </>
                )}
                {incident.status === 'RESOLVED' && (
                  <div className="rca-required-notice">
                    <span className="notice-icon">📝</span>
                    <span>RCA form must be completed to close this incident</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <SignalsList signals={signals} isLoading={signalsLoading} />
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-tab">
            <h3>⏱️ Incident Timeline</h3>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-marker created"></div>
                <div className="timeline-content">
                  <div className="timeline-title">Incident Created</div>
                  <div className="timeline-time">{new Date(incident.createdAt).toLocaleString()}</div>
                  <div className="timeline-desc">First signal received from {incident.componentId}</div>
                </div>
              </div>

              <div className="timeline-item">
                <div className="timeline-marker first-signal"></div>
                <div className="timeline-content">
                  <div className="timeline-title">First Signal</div>
                  <div className="timeline-time">{new Date(incident.firstSignalTime).toLocaleString()}</div>
                  <div className="timeline-desc">Initial signal detected</div>
                </div>
              </div>

              {incident.status !== 'OPEN' && (
                <div className="timeline-item">
                  <div className={`timeline-marker status-${incident.status.toLowerCase()}`}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">Status Changed</div>
                    <div className="timeline-time">{new Date(incident.updatedAt).toLocaleString()}</div>
                    <div className="timeline-desc">Status updated to {incident.status}</div>
                  </div>
                </div>
              )}

              {incident.rca && (
                <div className="timeline-item">
                  <div className="timeline-marker rca"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">RCA Completed</div>
                    <div className="timeline-time">{new Date(incident.rca.createdAt).toLocaleString()}</div>
                    <div className="timeline-desc">Root cause analysis submitted</div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
