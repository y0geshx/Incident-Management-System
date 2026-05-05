import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/DashboardPage.css';
import { IncidentCard } from '../components/IncidentCard';
import { apiClient, getApiErrorMessage } from '../services/apiClient';
import { WorkItem } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';

interface SystemStatus {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  services: { name: string; status: 'healthy' | 'degraded' | 'unhealthy' }[];
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [incidents, setIncidents] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emittingRandomSignal, setEmittingRandomSignal] = useState(false);
  const [simulatingCascadingFailure, setSimulatingCascadingFailure] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState<string>(searchParams.get('severity') || 'all');
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get('component') || 'all');
  const [lastUpdated, setLastUpdated] = useState<string>('---');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [showStatusFilters, setShowStatusFilters] = useState(true);
  const [showSeverityFilters, setShowSeverityFilters] = useState(false);
  const [showComponentFilters, setShowComponentFilters] = useState(false);

  useEffect(() => {
    fetchIncidents();
    fetchSystemStatus();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchIncidents();
        fetchSystemStatus();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Setup realtime updates via WebSocket
  const handleIncidentChange = useCallback(() => {
    void fetchIncidents(true);
  }, []);

  useRealtimeUpdates({
    onIncidentCreated: handleIncidentChange,
    onIncidentUpdated: handleIncidentChange,
    enabled: true,
  });

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
      // Sort newest incidents first
      const sorted = data.data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setIncidents(sorted);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(`Failed to load incidents: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const data = await apiClient.getHealth();
      setSystemStatus(data);
    } catch (err) {
      console.error('Failed to fetch system status:', err);
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
    if (searchQuery) {
      filtered = filtered.filter((i) => 
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
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

  const handleEmitRandomSignal = async () => {
    try {
      setEmittingRandomSignal(true);
      setError('');
      await apiClient.emitRandomSignal();
      await fetchIncidents(true);
    } catch (err) {
      setError(`Failed to emit random signal: ${getApiErrorMessage(err)}`);
    } finally {
      setEmittingRandomSignal(false);
    }
  };

  const handleSimulateCascadingFailure = async () => {
    try {
      setSimulatingCascadingFailure(true);
      setError('');
      await apiClient.simulateCascadingFailure();
      await fetchIncidents(true);
    } catch (err) {
      setError(`Failed to simulate cascading failure: ${getApiErrorMessage(err)}`);
    } finally {
      setSimulatingCascadingFailure(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchQuery]);

  const handleOpenSwaggerDocs = () => {
    window.open('/api/docs', '_blank', 'noopener,noreferrer');
  };

  const filteredIncidents = filterIncidents();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div className="dashboard-title-group">
            <h1>🚨 Incident Management System</h1>
            <span className="live-feed-label">Live Feed</span>
            <span className={`systems-nominal-label ${systemStatus?.status || 'operational'}`}>
              <span 
                className="systems-nominal-icon" 
                data-status={systemStatus?.status || 'operational'}
                aria-hidden="true" 
              />
              {systemStatus?.status === 'degraded' && 'SYSTEMS DEGRADED'}
              {systemStatus?.status === 'down' && 'SYSTEM DOWN'}
              {(!systemStatus || systemStatus.status === 'operational') && 'ALL SYSTEMS NOMINAL'}
            </span>
          </div>
          <div className="dashboard-header-actions">
            <button className="api-docs-btn" onClick={() => navigate('/incident/new')}>
              ➕ New Incident
            </button>
            <button
              className="api-docs-btn"
              onClick={handleEmitRandomSignal}
              disabled={emittingRandomSignal}
              title="Generate and ingest a random signal"
            >
              ⚡ {emittingRandomSignal ? 'Emitting...' : 'Emit Random Signal'}
            </button>
            <button
              className="api-docs-btn"
              onClick={handleSimulateCascadingFailure}
              disabled={simulatingCascadingFailure}
              title="Simulate a cascading failure scenario with multiple signals"
            >
              📋 {simulatingCascadingFailure ? 'Simulating...' : 'Simulate Cascading Failure'}
            </button>
            <button className="api-docs-btn" onClick={() => navigate('/metrics')}>
              📊 Metrics Dashboard
            </button>
            <button className="api-docs-btn" onClick={() => navigate('/service-status')}>
              🖥️ Service Status
            </button>
            <button className="api-docs-btn" onClick={() => navigate('/api-docs')}>
              📖 API Docs
            </button>
            <button
              className="api-docs-btn"
              onClick={handleOpenSwaggerDocs}
              title="Open interactive Swagger UI"
            >
              🔗 Swagger UI
            </button>
          </div>
        </div>
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
        <div className="search-bar-container">
          <div className="search-bar-header">
            <span className="search-bar-label">Search incidents</span>
            <span className="search-shortcut">Press / to focus</span>
          </div>
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by incident title or ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              aria-label="Search incidents by title or ID"
              aria-describedby="dashboard-search-help"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={clearSearch}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            <span className="search-results-count" aria-live="polite">
              {searchQuery ? filteredIncidents.length : incidents.length}
            </span>
          </div>
          <div className="search-meta" id="dashboard-search-help">
            <span>
              {searchQuery
                ? `Showing ${filteredIncidents.length} of ${incidents.length} incidents`
                : `Search across ${incidents.length} incidents`}
            </span>
            <span>{searchQuery ? 'Esc clears search' : 'Type to filter the live feed'}</span>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-section-header">
            <div className="filter-section-label">Status</div>
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowStatusFilters((current) => !current)}
              aria-expanded={showStatusFilters}
              aria-controls="status-filter-buttons"
            >
              {showStatusFilters ? 'Hide' : 'Show'}
            </button>
          </div>
          <div id="status-filter-buttons" className={`filter-buttons ${showStatusFilters ? '' : 'is-hidden'}`}>
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
        </div>

        <div className="filter-section">
          <div className="filter-section-header">
            <div className="filter-section-label">Severity</div>
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowSeverityFilters((current) => !current)}
              aria-expanded={showSeverityFilters}
              aria-controls="severity-filter-buttons"
            >
              {showSeverityFilters ? 'Hide' : 'Show'}
            </button>
          </div>
          <div id="severity-filter-buttons" className={`filter-buttons severity-filters ${showSeverityFilters ? '' : 'is-hidden'}`}>
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
        </div>

        <div className="filter-section">
          <div className="filter-section-header">
            <div className="filter-section-label">Component</div>
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowComponentFilters((current) => !current)}
              aria-expanded={showComponentFilters}
              aria-controls="component-filter-buttons"
            >
              {showComponentFilters ? 'Hide' : 'Show'}
            </button>
          </div>
          <div id="component-filter-buttons" className={`filter-buttons component-filters ${showComponentFilters ? '' : 'is-hidden'}`}>
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
        </div>

        <div className="dashboard-controls-footer">
          <div className="refresh-info">
            <span>Dashboard updated at {lastUpdated}</span>
            <span>Auto-refresh {autoRefresh ? 'enabled' : 'disabled'}</span>
            {(refreshing || emittingRandomSignal || simulatingCascadingFailure) && (
              <span className="updating-indicator" aria-live="polite">
                <span className="dashboard-spinner" aria-hidden="true" />
                Updating feed...
              </span>
            )}
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
              {refreshing ? (
                <>
                  <span className="dashboard-spinner" aria-hidden="true" />
                  Refreshing...
                </>
              ) : (
                '↻ Refresh'
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="incidents-grid">
        {loading ? (
          <div className="loading">
            <span className="dashboard-spinner" aria-hidden="true" />
            Loading incidents...
          </div>
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
