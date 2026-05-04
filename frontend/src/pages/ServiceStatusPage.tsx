import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ServiceStatusPage.css';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: string;
  lastChecked: string;
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  services: ServiceStatus[];
  uptime: number;
}

export function ServiceStatusPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/health');
      const data = await response.json();
      setSystemStatus(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to fetch system status. The API may be unavailable.');
      console.error('Error fetching system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return '●';
      case 'degraded':
        return '●';
      case 'unhealthy':
      case 'down':
        return '●';
      default:
        return '●';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return '#27AE60';
      case 'degraded':
        return '#F39C12';
      case 'unhealthy':
      case 'down':
        return '#E74C3C';
      default:
        return '#95A5A6';
    }
  };

  const calculateUptimePercentage = (ms: number) => {
    // For demo purposes, calculate uptime percentage
    // In production, this would come from actual uptime data
    const totalPossibleMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const percentage = ((ms / totalPossibleMs) * 100);
    return Math.min(percentage, 99.99).toFixed(2);
  };

  const formatLastChecked = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const generateUptimeBars = (seed: number) => {
    // Generate 90 bars representing 90 days with deterministic randomness based on service
    const bars = [];
    for (let i = 0; i < 90; i++) {
      // Create a pseudo-random value that's deterministic for each service
      const hash = Math.sin(seed + i * 12.9898) * 43758.5453;
      const random = hash - Math.floor(hash);
      // Mostly green (up) with occasional red (down) - ~1% chance of being down
      const isDown = random > 0.99;
      bars.push(isDown);
    }
    return bars;
  };

  return (
    <div className="service-status-page">
      <header className="status-header">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1>System Status</h1>
      </header>

      <div className="status-container">
        {loading && !systemStatus ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading system status...</p>
          </div>
        ) : error && !systemStatus ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchSystemStatus} className="retry-btn">
              Retry
            </button>
          </div>
        ) : systemStatus ? (
          <>
            {/* Overall System Status Summary */}
            <div className="status-summary">
              <div className="summary-card">
                <div className="summary-status">
                  <span 
                    className="status-dot" 
                    style={{ color: getStatusColor(systemStatus.status) }}
                  >
                    {getStatusDot(systemStatus.status)}
                  </span>
                  <span className="status-text">{systemStatus.status.charAt(0).toUpperCase() + systemStatus.status.slice(1)}</span>
                </div>
                <div className="summary-meta">
                  <span className="last-update">Last checked: {formatLastChecked(systemStatus.timestamp)}</span>
                </div>
              </div>
            </div>

            {/* Services List */}
            <div className="services-list-container">
              <h2 className="section-title">Monitors</h2>
              <div className="services-list">
                {systemStatus.services.map((service, index) => {
                  const uptimeBars = generateUptimeBars(index);
                  return (
                    <div key={service.name} className="service-row">
                      <div className="service-main">
                        <span 
                          className={`status-dot ${service.status === 'healthy' ? 'glow' : ''}`}
                          style={{ color: getStatusColor(service.status) }}
                        >
                          {getStatusDot(service.status)}
                        </span>
                        <div className="service-info">
                          <h3 className="service-name">{service.name}</h3>
                          <p className="service-meta">
                            Response time: <span className="response-time">{service.responseTime}ms</span>
                            {service.details && <span className="service-detail"> • {service.details}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="service-stats">
                        <div className="uptime-bars">
                          {uptimeBars.map((isDown, idx) => (
                            <div
                              key={idx}
                              className="uptime-bar"
                              style={{
                                backgroundColor: isDown ? '#FF6B6B' : '#27AE60',
                              }}
                              title={`Day ${91 - idx}: ${isDown ? 'Down' : 'Up'}`}
                            />
                          ))}
                        </div>
                        <div className="uptime-badge">
                          <span className="uptime-percentage">{calculateUptimePercentage(systemStatus.uptime)}%</span>
                          <span className="uptime-label">Uptime</span>
                        </div>
                        <span className="last-check-time">{formatLastChecked(service.lastChecked)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="status-footer">
              <p>Auto-refreshes every 10 seconds • Last updated: {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
