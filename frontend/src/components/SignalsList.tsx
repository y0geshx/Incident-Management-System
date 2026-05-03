import React from 'react';
import '../styles/SignalsList.css';
import { Signal } from '../types';

interface SignalsListProps {
  signals: Signal[];
  isLoading?: boolean;
}

export const SignalsList: React.FC<SignalsListProps> = ({ signals, isLoading = false }) => {
  if (isLoading) {
    return <div className="signals-loading">Loading signals...</div>;
  }

  if (signals.length === 0) {
    return <div className="signals-empty">No signals found for this incident</div>;
  }

  return (
    <div className="signals-list">
      <h3>Signals ({signals.length})</h3>
      <div className="signals-container">
        {signals.map((signal) => (
          <div key={signal.id} className="signal-item">
            <div className="signal-header">
              <span className={`signal-severity ${signal.severity.toLowerCase()}`}>
                {signal.severity}
              </span>
              <span className="signal-code">{signal.errorCode}</span>
              <span className="signal-time">
                {new Date(signal.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="signal-message">{signal.errorMessage}</div>
            {signal.latency && (
              <div className="signal-latency">Latency: {signal.latency}ms</div>
            )}
            {signal.stackTrace && (
              <details className="signal-trace">
                <summary>Stack Trace</summary>
                <pre>{signal.stackTrace}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
