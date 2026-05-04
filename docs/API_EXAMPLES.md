# API Usage & Examples

## Signal Ingestion Examples

### Example 1: RDBMS Failure (P0 Critical)

```bash
curl -X POST http://localhost:3001/api/signals \
  -H "Content-Type: application/json" \
  -d '{
    "componentId": "RDBMS_CLUSTER_01",
    "componentType": "RDBMS",
    "errorCode": "CONNECTION_POOL_EXHAUSTED",
    "errorMessage": "All connections in pool exhausted. Database unavailable.",
    "severity": "P0",
    "metadata": {
      "poolSize": 100,
      "activeConnections": 100,
      "waitingRequests": 5432
    },
    "stackTrace": "Error: Connection timeout\n    at DatabasePool.getConnection",
    "latency": 30000
  }'
```

Response:
```json
{
  "message": "Signal accepted for processing",
  "signalId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Example 2: Batch Signal Ingestion

```bash
curl -X POST http://localhost:3001/api/signals/batch \
  -H "Content-Type: application/json" \
  -d '{
    "signals": [
      {
        "componentId": "CACHE_CLUSTER_01",
        "componentType": "CACHE_CLUSTER",
        "errorCode": "HIGH_MEMORY_USAGE",
        "errorMessage": "Cache memory at 92%",
        "severity": "P2",
        "metadata": { "memoryPercent": 92 }
      },
      {
        "componentId": "API_GATEWAY_01",
        "componentType": "API",
        "errorCode": "TIMEOUT",
        "errorMessage": "Request timeout after 30 seconds",
        "severity": "P3",
        "latency": 30001
      }
    ]
  }'
```

Response:
```json
{
  "message": "Signals accepted for processing",
  "count": 2
}
```

## Incident Management Examples

### Example 3: Get All Active Incidents

```bash
curl http://localhost:3001/api/incidents
```

Response:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "componentId": "RDBMS_CLUSTER_01",
      "componentType": "RDBMS",
      "status": "OPEN",
      "severity": "P0",
      "title": "Incident: RDBMS_CLUSTER_01",
      "description": "Multiple signals detected for RDBMS_CLUSTER_01",
      "signalCount": 87,
      "firstSignalTime": "2024-01-15T10:00:00Z",
      "lastSignalTime": "2024-01-15T10:02:15Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:02:15Z"
    }
  ],
  "total": 1
}
```

### Example 4: Get Incident Details

```bash
curl http://localhost:3001/api/incidents/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "componentId": "RDBMS_CLUSTER_01",
  "componentType": "RDBMS",
  "status": "OPEN",
  "severity": "P0",
  "title": "Incident: RDBMS_CLUSTER_01",
  "signalIds": ["sig1", "sig2", "...", "sig87"],
  "signalCount": 87,
  "firstSignalTime": "2024-01-15T10:00:00Z",
  "lastSignalTime": "2024-01-15T10:02:15Z",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:02:15Z",
  "rca": null
}
```

### Example 5: Transition Incident Status

```bash
# Start investigation
curl -X PUT http://localhost:3001/api/incidents/550e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{"status": "INVESTIGATING"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "INVESTIGATING",
  "updatedAt": "2024-01-15T10:05:00Z"
}
```

Valid transitions:
- `OPEN` → `INVESTIGATING`
- `INVESTIGATING` → `RESOLVED` or back to `OPEN`
- `RESOLVED` → `CLOSED` (only with complete RCA)
- `CLOSED` (terminal state)

### Example 6: Submit RCA (Root Cause Analysis)

```bash
curl -X POST http://localhost:3001/api/incidents/550e8400-e29b-41d4-a716-446655440000/rca \
  -H "Content-Type: application/json" \
  -d '{
    "incidentStartTime": "2024-01-15T10:00:00Z",
    "incidentEndTime": "2024-01-15T10:30:00Z",
    "rootCauseCategory": "Database Failure",
    "fixApplied": "Restarted PostgreSQL cluster and restored from backup. Ran integrity checks.",
    "preventionSteps": "Implement connection pool monitoring and auto-scaling. Add failover redundancy.",
    "createdBy": "john.doe@company.com"
  }'
```

Response:
```json
{
  "message": "RCA submitted successfully! Incident closed.",
  "rca": {
    "id": "660e8400-e29b-41d4-a716-446655440111",
    "workItemId": "550e8400-e29b-41d4-a716-446655440000",
    "incidentStartTime": "2024-01-15T10:00:00Z",
    "incidentEndTime": "2024-01-15T10:30:00Z",
    "rootCauseCategory": "Database Failure",
    "fixApplied": "Restarted PostgreSQL cluster and restored from backup. Ran integrity checks.",
    "preventionSteps": "Implement connection pool monitoring and auto-scaling. Add failover redundancy.",
    "mttr": 1800,
    "createdAt": "2024-01-15T10:35:00Z",
    "createdBy": "john.doe@company.com"
  }
}
```

**Important Notes**:
- All RCA fields are mandatory
- MTTR is automatically calculated (in seconds)
- Submitting RCA auto-transitions incident to CLOSED
- Cannot be undone (CLOSED is terminal state)

## Health Check & Metrics

### Example 7: System Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:35:00Z",
  "uptime": 3600,
  "rateLimiter": {
    "requestsInWindow": 5234,
    "maxRequests": 10000,
    "utilizationPercent": 52.34
  }
}
```

Status values:
- `healthy`: System operating normally
- `degraded`: Some components slow but functional
- `critical`: One or more critical services down

## Error Handling

### Example 8: Rate Limit Exceeded

```bash
# Send 10,001 signals in 60 seconds
curl -X POST http://localhost:3001/api/signals \
  -H "Content-Type: application/json" \
  -d '...'
```

Response (HTTP 429):
```json
{
  "error": "Rate limit exceeded",
  "remaining": 0
}
```

Headers:
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:36:00Z
```

### Example 9: Invalid Signal

```bash
curl -X POST http://localhost:3001/api/signals \
  -H "Content-Type: application/json" \
  -d '{
    "componentId": "API_01"
    // Missing: componentType, errorCode, errorMessage
  }'
```

Response (HTTP 400):
```json
{
  "error": "Missing required fields: componentId, componentType, errorCode, errorMessage"
}
```

### Example 10: Closing Without RCA

```bash
# Try to close incident without RCA
curl -X POST http://localhost:3001/api/incidents/550e8400-e29b-41d4-a716-446655440000/rca \
  -H "Content-Type: application/json" \
  -d '{
    "incidentStartTime": "2024-01-15T10:00:00Z",
    "incidentEndTime": "2024-01-15T10:30:00Z",
    "rootCauseCategory": "",
    "fixApplied": "",
    "preventionSteps": ""
  }'
```

Response (HTTP 400):
```json
{
  "error": "RCA must have all required fields filled"
}
```

## Python Client Example

```python
import requests
import json
from datetime import datetime

class IMSClient:
    def __init__(self, base_url="http://localhost:3001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
    
    def send_signal(self, component_id, component_type, error_code, 
                    error_message, severity="P3", metadata=None):
        """Send a single signal"""
        payload = {
            "componentId": component_id,
            "componentType": component_type,
            "errorCode": error_code,
            "errorMessage": error_message,
            "severity": severity,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        response = requests.post(f"{self.api_url}/signals", json=payload)
        return response.json()
    
    def get_incidents(self):
        """Get all active incidents"""
        response = requests.get(f"{self.api_url}/incidents")
        return response.json()
    
    def get_incident(self, incident_id):
        """Get incident details"""
        response = requests.get(f"{self.api_url}/incidents/{incident_id}")
        return response.json()
    
    def submit_rca(self, incident_id, start_time, end_time, category, 
                   fix_applied, prevention_steps, created_by="api"):
        """Submit RCA and close incident"""
        payload = {
            "incidentStartTime": start_time,
            "incidentEndTime": end_time,
            "rootCauseCategory": category,
            "fixApplied": fix_applied,
            "preventionSteps": prevention_steps,
            "createdBy": created_by
        }
        response = requests.post(
            f"{self.api_url}/incidents/{incident_id}/rca",
            json=payload
        )
        return response.json()

# Usage Example
client = IMSClient()

# Send signal
result = client.send_signal(
    component_id="DB_01",
    component_type="RDBMS",
    error_code="CONN_TIMEOUT",
    error_message="Database connection timeout",
    severity="P0"
)
print(f"Signal sent: {result}")

# Get incidents
incidents = client.get_incidents()
print(f"Active incidents: {incidents['total']}")

# Submit RCA
if incidents['data']:
    incident = incidents['data'][0]
    rca = client.submit_rca(
        incident_id=incident['id'],
        start_time="2024-01-15T10:00:00Z",
        end_time="2024-01-15T10:30:00Z",
        category="Database Failure",
        fix_applied="Restarted DB cluster",
        prevention_steps="Add monitoring"
    )
    print(f"RCA submitted: {rca}")
```

## JavaScript/Node.js Client Example

See `frontend/src/services/apiClient.ts` for the official TypeScript client.

```javascript
import { apiClient } from './services/apiClient';

// Get incidents
const { data, total } = await apiClient.getIncidents();
console.log(`Found ${total} incidents`);

// Get incident detail
const incident = await apiClient.getIncidentDetail(incidentId);
console.log(`Incident status: ${incident.status}`);

// Update status
const updated = await apiClient.updateIncidentStatus(
  incidentId,
  'INVESTIGATING'
);

// Submit RCA
const { rca } = await apiClient.submitRCA(incidentId, {
  incidentStartTime: new Date('2024-01-15T10:00:00Z').toISOString(),
  incidentEndTime: new Date('2024-01-15T10:30:00Z').toISOString(),
  rootCauseCategory: 'Database Failure',
  fixApplied: 'Restarted cluster',
  preventionSteps: 'Add monitoring',
  createdBy: 'user@example.com'
});

console.log(`MTTR: ${rca.mttr} seconds`);
```

---

For comprehensive API documentation, see the live OpenAPI spec at http://localhost:3001/api/openapi.json.
