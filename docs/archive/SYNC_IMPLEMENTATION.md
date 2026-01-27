# Real-Time Sync Implementation Guide

## Architecture Overview

The UPS Package Car Tracker now supports **real-time multi-user synchronization** using:

- **Cloudflare D1**: SQLite database for persistent storage
- **Cloudflare Workers**: Serverless API endpoints
- **Polling Sync**: 5-second polling for real-time updates (WebSocket upgrade planned for Phase 2)
- **Optimistic Updates**: Instant local UI updates with server confirmation

---

## Setup Instructions

### 1. Initialize D1 Database

Run the automated setup script:

```bash
npm run setup:d1
```

This script will:
- Create development (`ups-tracker-db-dev`) and production (`ups-tracker-db`) databases
- Run schema migrations
- Update `wrangler.toml` with database IDs
- Seed development database with default cars

**Manual alternative:**

```bash
# Create databases
wrangler d1 create ups-tracker-db-dev
wrangler d1 create ups-tracker-db

# Copy database IDs from output and update wrangler.toml

# Run migrations
wrangler d1 execute ups-tracker-db-dev --file=./migrations/0001_initial_schema.sql --local
wrangler d1 execute ups-tracker-db --file=./migrations/0001_initial_schema.sql --remote
```

---

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Your Cloudflare Worker URL (update after deploying worker)
VITE_API_URL=https://ups-tracker-api.invictustitan2.workers.dev

# User ID for tracking changes (optional)
VITE_USER_ID=anonymous

# Sync interval in milliseconds (default: 5000 = 5 seconds)
VITE_SYNC_INTERVAL=5000

# Enable/disable real-time sync
VITE_ENABLE_SYNC=true
```

---

### 3. Deploy the Worker API

Deploy the Cloudflare Worker:

```bash
npm run deploy:worker
```

This deploys `workers/api.js` to Cloudflare Workers. After deployment, you'll see the worker URL:

```
Published ups-tracker-api
  https://ups-tracker-api.invictustitan2.workers.dev
```

Update your `.env` file with this URL.

---

### 4. Test the API

Verify the worker is running:

```bash
curl https://ups-tracker-api.invictustitan2.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-23T..."}
```

Test getting all cars:

```bash
curl https://ups-tracker-api.invictustitan2.workers.dev/api/cars
```

---

### 5. Deploy the Frontend

Build and deploy the updated frontend:

```bash
npm run build
npm run deploy
```

Or use the helper:

```bash
ups_deploy_prod
```

---

## Database Schema

### `cars` table
Primary data storage for package cars.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Car ID (primary key) |
| `location` | TEXT | Current location (Yard, 100, 200, etc.) |
| `arrived` | INTEGER | 0 or 1 (boolean) |
| `late` | INTEGER | 0 or 1 (boolean) |
| `empty` | INTEGER | 0 or 1 (boolean) |
| `notes` | TEXT | Optional notes about the car |
| `last_updated_at` | TEXT | ISO timestamp of last update |
| `last_updated_by` | TEXT | User ID who made the last change |
| `version` | INTEGER | Optimistic concurrency control version |

### `audit_log` table
Tracks all changes for accountability.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `car_id` | TEXT | Reference to car |
| `action` | TEXT | 'created', 'updated', 'deleted' |
| `field_changed` | TEXT | Which field was changed |
| `old_value` | TEXT | Previous value |
| `new_value` | TEXT | New value |
| `changed_by` | TEXT | User ID |
| `changed_at` | TEXT | ISO timestamp |

### `shifts` table
Records shift handoffs and snapshots.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `started_at` | TEXT | Shift start timestamp |
| `ended_at` | TEXT | Shift end timestamp (null if active) |
| `started_by` | TEXT | User who started shift |
| `ended_by` | TEXT | User who ended shift |
| `notes` | TEXT | Shift notes |
| `snapshot` | TEXT | JSON snapshot of all cars at shift end |
| `stats` | TEXT | JSON stats (arrived, late, empty counts) |

---

## API Endpoints

### Health Check
```
GET /api/health
```

### Cars

**List all cars**
```
GET /api/cars
```

**Get single car**
```
GET /api/cars/:id
```

**Create car**
```
POST /api/cars
Body: { "id": "123456", "location": "Yard", "userId": "john" }
```

**Update car**
```
PUT /api/cars/:id
Body: { 
  "location": "100", 
  "arrived": true,
  "userId": "john",
  "expectedVersion": 1
}
```

**Delete car**
```
DELETE /api/cars/:id?userId=john
```

### Sync

**Get changes since timestamp**
```
GET /api/sync/changes?since=2025-11-23T10:00:00.000Z
```

### Shifts

**List recent shifts**
```
GET /api/shifts?limit=10
```

**Start shift**
```
POST /api/shifts
Body: { "action": "start", "userId": "john", "notes": "Day shift starting" }
```

**End shift**
```
POST /api/shifts
Body: { "action": "end", "userId": "john", "notes": "All cars cleared" }
```

### Audit

**Get audit logs**
```
GET /api/audit?carId=123456&limit=50
```

---

## Frontend Integration

The frontend now includes:

### API Client (`src/api/apiClient.js`)

**Basic usage:**

```javascript
import { carsApi, syncApi, shiftsApi } from './api/apiClient.js';

// Get all cars
const { cars } = await carsApi.getAll();

// Update a car
await carsApi.update('123456', {
  arrived: true,
  userId: 'john',
}, expectedVersion);

// Start sync polling
const { cars } = await syncApi.getChanges(lastSyncTimestamp);
```

### Sync Manager

Handles automatic polling for updates:

```javascript
import { SyncManager } from './api/apiClient.js';

const syncManager = new SyncManager(
  (updatedCars) => {
    // Handle updated cars
    console.log('Received updates:', updatedCars);
  },
  5000 // Poll every 5 seconds
);

syncManager.start();
```

### Optimistic Updates

Local updates are applied immediately, then confirmed by server:

```javascript
import { OptimisticUpdateManager } from './api/apiClient.js';

const optimisticMgr = new OptimisticUpdateManager();

// Add pending update
optimisticMgr.add('123456', { arrived: true });

// Later, after server confirms...
optimisticMgr.confirm('123456');

// Or rollback if server rejects
const rollback = optimisticMgr.reject('123456');
```

---

## Development Workflow

### Local Development

1. **Start local D1 database:**
   ```bash
   npm run dev:worker
   ```
   This starts Wrangler dev server with local D1 persistence.

2. **Start Vite dev server:**
   ```bash
   npm run dev
   ```

3. **Update `.env` for local development:**
   ```env
   VITE_API_URL=http://localhost:8787
   ```

### Query the Database

**Development (local):**
```bash
npm run db:query:dev -- --command="SELECT * FROM cars"
```

**Production (remote):**
```bash
npm run db:query:prod -- --command="SELECT * FROM cars LIMIT 10"
```

### Run Migrations

Apply new migrations to production:

```bash
npm run db:migrate
```

---

## Migration from localStorage to D1

The application will continue to work with localStorage for backward compatibility. To migrate existing data to D1:

1. Export current localStorage data:
   - Open browser console
   - Run: `console.log(JSON.stringify(localStorage.getItem('ups-tracker-data')))`
   - Copy the output

2. Parse and bulk insert into D1:
   - Use the Worker API to create cars from exported data
   - Or manually insert via `wrangler d1 execute`

**Migration script (to be created):**
```javascript
// scripts/migrate-to-d1.js
// Reads localStorage export and bulk inserts to D1 via API
```

---

## Conflict Resolution

The system uses **optimistic concurrency control** with version numbers:

1. Each car has a `version` field (starts at 1)
2. When updating, client sends `expectedVersion`
3. Server checks `current version === expectedVersion`
4. If match: update succeeds, version increments
5. If mismatch: server returns 409 Conflict with current state
6. Client must fetch latest state and retry

**Example conflict handling:**

```javascript
async function updateCarSafely(carId, updates, currentVersion) {
  try {
    await carsApi.update(carId, updates, currentVersion);
  } catch (error) {
    if (error.message.includes('Version conflict')) {
      // Fetch latest state
      const { car } = await carsApi.get(carId);
      // Retry with new version
      await carsApi.update(carId, updates, car.version);
    }
  }
}
```

---

## Monitoring & Debugging

### View Recent Changes

Check audit log for recent activity:

```bash
wrangler d1 execute ups-tracker-db --remote --command="
  SELECT car_id, action, changed_by, changed_at 
  FROM audit_log 
  ORDER BY changed_at DESC 
  LIMIT 20
"
```

### Active Sessions

See who's currently using the system (future feature):

```bash
wrangler d1 execute ups-tracker-db --remote --command="
  SELECT user_id, last_active_at 
  FROM sessions 
  WHERE ended_at IS NULL
"
```

### Shift History

View recent shifts:

```bash
wrangler d1 execute ups-tracker-db --remote --command="
  SELECT id, started_at, ended_at, started_by, stats
  FROM shifts 
  ORDER BY started_at DESC 
  LIMIT 5
"
```

---

## Performance Optimization

### Polling Interval

Adjust `VITE_SYNC_INTERVAL` based on needs:
- **High activity**: 3000ms (3 seconds)
- **Normal**: 5000ms (5 seconds, default)
- **Low activity**: 10000ms (10 seconds)

### Database Indexes

Already created for common queries:
- `idx_cars_location`
- `idx_cars_arrived`
- `idx_cars_late`
- `idx_audit_car_id`
- `idx_audit_changed_at`

### Caching (Future)

Planned: Cloudflare KV for caching frequently accessed data.

---

## Next Steps

1. **Test multi-user sync**: Open app in 2+ browser tabs, verify changes sync
2. **Add shift handoff UI**: Build React components for starting/ending shifts
3. **Implement WebSocket sync**: Replace polling with Durable Objects + WebSocket
4. **Add authentication**: PIN-based user login
5. **Build analytics dashboard**: Visualize usage stats and trends

---

## Troubleshooting

### Worker returns 500 error

Check Wrangler logs:
```bash
wrangler tail ups-tracker-api
```

### Database not found

Verify database binding in `wrangler.toml`:
```bash
wrangler d1 list
```

### CORS errors

Ensure worker returns proper CORS headers (already implemented in `workers/api.js`).

### Sync not working

1. Check `VITE_API_URL` in `.env`
2. Verify worker is deployed: `curl $VITE_API_URL/api/health`
3. Check browser console for errors

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-23
