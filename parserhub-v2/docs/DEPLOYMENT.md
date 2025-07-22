# ParserHub v2 Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (existing one at mkt.techb.kr will be used)
- Port 8445 (API) and 8446 (Socket.io) available

## Deployment Steps

### 1. Clone or Copy Project

```bash
cd /home/techb/ParserHub/parserhub-v2
```

### 2. Environment Setup

Create `.env` file from example:
```bash
cp .env.example .env
```

Edit `.env` with production values:
```env
NODE_ENV=production
PORT=8445
SOCKET_PORT=8446
DB_HOST=mkt.techb.kr  # Use actual database host
DB_PORT=5432
DB_USER=techb_pp
DB_PASS=Tech1324!
DB_NAME=productparser_db
REDIS_HOST=redis  # Docker service name
API_KEY=YOUR_API_KEY
DEV_MODE=false  # Set to false for production
```

### 3. Build and Deploy

```bash
# Build Docker images
npm run docker:build

# Start services
npm run docker:up

# Check logs
npm run docker:logs
```

### 4. Verify Deployment

Check health endpoint:
```bash
curl http://localhost:8445/health
```

Detailed health check:
```bash
curl http://localhost:8445/health/detailed
```

### 5. Test API

Test ranking API:
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8445/api/v2/ranking/coupang?keyword=laptop&code=123456"
```

## Production Considerations

### SSL/TLS

For production, use a reverse proxy (nginx) with SSL:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8445;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:8446;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Database Migrations

If you need to create new tables:

```sql
-- Example ranking cache table
CREATE TABLE IF NOT EXISTS ranking_cache (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    product_code VARCHAR(255) NOT NULL,
    rank INTEGER,
    product_data JSONB,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_platform_keyword_code (platform, keyword, product_code)
);
```

### Monitoring

- Use `docker stats` to monitor resource usage
- Check logs regularly: `npm run docker:logs`
- Set up alerts for container restarts

### Backup

Regular Redis backup:
```bash
docker exec parserhub-v2-redis redis-cli BGSAVE
```

### Scaling

To run multiple API instances:
1. Use Docker Swarm or Kubernetes
2. Put a load balancer in front
3. Ensure Redis is accessible to all instances
4. Use sticky sessions for Socket.io connections

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs api`
- Verify ports are not in use: `netstat -tulpn | grep -E '8445|8446'`
- Check database connectivity

### Agent connection issues
- Verify API key is correct
- Check firewall rules for port 8446
- Test with example agent: `npx ts-node example-agent.ts`

### High memory usage
- Adjust Node.js memory limit in Dockerfile
- Implement task cleanup cron job
- Monitor Redis memory usage

## Maintenance

### Update deployment
```bash
# Pull latest changes
git pull

# Rebuild and restart
npm run docker:down
npm run docker:build
npm run docker:up
```

### View container logs
```bash
# All logs
npm run docker:logs

# Specific service
docker-compose logs -f api
docker-compose logs -f redis
```

### Access container shell
```bash
docker exec -it parserhub-v2-api sh
```