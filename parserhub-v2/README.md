# ParserHub v2 API

A modernized version of ParserHub with improved architecture, Docker deployment, and Socket.io for agent communication.

## Features

- TypeScript + Express server
- Socket.io for real-time agent communication
- Redis caching
- PostgreSQL database with 365-day ranking history
- Docker deployment
- Flexible product ID matching
- Dual API system (Public & Admin)
- Page-based crawling and storage
- Automatic ranking change detection
- Sample data mode for development
- Scheduler for automated crawling
  - Hourly ranking updates
  - Configurable monitoring keywords
  - Automatic cache and log cleanup

## Quick Start

### Development Mode

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

### Docker Deployment

1. Build and start:
```bash
npm run docker:build
npm run docker:up
```

2. View logs:
```bash
npm run docker:logs
```

3. Stop:
```bash
npm run docker:down
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status

### Public API (PUBLIC_API_KEY)
- `GET /api/v2/public/ranking/:platform` - Get product ranking
- `GET /api/v2/public/ranking/:platform/history` - Get ranking history
- `GET /api/v2/public/ranking/:platform/competitors` - Get top competitors

### Admin Ranking API (API_KEY)
- `GET /api/v2/ranking/:platform?keyword=X&code=Y` - Get product ranking
- `POST /api/v2/ranking/batch` - Batch ranking check
- `DELETE /api/v2/ranking/cache/:platform` - Clear ranking cache

### Agent API
- `GET /api/v2/agents` - List all agents
- `GET /api/v2/agents/:agentId` - Get agent details
- `GET /api/v2/agents/:agentId/tasks` - Get agent tasks
- `GET /api/v2/agents/tasks/all` - Get all tasks
- `POST /api/v2/agents/tasks/cleanup` - Cleanup old tasks

### Workflow API
- `POST /api/v2/workflows/:platform/execute` - Execute workflow (with ignoreCache option)
- `GET /api/v2/workflows/status/:workflowId` - Get workflow status
- `GET /api/v2/workflows/available/:platform` - List available workflows

### Admin API
- `GET /api/v2/admin/stats` - System statistics
- `DELETE /api/v2/admin/cache/all` - Clear all cache
- `DELETE /api/v2/admin/cache/pattern` - Clear cache by pattern
- `GET /api/v2/admin/db/health` - Database health check

### Scheduler API
- `GET /api/v2/scheduler/status` - Scheduler status
- `GET /api/v2/scheduler/keywords` - List monitoring keywords
- `POST /api/v2/scheduler/keywords` - Add monitoring keyword
- `DELETE /api/v2/scheduler/keywords/:id` - Remove monitoring keyword
- `GET /api/v2/scheduler/keywords/due` - Keywords due for crawl
- `GET /api/v2/scheduler/logs` - Scheduler logs
- `POST /api/v2/scheduler/trigger/ranking-crawl` - Manual ranking crawl
- `POST /api/v2/scheduler/trigger/cache-cleanup` - Manual cache cleanup
- `POST /api/v2/scheduler/trigger/log-cleanup` - Manual log cleanup

## Authentication

Two types of API keys:

1. **Public API Key** (for ranking queries - uses api_keys table):
```
GET /api/v2/public/ranking/coupang?key=YOUR_API_KEY&keyword=laptop&code=123456
```
Public API uses the `api_keys` table in the database. Pass the key as a URL parameter.

2. **Admin API Key** (for workflows and management):
```
X-API-Key: YOUR_API_KEY
```
Admin API uses X-API-Key header authentication.

## Platforms

- `coupang` - Coupang marketplace
- `naver_store` - Naver Smart Store
- `naver_compare` - Naver price comparison

## Flexible Product Matching

The ranking API supports multiple product ID formats:
- `id` - Generic product ID
- `productId` - Platform-specific product ID
- `vendorItemId` - Vendor item ID (Coupang)
- `itemId` - Item ID
- `nvMid` - Naver product ID
- URL matching - Matches if product URL contains the code

## Development

- TypeScript configuration in `tsconfig.json`
- Environment variables in `.env`
- Logs stored in `./logs` directory
- Redis cache with configurable TTL
- PostgreSQL connection pooling

## Architecture

- Express.js REST API
- Socket.io for real-time agent communication
- Redis for caching
- PostgreSQL for persistent storage
- Docker for containerization
- TypeScript for type safety