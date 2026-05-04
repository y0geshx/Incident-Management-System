# Service Status Monitoring

## Overview

The Service Status page provides real-time monitoring of all critical infrastructure components in the Incident Management System. It displays the health status of all backend services and databases, helping operators quickly identify and respond to infrastructure issues.

## Features

### 🔍 Real-Time Monitoring
- **Auto-refresh**: System status automatically refreshes every 10 seconds
- **Manual refresh**: Click the "Refresh Now" button to get immediate updates
- **Response time tracking**: See how long each service takes to respond

### 📊 Monitored Services

The service status page monitors the following components:

1. **PostgreSQL (Source of Truth)**
   - Relational database storing work items and RCA data
   - Health check: Verifies active database connection
   
2. **MongoDB (Data Lake)**
   - NoSQL database storing raw signal payloads
   - Health check: Confirms connection and database availability
   
3. **Redis (Cache)**
   - In-memory cache for dashboard state and real-time metrics
   - Health check: Verifies cache connectivity
   
4. **Backend API**
   - Main application server processing signals and incidents
   - Health check: Confirms API is operational

### 🎨 Status Indicators

#### Service Status Levels
- **✅ Healthy**: Service is fully operational and responding normally
- **⚠️ Degraded**: Service is running but experiencing performance issues
- **❌ Unhealthy**: Service is unavailable or not responding

#### System Status Levels
- **Operational**: All services are healthy
- **Degraded**: One or more services are degraded but system is functioning
- **Down**: Multiple critical services are unavailable

### 📱 UI Components

#### System Overview Card
Displays the overall system health status with:
- Large status indicator showing current state
- System uptime since last restart
- Last health check timestamp

#### Individual Service Cards
Each service has a detailed card showing:
- Service name and current status
- Response time in milliseconds
- Status details (connection info, error messages)
- Last check timestamp

## API Endpoints

### GET /api/health
Returns comprehensive system status including all services.

**Response:**
```json
{
  "status": "operational|degraded|down",
  "timestamp": "2026-05-04T12:34:56.789Z",
  "uptime": 3600000,
  "services": [
    {
      "name": "PostgreSQL (Source of Truth)",
      "status": "healthy|degraded|unhealthy",
      "responseTime": 45,
      "details": "Database connection is active",
      "lastChecked": "2026-05-04T12:34:56.789Z"
    },
    ...
  ]
}
```

### GET /api/health/quick
Quick health check that only verifies API availability.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-04T12:34:56.789Z",
  "message": "API is operational"
}
```

## Usage

### Accessing the Service Status Page
1. Click the **"Service Status"** button in the Dashboard header
2. The page displays real-time status of all services
3. Status updates automatically every 10 seconds

### Interpreting the Dashboard

**System Operational**
- All service cards show ✅ icons
- System status displays "OPERATIONAL"
- Green status indicators throughout

**System Degraded**
- One or more services show ⚠️ or ❌ icons
- System status displays "DEGRADED"
- Orange or red indicators highlight affected services

**System Down**
- Multiple services unavailable (❌ icons)
- System status displays "DOWN"
- Red indicators show affected services

### Troubleshooting

**If you see "Unhealthy" status for a service:**

1. **PostgreSQL Down**
   - Check: Docker container `ims-postgres` is running
   - Verify: Port 5432 is accessible
   - Check logs: `docker logs ims-postgres`

2. **MongoDB Down**
   - Check: Docker container `ims-mongodb` is running
   - Verify: Port 27018 is accessible
   - Check logs: `docker logs ims-mongodb`

3. **Redis Down**
   - Check: Docker container `ims-redis` is running
   - Verify: Port 6379 is accessible
   - Check logs: `docker logs ims-redis`

4. **Backend API Down**
   - Check: Backend service is running
   - Verify: Port 3001 is accessible
   - Check backend logs for errors

### Manual Refresh
Click "🔄 Refresh Now" to immediately fetch fresh status data without waiting for the auto-refresh cycle.

## Configuration

### Auto-Refresh Interval
The service status page refreshes every 10 seconds by default. To modify this interval:

1. Edit `frontend/src/pages/ServiceStatusPage.tsx`
2. Change the interval in the `useEffect` hook:
   ```typescript
   const interval = setInterval(fetchSystemStatus, 10000); // 10 seconds
   ```
3. Rebuild the frontend

### Adding New Services

To monitor additional services:

1. **Backend**: Add a new health check method to [backend/src/services/HealthCheckService.ts](backend/src/services/HealthCheckService.ts)
2. **Frontend**: Update the service rendering in [frontend/src/pages/ServiceStatusPage.tsx](frontend/src/pages/ServiceStatusPage.tsx)

Example:
```typescript
private async checkMyService(): Promise<ServiceStatus> {
  const startTime = Date.now();
  try {
    const result = await this.myService.healthCheck?.();
    return {
      name: "My Service",
      status: result ? "healthy" : "unhealthy",
      responseTime: Date.now() - startTime,
      details: "Service details here",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "My Service",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : "Unknown error",
      lastChecked: new Date().toISOString(),
    };
  }
}
```

## Performance Considerations

- **Response time monitoring**: Each service has response time tracking, useful for identifying slow dependencies
- **Auto-refresh**: Set to 10 seconds to balance real-time monitoring with API load
- **Graceful degradation**: If health check API fails, an error message is displayed

## Integration with Incident Management

Service status is complementary to the incident management system:
- **Incident Dashboard**: Shows application-level incidents
- **Service Status**: Shows infrastructure-level health
- **Together**: Provides complete system observability

For detailed monitoring and alerting, integrate with external monitoring tools:
- Prometheus for metrics collection
- Grafana for visualization
- PagerDuty for alerting
