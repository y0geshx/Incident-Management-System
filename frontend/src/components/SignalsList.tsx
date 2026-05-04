import React, { useState, useMemo } from 'react';
import '../styles/SignalsList.css';
import { Signal } from '../types';

interface SignalsListProps {
  signals: Signal[];
  isLoading?: boolean;
}

type SortField = 'timestamp' | 'severity' | 'latency';
type SortDirection = 'asc' | 'desc';

export const SignalsList: React.FC<SignalsListProps> = ({ signals, isLoading = false }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAndSortedSignals = useMemo(() => {
    let filtered = signals;

    // Filter by severity
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(signal => signal.severity === filterSeverity);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(signal =>
        signal.errorMessage.toLowerCase().includes(term) ||
        signal.errorCode.toLowerCase().includes(term) ||
        (signal.metadata && JSON.stringify(signal.metadata).toLowerCase().includes(term))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'severity':
          const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
          aValue = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
          bValue = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;
          break;
        case 'latency':
          aValue = a.latency || 0;
          bValue = b.latency || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [signals, filterSeverity, sortField, sortDirection, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
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

  const getSeverityColor = (severity: string) => {
    const colors = {
      P0: '#d32f2f',
      P1: '#f57c00',
      P2: '#fbc02d',
      P3: '#1976d2',
    };
    return colors[severity as keyof typeof colors] || '#757575';
  };

  const severityOptions = ['all', 'P0', 'P1', 'P2', 'P3'];

  if (isLoading) {
    return (
      <div className="signals-list">
        <div className="signals-loading">
          <div className="loading-spinner"></div>
          <span>Loading signals...</span>
        </div>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="signals-list">
        <div className="signals-empty">
          <div className="empty-icon">📡</div>
          <h3>No signals found</h3>
          <p>This incident has no associated signals yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signals-list">
      <div className="signals-header">
        <h3>📡 Signals ({signals.length})</h3>
        <div className="signals-stats">
          <span className="stat">
            Filtered: {filteredAndSortedSignals.length}
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="signals-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search signals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Severity:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="filter-select"
            >
              {severityOptions.map(severity => (
                <option key={severity} value={severity}>
                  {severity === 'all' ? 'All' : `${getSeverityIcon(severity)} ${severity}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="sort-controls">
        <span className="sort-label">Sort by:</span>
        <button
          className={`sort-btn ${sortField === 'timestamp' ? 'active' : ''}`}
          onClick={() => handleSort('timestamp')}
        >
          Time {sortField === 'timestamp' && (sortDirection === 'desc' ? '↓' : '↑')}
        </button>
        <button
          className={`sort-btn ${sortField === 'severity' ? 'active' : ''}`}
          onClick={() => handleSort('severity')}
        >
          Severity {sortField === 'severity' && (sortDirection === 'desc' ? '↓' : '↑')}
        </button>
        <button
          className={`sort-btn ${sortField === 'latency' ? 'active' : ''}`}
          onClick={() => handleSort('latency')}
        >
          Latency {sortField === 'latency' && (sortDirection === 'desc' ? '↓' : '↑')}
        </button>
      </div>

      {/* Signals Container */}
      <div className="signals-container">
        {filteredAndSortedSignals.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <p>No signals match your current filters.</p>
            <button
              className="clear-filters-btn"
              onClick={() => {
                setFilterSeverity('all');
                setSearchTerm('');
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredAndSortedSignals.map((signal) => (
            <div key={signal.id} className="signal-item">
              <div className="signal-header">
                <div className="signal-main-info">
                  <span
                    className="signal-severity"
                    style={{ backgroundColor: getSeverityColor(signal.severity) }}
                  >
                    {getSeverityIcon(signal.severity)} {signal.severity}
                  </span>
                  <span className="signal-code">{signal.errorCode}</span>
                </div>
                <div className="signal-meta">
                  <span className="signal-time">
                    {new Date(signal.timestamp).toLocaleString()}
                  </span>
                  {signal.latency && (
                    <span className="signal-latency">⏱️ {signal.latency}ms</span>
                  )}
                </div>
              </div>

              <div className="signal-content">
                <div className="signal-message">{signal.errorMessage}</div>

                {signal.metadata && Object.keys(signal.metadata).length > 0 && (
                  <div className="signal-metadata">
                    <details>
                      <summary>📋 Metadata ({Object.keys(signal.metadata).length} fields)</summary>
                      <div className="metadata-content">
                        {Object.entries(signal.metadata).map(([key, value]) => (
                          <div key={key} className="metadata-item">
                            <span className="metadata-key">{key}:</span>
                            <span className="metadata-value">
                              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {signal.stackTrace && (
                  <details className="signal-trace">
                    <summary>🔧 Stack Trace</summary>
                    <pre>{signal.stackTrace}</pre>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
