# Deployment Guide

## Development Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### Option 1: Docker Compose (Recommended)

This is the fastest way to get the system running with all dependencies.

```bash
# Clone/navigate to project
cd imgassig

# Create environment file
cp backend/.env.example backend/.env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Generate sample data
docker-compose exec backend npm run generate-sample-data

# Access the system
# Dashboard: http://localhost:3000
# API: http://localhost:3001/api
# Health: http://localhost:3001/api/health
```

### Option 2: Local Development

For active development with hot-reload:

```bash
# Terminal 1: Start databases
cd imgassig
docker-compose up postgres mongodb redis

# Terminal 2: Backend
cd backend
npm install
cp .env.example .env
npm run build
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev

# Terminal 4: Generate sample data
cd backend
npm run generate-sample-data
```

### Option 3: Kubernetes (Future)

```bash
# Coming soon: Helm charts and K8s manifests
# kubectl apply -f k8s/
```

## Database Setup

### PostgreSQL Initialization

The database tables are created automatically on first backend startup.

To manually initialize:

```bash
docker-compose exec postgres psql -U postgres -d ims -f /tmp/init.sql
```

### MongoDB Initialization

Collections and indexes are created automatically.

To manually verify:

```bash
docker-compose exec mongodb mongosh mongodb://root:root@localhost:27017/ims?authSource=admin
```

### Redis Initialization

Redis starts with default configuration. For persistence:

```bash
# Already enabled in docker-compose.yml
# Persisted to: redis_data volume
```

## Environment Configuration

### Backend (.env)

```bash
# Server
PORT=3001
NODE_ENV=development

# Redis
REDIS_URL=redis://redis:6379

# MongoDB
MONGO_URL=mongodb://root:root@mongodb:27017/ims?authSource=admin

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ims

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000          # 60 seconds
RATE_LIMIT_MAX_SIGNALS=10000        # 10k signals per window

# Debouncing
DEBOUNCE_WINDOW_MS=10000            # 10 seconds
DEBOUNCE_THRESHOLD=100              # Flush on 100 signals

# Logging
LOG_LEVEL=info                       # error, warn, info, debug
```

### Frontend (.env)

```bash
VITE_API_SERVER=http://localhost:3001
```

## Testing

### Unit Tests

```bash
cd backend
npm test

# Run specific test
npm test -- rca-validation.test.ts

# Watch mode
npm test -- --watch
```

### Integration Tests

```bash
# Generate sample incidents
npm run generate-sample-data

# API should respond with incidents
curl http://localhost:3001/api/incidents
```

### Load Testing (Manual)

```bash
# Send 100 signals quickly
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/signals \
    -H "Content-Type: application/json" \
    -d "{
      \"componentId\": \"LOAD_TEST_COMPONENT\",
      \"componentType\": \"API\",
      \"errorCode\": \"TEST_ERROR_$i\",
      \"errorMessage\": \"Load test signal $i\",
      \"severity\": \"P3\"
    }" &
done
wait

# Check if work items were created (should be 1, not 100)
curl http://localhost:3001/api/incidents | grep -c "LOAD_TEST_COMPONENT"
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] Monitoring configured
- [ ] Security audit completed
- [ ] Load testing passed
- [ ] Disaster recovery plan tested

### Docker Production Build

```bash
# Build optimized images
docker-compose -f docker-compose.yml build

# Tag for registry
docker tag imgassig-backend myregistry.azurecr.io/ims-backend:v1.0.0
docker tag imgassig-frontend myregistry.azurecr.io/ims-frontend:v1.0.0

# Push to registry
docker push myregistry.azurecr.io/ims-backend:v1.0.0
docker push myregistry.azurecr.io/ims-frontend:v1.0.0
```

### Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

# Verify deployments
kubectl get deployments -n ims
kubectl get pods -n ims

# Port forward for access
kubectl port-forward svc/ims-backend 3001:3001 -n ims
kubectl port-forward svc/ims-frontend 3000:3000 -n ims
```

### Azure Container Registry (ACR) Deployment

```bash
# Login to ACR
az acr login --name myregistry

# Build and push
az acr build -r myregistry -t ims-backend:v1.0.0 ./backend
az acr build -r myregistry -t ims-frontend:v1.0.0 ./frontend

# Deploy to AKS
az container create \
  --resource-group mygroup \
  --name ims-backend \
  --image myregistry.azurecr.io/ims-backend:v1.0.0 \
  --registry-login-server myregistry.azurecr.io
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check backend health
curl http://localhost:3001/api/health

# Check database connections
docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Check MongoDB replication
docker-compose exec mongodb mongosh --eval "db.adminCommand('status')"
```

### Log Analysis

```bash
# View backend logs
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend

# Search for errors
docker-compose logs backend | grep ERROR
```

### Database Maintenance

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U postgres ims > backup.sql

# Restore PostgreSQL
docker-compose exec -T postgres psql -U postgres ims < backup.sql

# Vacuum PostgreSQL (cleanup)
docker-compose exec postgres psql -U postgres -c "VACUUM ANALYZE;"

# MongoDB export
docker-compose exec mongodb mongoexport \
  --authenticationDatabase admin \
  -u root -p root \
  -d ims -c signals \
  --out signals_backup.json
```

### Scaling

#### Vertical Scaling (Single Machine)
```bash
# Edit docker-compose.yml
services:
  backend:
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096  # Increase memory
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

#### Horizontal Scaling (Multiple Machines)
```bash
# Docker Swarm mode
docker swarm init
docker service create \
  --name ims-backend \
  --replicas 3 \
  myregistry.azurecr.io/ims-backend:v1.0.0
```

## Troubleshooting

### Common Issues

**Issue**: Port already in use
```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>
```

**Issue**: Database connection refused
```bash
# Check if database is running
docker-compose ps postgres

# Restart database
docker-compose restart postgres
```

**Issue**: Out of memory
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Settings → Resources → Memory: 8GB
```

**Issue**: Redis connection errors
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

### Performance Debugging

```bash
# Monitor system metrics
docker stats --no-stream

# Check slow queries (PostgreSQL)
docker-compose exec postgres psql -U postgres -c "
  SELECT query, mean_time FROM pg_stat_statements 
  ORDER BY mean_time DESC LIMIT 10;
"

# Check query execution plan
docker-compose exec postgres psql -U postgres -c "
  EXPLAIN ANALYZE 
  SELECT * FROM work_items WHERE status = 'OPEN';
"
```

## Upgrades

### Zero-Downtime Deployment

```bash
# Build new version
docker-compose build backend

# Start new version alongside old
docker-compose up -d --no-deps --scale backend=2 backend

# Wait for new version to be ready
sleep 30

# Route traffic to new version (using load balancer)
# Then stop old version
docker-compose up -d --no-deps backend
```

### Database Schema Migrations

```bash
# Create migration
npm run migrate:create -- create_new_table

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

## Security Hardening (Production)

```bash
# 1. Enable HTTPS
# Use Nginx reverse proxy with SSL certificates
# Update VITE_API_SERVER to https://api.yourdomain.com

# 2. Set secure headers
# In backend: helmet.js middleware

# 3. Enable authentication
# Implement JWT tokens for API access

# 4. Enable audit logging
# Log all RCA submissions and status changes

# 5. Database encryption
# Enable PostgreSQL encryption at rest
# Enable MongoDB encryption at rest

# 6. Network security
# Isolate databases in private subnets
# Use VPN for admin access
# Implement WAF (Web Application Firewall)
```

## Rollback Procedures

```bash
# If new version has issues, rollback:
docker-compose down
git checkout <previous-commit>
docker-compose up -d

# Or use blue-green deployment:
docker-compose -f docker-compose.blue.yml down
docker-compose -f docker-compose.green.yml up -d
```

## Monitoring Stack (Production)

```bash
# Add Prometheus for metrics
# Add Grafana for dashboards
# Add ELK (Elasticsearch, Logstash, Kibana) for logs
# Add Jaeger for distributed tracing
# Add AlertManager for alerting
```

---

For infrastructure-as-code examples, see `/infrastructure` (coming soon)
