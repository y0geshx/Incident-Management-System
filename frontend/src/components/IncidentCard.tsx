import React from 'react';
import '../styles/IncidentCard.css';
import { WorkItem } from '../types';

interface IncidentCardProps {
  incident: WorkItem;
  onClick: (id: string) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onClick }) => {
  const severityClass = `severity-${incident.severity.toLowerCase()}`;
  const statusClass = `status-${incident.status.toLowerCase()}`;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="incident-card" onClick={() => onClick(incident.id)}>
      <div className="incident-header">
        <h3>{incident.title}</h3>
        <div className="incident-badges">
          <span className={`severity-badge ${severityClass}`}>{incident.severity}</span>
          <span className={`status-badge ${statusClass}`}>{incident.status}</span>
        </div>
      </div>
      
      <div className="incident-body">
        <p><strong>Incident ID:</strong> {incident.id}</p>
        <p><strong>Component:</strong> {incident.componentId}</p>
        <p><strong>Signals:</strong> {incident.signalCount}</p>
        <p><strong>Type:</strong> {incident.componentType}</p>
        <p><strong>First Signal:</strong> {formatTime(incident.firstSignalTime)}</p>
        <p><strong>Last Signal:</strong> {formatTime(incident.lastSignalTime)}</p>
      </div>

      <div className="incident-footer">
        <button className="view-details-btn">View Details →</button>
      </div>
    </div>
  );
};
