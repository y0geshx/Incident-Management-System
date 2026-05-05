import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MetricsPage.css';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem } from '../types';
import { format, parseISO, startOfDay, subDays, eachDayOfInterval, differenceInHours } from 'date-fns';

const severityLevels = ['P0', 'P1', 'P2', 'P3'] as const;

export const MetricsPage: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('---');

  const trendDays = 7;
  const trendRange = useMemo(
    () =>
      eachDayOfInterval({
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

  const weeklyCreated = useMemo(
    () => incidentCreationCounts.reduce((sum, value) => sum + value, 0),
    [incidentCreationCounts]
  );

  const weeklyResolved = useMemo(
    () => incidentResolutionCounts.reduce((sum, value) => sum + value, 0),
    [incidentResolutionCounts]
  );

  const severityCounts = useMemo(
    () =>
      severityLevels.map((level) => incidents.filter((incident) => incident.severity === level).length),
    [incidents]
  );

  const topComponents = useMemo(() => {
    const counts = incidents.reduce<Record<string, number>>((acc, incident) => {
      acc[incident.componentType] = (acc[incident.componentType] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [incidents]);

  const openIncidents = useMemo(
    () => incidents.filter((incident) => incident.status === 'OPEN' || incident.status === 'INVESTIGATING'),
    [incidents]
  );

  const openCount = openIncidents.length;
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

  const averageOpenAgeHours = useMemo(() => {
    if (openIncidents.length === 0) return 0;
    const totalHours = openIncidents.reduce((sum, incident) => {
      const created = parseISO(incident.createdAt);
      return sum + differenceInHours(new Date(), created);
    }, 0);
    return totalHours / openIncidents.length;
  }, [openIncidents]);

  const trendsMaxCount = useMemo(
    () => Math.max(...incidentCreationCounts, ...incidentResolutionCounts, 1),
    [incidentCreationCounts, incidentResolutionCounts]
  );

  const formattedTrendLabels = useMemo(
    () => trendRange.map((day) => format(day, 'EEE')),
    [trendRange]
  );

  const openResolvedRatio = useMemo(() => {
    const total = openCount + resolvedCount;
    return total === 0 ? 0 : openCount / total;
  }, [openCount, resolvedCount]);

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
        <button className="metrics-back-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>
        <div>
          <h1>📊 Incident Metrics</h1>
          <p>Monitor incident creation, resolution, severity, and system impact with rich visual summaries.</p>
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
            <div className="metric-subtext">New incidents opened this week</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Resolved in last {trendDays} days</div>
            <div className="metric-value">{weeklyResolved}</div>
            <div className="metric-subtext">Incidents closed this week</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Average resolution time</div>
            <div className="metric-value">{averageResolutionHours.toFixed(1)}h</div>
            <div className="metric-subtext">Across resolved incidents</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Open incidents</div>
            <div className="metric-value">{openCount}</div>
            <div className="metric-subtext">Currently active issues</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Avg open incident age</div>
            <div className="metric-value">{averageOpenAgeHours.toFixed(1)}h</div>
            <div className="metric-subtext">How long active incidents have been live</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Severity hot spot</div>
            <div className="metric-value">{severityCounts[0]}</div>
            <div className="metric-subtext">P0 incidents in current dataset</div>
          </div>
        </section>
      )}

      {!loading && (
        <>
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

          <section className="detail-section">
            <div className="chart-card severity-card">
              <div className="chart-card-title">Severity distribution</div>
              <div className="severity-list">
                {severityLevels.map((level, index) => (
                  <div key={level} className="severity-pill">
                    <span className="severity-tag">{level}</span>
                    <span>{severityCounts[index]} incidents</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card component-card">
              <div className="chart-card-title">Top impacted systems</div>
              <div className="component-list">
                {topComponents.length > 0 ? (
                  topComponents.map(([component, count]) => (
                    <div key={component} className="component-row">
                      <div className="component-name">{component}</div>
                      <div className="component-bar-track">
                        <div
                          className="component-bar-fill"
                          style={{ width: `${(count / Math.max(...topComponents.map(([, value]) => value))) * 100}%` }}
                        />
                      </div>
                      <div className="component-count">{count}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No incidents to analyze yet.</div>
                )}
              </div>
            </div>

            <div className="chart-card ratio-card">
              <div className="chart-card-title">Open vs Resolved ratio</div>
              <div
                className="ratio-chart"
                style={{
                  background: `conic-gradient(#4f46e5 0 ${(openResolvedRatio || 0) * 360}deg, #10b981 ${(openResolvedRatio || 0) * 360}deg 360deg)`,
                }}
              >
                <div className="ratio-center">
                  <span>{openCount}</span>
                  <small>open</small>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
