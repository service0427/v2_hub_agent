# Scheduler Implementation Summary

## Overview

The scheduler has been successfully implemented for ParserHub v2, providing automated ranking tracking with configurable monitoring keywords and maintenance tasks.

## Key Features

### 1. Automated Ranking Crawl
- Runs hourly by default (configurable via `SCHEDULER_RANKING_CRAWL`)
- Monitors keywords stored in `v2_monitoring_keywords` table
- Supports different crawl intervals per keyword
- Automatic ranking change detection and history storage

### 2. Database Tables
- **v2_monitoring_keywords**: Keywords to monitor
  - keyword, platform, priority, interval_hours
  - Sample keywords pre-populated
- **v2_scheduler_logs**: Execution history
  - Job type, status, timestamps, error messages
- **v2_scheduler_jobs**: Future job queue (prepared for expansion)

### 3. Scheduler Jobs
- **Ranking Crawl**: Hourly product ranking updates
- **Cache Cleanup**: Daily at midnight
- **Log Cleanup**: Weekly on Sunday at 2 AM

### 4. Manual Controls
All scheduled jobs can be triggered manually via API:
- `/api/v2/scheduler/trigger/ranking-crawl`
- `/api/v2/scheduler/trigger/cache-cleanup`
- `/api/v2/scheduler/trigger/log-cleanup`

## Configuration

### Environment Variables
```bash
SCHEDULER_ENABLED=true                    # Enable/disable scheduler
SCHEDULER_RANKING_CRAWL="0 * * * *"      # Cron expression (hourly)
SCHEDULER_MAX_CONCURRENT_JOBS=3          # Concurrent job limit
```

### Adding Monitoring Keywords
```bash
curl -X POST -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"laptop","platform":"coupang","priority":1,"intervalHours":1}' \
  http://mkt.techb.kr:8445/api/v2/scheduler/keywords
```

## Architecture

### Service Structure
```
SchedulerService
├── Task Management (node-cron)
├── Concurrent Job Control
├── Error Handling & Retry Logic
└── Logging & Monitoring
```

### Data Flow
1. Scheduler checks `v2_monitoring_keywords` for due keywords
2. Executes workflow with `ignoreCache: true`
3. Saves results via `rankingService.saveSearchResults()`
4. Updates `last_crawled_at` timestamp
5. Logs execution in `v2_scheduler_logs`

## Monitoring

### Check Scheduler Status
```bash
curl -H "X-API-Key: YOUR_ADMIN_KEY" \
  http://mkt.techb.kr:8445/api/v2/scheduler/status
```

### View Recent Logs
```bash
curl -H "X-API-Key: YOUR_ADMIN_KEY" \
  http://mkt.techb.kr:8445/api/v2/scheduler/logs?limit=10
```

### Keywords Due for Crawl
```bash
curl -H "X-API-Key: YOUR_ADMIN_KEY" \
  http://mkt.techb.kr:8445/api/v2/scheduler/keywords/due
```

## Testing

Use the provided test script:
```bash
./test-scheduler.sh
```

This will:
1. Check scheduler status
2. List monitoring keywords
3. Add a test keyword
4. Trigger manual crawl
5. View execution logs

## Production Deployment

1. Enable scheduler in production:
   ```bash
   SCHEDULER_ENABLED=true
   ```

2. Monitor logs:
   ```bash
   docker compose logs -f api | grep -i scheduler
   ```

3. Database maintenance:
   - Logs are auto-cleaned after 30 days
   - Ranking history stored for 365 days
   - Consider partitioning for large datasets

## Future Enhancements

1. **Priority Queue**: Process high-priority keywords first
2. **Distributed Scheduling**: Multiple instances with lock mechanism
3. **Webhook Notifications**: Alert on ranking changes
4. **Custom Schedules**: Per-keyword cron expressions
5. **Performance Metrics**: Track crawl times and success rates