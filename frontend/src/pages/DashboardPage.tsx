import React, { useState, useEffect } from 'react';
import '../styles/DashboardPage.css';
import { IncidentCard } from '../components/IncidentCard';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState<string>(searchParams.get('severity') || 'all');
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get('component') || 'all');
  const [lastUpdated, setLastUpdated] = useState<string>('---');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchIncidents();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(() => fetchIncidents(), 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchIncidents = async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      // Fetch all incidents including closed ones
      const data = await apiClient.getIncidents();
      // Sort by severity (P0 first) and then by most recent
      const sorted = data.data.sort((a, b) => {
        const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const severityDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setIncidents(sorted);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(`Failed to load incidents: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterIncidents = (): WorkItem[] => {
    let filtered = incidents;
    if (filter !== 'all') {
      filtered = filtered.filter((i) => i.status === filter);
    }
    if (severityFilter !== 'all') {
      filtered = filtered.filter((i) => i.severity === severityFilter);
    }
    if (tagFilter !== 'all') {
      filtered = filtered.filter((i) => i.componentType === tagFilter);
    }
    return filtered;
  };

  const handleIncidentClick = (id: string) => {
    navigate(`/incident/${id}`);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    updateSearchParams({ status: value !== 'all' ? value : null });
  };

  const handleSeverityChange = (value: string) => {
    setSeverityFilter(value);
    updateSearchParams({ severity: value !== 'all' ? value : null });
  };

  const handleTagChange = (value: string) => {
    setTagFilter(value);
    updateSearchParams({ component: value !== 'all' ? value : null });
  };

  const updateSearchParams = (params: { status?: string | null; severity?: string | null; component?: string | null }) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  };

  const handleAutoRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
  };

  const filteredIncidents = filterIncidents();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>🚨 Incident Management System</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Active</span>
            <span className="stat-value">{incidents.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">P0 (Critical)</span>
            <span className="stat-value">{incidents.filter((i) => i.severity === 'P0').length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">P1 (High)</span>
            <span className="stat-value">{incidents.filter((i) => i.severity === 'P1').length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">P2 (Medium)</span>
            <span className="stat-value">{incidents.filter((i) => i.severity === 'P2').length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">P3 (Low)</span>
            <span className="stat-value">{incidents.filter((i) => i.severity === 'P3').length}</span>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="dashboard-controls">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All ({incidents.length})
          </button>
          <button
            className={`filter-btn ${filter === 'OPEN' ? 'active' : ''}`}
            onClick={() => handleFilterChange('OPEN')}
          >
            Open ({incidents.filter((i) => i.status === 'OPEN').length})
          </button>
          <button
            className={`filter-btn ${filter === 'INVESTIGATING' ? 'active' : ''}`}
            onClick={() => handleFilterChange('INVESTIGATING')}
          >
            Investigating ({incidents.filter((i) => i.status === 'INVESTIGATING').length})
          </button>
          <button
            className={`filter-btn ${filter === 'RESOLVED' ? 'active' : ''}`}
            onClick={() => handleFilterChange('RESOLVED')}
          >
            Resolved ({incidents.filter((i) => i.status === 'RESOLVED').length})
          </button>
          <button
            className={`filter-btn ${filter === 'CLOSED' ? 'active' : ''}`}
            onClick={() => handleFilterChange('CLOSED')}
          >
            Closed ({incidents.filter((i) => i.status === 'CLOSED').length})
          </button>
        </div>
        <div className="filter-buttons severity-filters">
          <button
            className={`filter-btn ${severityFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleSeverityChange('all')}
          >
            All Severities
          </button>
          <button
            className={`filter-btn ${severityFilter === 'P0' ? 'active' : ''}`}
            onClick={() => handleSeverityChange('P0')}
          >
            P0
          </button>
          <button
            className={`filter-btn ${severityFilter === 'P1' ? 'active' : ''}`}
            onClick={() => handleSeverityChange('P1')}
          >
            P1
          </button>
          <button
            className={`filter-btn ${severityFilter === 'P2' ? 'active' : ''}`}
            onClick={() => handleSeverityChange('P2')}
          >
            P2
          </button>
          <button
            className={`filter-btn ${severityFilter === 'P3' ? 'active' : ''}`}
            onClick={() => handleSeverityChange('P3')}
          >
            P3
          </button>
        </div>
        <div className="filter-buttons component-filters">
          <button
            className={`filter-btn ${tagFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleTagChange('all')}
          >
            All Components
          </button>
          <button
            className={`filter-btn ${tagFilter === 'API' ? 'active' : ''}`}
            onClick={() => handleTagChange('API')}
          >
            API
          </button>
          <button
            className={`filter-btn ${tagFilter === 'RDBMS' ? 'active' : ''}`}
            onClick={() => handleTagChange('RDBMS')}
          >
            RDBMS
          </button>
          <button
            className={`filter-btn ${tagFilter === 'CACHE_CLUSTER' ? 'active' : ''}`}
            onClick={() => handleTagChange('CACHE_CLUSTER')}
          >
            Cache
          </button>
          <button
            className={`filter-btn ${tagFilter === 'ASYNC_QUEUE' ? 'active' : ''}`}
            onClick={() => handleTagChange('ASYNC_QUEUE')}
          >
            Queue
          </button>
          <button
            className={`filter-btn ${tagFilter === 'NOSQL_STORE' ? 'active' : ''}`}
            onClick={() => handleTagChange('NOSQL_STORE')}
          >
            NoSQL
          </button>
          <button
            className={`filter-btn ${tagFilter === 'MCP_HOST' ? 'active' : ''}`}
            onClick={() => handleTagChange('MCP_HOST')}
          >
            MCP Host
          </button>
        </div>
        <div className="refresh-info">
          <span>Dashboard updated at {lastUpdated}</span>
          <span>Auto-refresh {autoRefresh ? 'enabled' : 'disabled'}</span>
        </div>
        <div className="refresh-controls">
          <button
            className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={handleAutoRefreshToggle}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            {autoRefresh ? '⏸ Auto On' : '▶ Auto Off'}
          </button>
          <button
            className="refresh-btn"
            onClick={() => fetchIncidents(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="incidents-grid">
        {loading ? (
          <div className="loading">Loading incidents...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="no-incidents">
            <h2>✅ No incidents in this category!</h2>
            <p>Great job! All issues are resolved.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={handleIncidentClick}
            />
          ))
        )}
      </div>
    </div>
  );
};
