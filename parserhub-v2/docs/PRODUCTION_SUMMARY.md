# ParserHub v2 Production Summary

## Overview

ParserHub v2 has been successfully developed as a modernized API with the following improvements:

### Key Features
1. **TypeScript + Express** - Type-safe, modern Node.js architecture
2. **Socket.io Integration** - Real-time agent communication with built-in heartbeat
3. **Docker Deployment** - Isolated from existing PM2 services
4. **Flexible Product Matching** - Supports multiple ID formats (id, productId, vendorItemId, itemId, nvMid)
5. **Dual API System** - Public API (순위 조회) & Admin API (워크플로우)
6. **365-day Ranking History** - Complete ranking tracking with change detection
7. **Page-based Storage** - Efficient storage of entire search result pages
8. **ignoreCache Option** - Force fresh crawling when needed
9. **Redis Caching** - Improved performance with configurable TTL
10. **Sample Data Mode** - Development testing without live crawling

### Architecture Improvements
- Clean separation of concerns (routes, services, middleware)
- Proper error handling and logging (Winston)
- Database connection pooling
- Type-safe interfaces for all data structures
- Async/await throughout the codebase

## Deployment Instructions

### Quick Deploy (Docker)

```bash
cd /home/techb/ParserHub/parserhub-v2

# Build and start
npm run docker:build
npm run docker:up

# Verify
curl http://mkt.techb.kr:8445/health
```

### API Endpoints

- **Base URL**: http://mkt.techb.kr:8445
- **Socket.io**: ws://mkt.techb.kr:8446
- **Authentication**: X-API-Key header required

### Key Endpoints
1. `/api/v2/ranking/:platform` - Get product rankings
2. `/api/v2/agents` - Manage agents
3. `/api/v2/workflows/:platform/execute` - Execute crawling workflows
4. `/api/v2/admin/stats` - System statistics

## Migration Path

### From v1 to v2
1. Both versions can run simultaneously (different ports)
2. Agents need to be updated to connect via Socket.io
3. API clients need to update endpoints from `/api/` to `/api/v2/`
4. Database schema remains compatible

### Agent Migration
- Update connection from HTTP polling to Socket.io
- Use example-agent.ts as reference
- Support for Playwright-based crawling

## Testing

```bash
# Run test script
./test-api.sh

# Or manual testing
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://mkt.techb.kr:8445/api/v2/ranking/coupang?keyword=laptop&code=123456"
```

## Monitoring

### Docker Logs
```bash
npm run docker:logs
```

### System Stats
```bash
curl -H "X-API-Key: YOUR_API_KEY" http://mkt.techb.kr:8445/api/v2/admin/stats
```

## Database Migration

Run the migration script to create v2 tables:
```bash
node scripts/migrate.js
```

This creates:
- v2_products
- v2_search_results
- v2_ranking_history
- v2_ranking_changes

## API Keys

Two separate authentication methods:
- **Public API**: Uses `api_keys` table from database (pass as URL parameter: `?key=xxx`)
- **Admin API**: `YOUR_API_KEY` (X-API-Key header)

## Next Steps

1. **Database Migration**
   - Run `node scripts/migrate.js`
   - Verify tables are created

2. **Agent Development**
   - Update existing agents to use Socket.io
   - Implement Playwright integration
   - Add retry logic and error handling

3. **Scheduler Setup** (Optional)
   - Enable scheduler in .env: `SCHEDULER_ENABLED=true`
   - Configure hourly crawling for key keywords

4. **Production Hardening**
   - Set up SSL/TLS with nginx reverse proxy
   - Configure production logging
   - Set up monitoring and alerts

5. **Performance Optimization**
   - Implement connection pooling for agents
   - Add request queuing for high load
   - Consider table partitioning for ranking_history

## Important Notes

- **DO NOT** use `pm2 kill` - it will stop all PM2 processes
- v2 runs on ports 8445/8446 to avoid conflicts with v1 (8443)
- Redis data is persisted in Docker volume
- All timestamps are in UTC

## Support

For issues or questions:
- Check logs: `npm run docker:logs`
- Review DEPLOYMENT.md for detailed instructions
- Test with example-agent.ts for agent connectivity