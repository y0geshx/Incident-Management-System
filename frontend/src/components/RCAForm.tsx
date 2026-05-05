import React, { useState } from 'react';
import '../styles/RCAForm.css';
import { RCAInput } from '../types';

interface RCAFormProps {
  onSubmit: (data: RCAInput) => Promise<void>;
  isLoading?: boolean;
}

export const RCAForm: React.FC<RCAFormProps> = ({ 
  onSubmit, 
  isLoading = false 
}) => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState('');
  const [fixApplied, setFixApplied] = useState('');
  const [preventionSteps, setPreventionSteps] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const categories = [
    'Database Failure',
    'Network Issue',
    'Cache Degradation',
    'Service Crash',
    'Configuration Error',
    'Resource Exhaustion',
    'External Dependency',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate all fields are present and not just whitespace
    if (!startTime || !endTime || !category || !fixApplied?.trim() || !preventionSteps?.trim()) {
      setError('All fields are required and cannot be empty');
      return;
    }

    // Validate that end time is after start time
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (endDate <= startDate) {
      setError('Incident end time must be after start time');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        incidentStartTime: startDate.toISOString(),
        incidentEndTime: endDate.toISOString(),
        rootCauseCategory: category,
        fixApplied: fixApplied.trim(),
        preventionSteps: preventionSteps.trim(),
        createdBy: 'frontend-user',
      });
      setSuccess(true);
      // Reset form
      setStartTime('');
      setEndTime('');
      setCategory('');
      setFixApplied('');
      setPreventionSteps('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit RCA');
    } finally {
      setSubmitting(false);
    }
  };

  const mttr = startTime && endTime ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000) : 0;

  return (
    <form className="rca-form" onSubmit={handleSubmit}>
      <h2>Root Cause Analysis Form</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">✅ RCA submitted successfully! Incident closed.</div>}

      <div className="form-group">
        <label htmlFor="startTime">Incident Start Time *</label>
        <input
          id="startTime"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="endTime">Incident End Time *</label>
        <input
          id="endTime"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      {mttr > 0 && (
        <div className="mttr-display">
          <p><strong>Mean Time To Repair (MTTR): {mttr} seconds ({(mttr / 60).toFixed(2)} minutes)</strong></p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="category">Root Cause Category *</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="fixApplied">Fix Applied *</label>
        <textarea
          id="fixApplied"
          value={fixApplied}
          onChange={(e) => setFixApplied(e.target.value)}
          placeholder="Describe what was done to fix the issue..."
          rows={4}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="preventionSteps">Prevention Steps *</label>
        <textarea
          id="preventionSteps"
          value={preventionSteps}
          onChange={(e) => setPreventionSteps(e.target.value)}
          placeholder="What steps will prevent this from happening again?"
          rows={4}
          required
        />
      </div>

      <button
        type="submit"
        className="submit-btn"
        disabled={submitting || isLoading}
      >
        {submitting ? 'Submitting...' : '✓ Submit RCA & Close Incident'}
      </button>
    </form>
  );
};
