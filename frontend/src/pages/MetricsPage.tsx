import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MetricsPage.css';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem } from '../types';
import { format, parseISO, startOfDay, subDays, eachDayOfInterval, differenceInHours } from 'date-fns';

export const MetricsPage: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('---');

  const trendDays = 7;
  const trendRange = useMemo(
    () => eachDayOfInterval({
      start: startOfDay(subDays(new Date(), trendDays - 1)),
      end: startOfDay(new Date()),
    }),
    [trendDays]
  );

  const incidentCreationCounts = useMemo(
    () =>
      trendRange.map((day) =>
        incidents.filter(
          (incident) => startOfDay(parseISO(incident.createdAt)).getTime() === day.getTime()
        ).length
      ),
    [incidents, trendRange]
  );

  const incidentResolutionCounts = useMemo(
    () =>
      trendRange.map((day) =>
        incidents.filter(
          (incident) =>
            (incident.status === 'RESOLVED' || incident.status === 'CLOSED') &&
            startOfDay(parseISO(incident.updatedAt)).getTime() === day.getTime()
        ).length
      ),
    [incidents, trendRange]
  );

  const trendsMaxCount = useMemo(
    () => Math.max(...incidentCreationCounts, ...incidentResolutionCounts, 1),
    [incidentCreationCounts, incidentResolutionCounts]
  );

  const weeklyCreated = incidentCreationCounts.reduce((sum, value) => sum + value, 0);
  const weeklyResolved = incidentResolutionCounts.reduce((sum, value) => sum + value, 0);
  const openCount = useMemo(
    () => incidents.filter((incident) => incident.status === 'OPEN' || incident.status === 'INVESTIGATING').length,
    [incidents]
  );
  const resolvedCount = useMemo(
    () => incidents.filter((incident) => incident.status === 'RESOLVED' || incident.status === 'CLOSED').length,
    [incidents]
  );

  const averageResolutionHours = useMemo(() => {
    const resolvedIncidents = incidents.filter(
      (incident) => (incident.status === 'RESOLVED' || incident.status === 'CLOSED') && incident.updatedAt
    );
    if (resolvedIncidents.length === 0) return 0;
    const totalHours = resolvedIncidents.reduce((sum, incident) => {
      const created = parseISO(incident.createdAt);
      const updated = parseISO(incident.updatedAt);
      return sum + differenceInHours(updated, created);
    }, 0);
    return totalHours / resolvedIncidents.length;
  }, [incidents]);

  const formattedTrendLabels = useMemo(
    () => trendRange.map((day) => format(day, 'EEE')),
    [trendRange]
  );

  const fetchIncidents = async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError('');
      const response = await apiClient.getIncidents();
      setIncidents(response.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(`Failed to load metrics: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  return (
    <div className="metrics-page">
      <header className="metrics-header">
        <button className="metrics-back-btn" onClick={() => navigate('/')}>Back to Dashboard</button>
        <div>
          <h1>📊 Incident Metrics</h1>
          <p>Monitor incident creation, resolution, and trend performance over the last 7 days.</p>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="metrics-controls">
        <span>Updated at {lastUpdated}</span>
        <button className="refresh-btn" onClick={() => fetchIncidents(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : '↻ Refresh metrics'}
        </button>
      </div>

      {loading ? (
        <div className="metrics-loading">Loading metrics...</div>
      ) : (
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Created in last {trendDays} days</div>
            <div className="metric-value">{weeklyCreated}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Resolved in last {trendDays} days</div>
            <div className="metric-value">{weeklyResolved}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Average resolution time</div>
            <div className="metric-value">{averageResolutionHours.toFixed(1)}h</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Open vs Resolved</div>
            <div className="metric-value">{openCount} / {resolvedCount}</div>
          </div>
        </section>
      )}

      {!loading && (
        <section className="trend-section">
          <div className="chart-card">
            <div className="chart-card-title">Incident creation trend</div>
            <div className="chart-bars">
              {formattedTrendLabels.map((label, index) => (
                <div key={`create-${label}`} className="chart-row">
                  <div className="chart-label">{label}</div>
                  <div className="chart-bar">
                    <div
                      className="chart-bar-fill create-fill"
                      style={{ width: `${(incidentCreationCounts[index] / trendsMaxCount) * 100}%` }}
                    >
                      {incidentCreationCounts[index] || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-title">Incident resolution trend</div>
            <div className="chart-bars">
              {formattedTrendLabels.map((label, index) => (
                <div key={`resolve-${label}`} className="chart-row">
                  <div className="chart-label">{label}</div>
                  <div className="chart-bar">
                    <div
                      className="chart-bar-fill resolve-fill"
                      style={{ width: `${(incidentResolutionCounts[index] / trendsMaxCount) * 100}%` }}
                    >
                      {incidentResolutionCounts[index] || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
