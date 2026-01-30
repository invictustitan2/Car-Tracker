# Unload Module Specification

**Version**: 1.0.0  
**Status**: Planning (Doc-First)  
**Author**: AI-assisted, reviewed by maintainer  
**Created**: January 2026

---

## 1. Problem Statement

UPS unload operations use a set of physical doors (numbered 9–23) where trailers dock for package unloading. Each night:

1. **Doors are reused multiple times** – a single door may see 3+ trailers during one shift.
2. **Current state must be visible at a glance** – supervisors need a "door board" showing which doors have trailers, which are pending, and which are empty.
3. **Trailer visit history must be preserved** – each trailer occupancy is a discrete event with timestamps, percent tracking, and notes for audit/analytics.
4. **Start-of-night sweep** – operators verify each door's initial state (EMPTY, PENDING, or already OCCUPIED with leftover trailer).

The existing Package Car Tracker focuses on car location/status; it does not model door-centric unload workflows. A new, **isolated module** is required to avoid disrupting production.

---

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Provide a real-time "Door Board" UI showing doors 9–23 with current state (EMPTY, PENDING, OCCUPIED). |
| G2 | Track each trailer visit as a separate record: initial percent, remaining percent, status transitions, timestamps. |
| G3 | Lock `initial_percent` once set; only allow correction via explicit FIX action with audit event. |
| G4 | Support rapid "Verify Doors" sweep at start of night. |
| G5 | Maintain complete event log per visit for audit and analytics. |
| G6 | Deploy behind feature flag (OFF by default) so implementation can proceed without affecting prod until ready. |
| G7 | Use new routes, new API prefix, and new D1 tables only—zero changes to existing tracker code. |

---

## 3. Non-Goals

| ID | Non-Goal |
|----|----------|
| NG1 | Modifying existing car tracker functionality or UI. |
| NG2 | Real-time WebSocket updates in v1 (polling acceptable; WS can be added later). |
| NG3 | Complex analytics dashboard (future phase). |
| NG4 | Multi-facility support (single facility assumed). |
| NG5 | User authentication beyond existing API key (inherit current auth pattern). |

---

## 4. Primary Operator Workflows

### 4.1 Start-of-Night "Verify Doors" Sweep

**Actor**: Supervisor  
**Trigger**: Beginning of unload shift  

**Steps**:
1. Open Unload module → "Verify Doors" mode.
2. For each door 9–23, mark state:
   - **EMPTY**: Door has no trailer.
   - **PENDING**: Trailer expected but not yet arrived.
   - **OCCUPIED**: Trailer already docked (leftover or early arrival).
3. If OCCUPIED:
   - Enter `trailer_number` (e.g., "T4521").
   - Enter `initial_percent` (0–100, what remains to unload). This becomes LOCKED.
   - Optionally enter `origin` (e.g., "CACH", "EARPA").
4. System creates a new **visit** record for each occupied door.
5. On completion, door board reflects verified state.

**Validation**:
- Door number must be 9–23.
- `initial_percent` must be 0–100.
- Once set, `initial_percent` is immutable (see FIX action below).

---

### 4.2 Live Operations

**Actors**: Unload supervisors, operators  
**Trigger**: Trailer arrives, unloading progresses, trailer departs

#### A) Trailer Arrives at Door

1. Operator selects door (EMPTY or PENDING).
2. Creates new visit: `trailer_number`, `initial_percent`, optional `origin`.
3. Door state → OCCUPIED, linked to new visit.

#### B) Status Transitions

Visits progress through a status state machine:

| Status | Description |
|--------|-------------|
| `ARRIVED` | Trailer docked, ready to unload. |
| `IN_PROGRESS` | Unloading actively happening. |
| `COMPLETED` | Unloading finished (remaining_percent = 0 expected but not required). |
| `DEPARTED` | Trailer left the door. Door becomes EMPTY. |

#### C) Incremental Percent Updates

- `remaining_percent` can be updated at any time while `ARRIVED` or `IN_PROGRESS`.
- Constraint: `0 <= remaining_percent <= initial_percent`.
- Quick decrement UX: "25% left", "10% left", "Empty (0%)".

#### D) Departure

1. Mark visit as `DEPARTED`.
2. Door state → EMPTY (or PENDING if next trailer expected).
3. Visit record preserved for history.
4. Door ready for new visit.

---

### 4.3 Rare/Correction Actions

#### FIX_INITIAL_PERCENT

- Only action that can modify locked `initial_percent`.
- Requires explicit event logged with `reason`.
- Use case: Supervisor realizes initial estimate was wrong.

#### MOVE_DOOR (Optional, Future)

- Transfer an in-progress visit to a different door.
- Low priority for v1.

#### ADD_NOTE

- Append note to visit event log.
- No state change.

---

## 5. Domain Model and Invariants

### 5.1 Entities

```
Door (9-23)
├── door_number: INTEGER (PK, 9-23)
├── state: ENUM (EMPTY, PENDING, OCCUPIED)
├── active_visit_id: FK → Visit (nullable)
└── updated_at: TIMESTAMP

Visit
├── id: UUID (PK)
├── door_number: INTEGER (FK)
├── shift_id: FK → Shift (nullable, for grouping)
├── trailer_number: TEXT
├── origin: TEXT (nullable)
├── initial_percent: INTEGER (0-100, LOCKED after creation)
├── remaining_percent: INTEGER (0-100, mutable)
├── status: ENUM (ARRIVED, IN_PROGRESS, COMPLETED, DEPARTED)
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
└── departed_at: TIMESTAMP (nullable)

Event
├── id: INTEGER (PK, autoincrement)
├── visit_id: FK → Visit
├── action: ENUM (CREATE, ARRIVE, START, PROGRESS, FINISH, DEPART, FIX_INITIAL_PERCENT, NOTE)
├── data: JSON (percent values, notes, etc.)
├── actor: TEXT (user_id)
└── created_at: TIMESTAMP
```

### 5.2 Invariants

| ID | Invariant |
|----|-----------|
| I1 | `initial_percent` is immutable after visit creation, except via `FIX_INITIAL_PERCENT` action. |
| I2 | `0 <= remaining_percent <= initial_percent` at all times. |
| I3 | Door can have at most one `active_visit_id` at a time. |
| I4 | When door state is `EMPTY` or `PENDING`, `active_visit_id` must be NULL. |
| I5 | When door state is `OCCUPIED`, `active_visit_id` must reference a valid visit with status != `DEPARTED`. |
| I6 | Visit `status` must follow allowed transitions (see state machine). |
| I7 | `departed_at` is set when status becomes `DEPARTED`. |
| I8 | Every state change creates an Event record. |

---

## 6. State Machine

### 6.1 Door State

```
        set(PENDING)
  ┌──────────────────┐
  │                  ▼
EMPTY ◄──────────► PENDING
  ▲                  │
  │    assign visit  │
  │                  ▼
  └────────────── OCCUPIED
       depart
```

- **EMPTY → PENDING**: Supervisor expects trailer.
- **PENDING → OCCUPIED**: Trailer assigned/arrived.
- **EMPTY → OCCUPIED**: Trailer assigned directly.
- **OCCUPIED → EMPTY**: Visit departs (most common).
- **OCCUPIED → PENDING**: Visit departs, next trailer expected (optional shortcut).
- **PENDING → EMPTY**: Trailer not coming after all.

### 6.2 Visit Status

```
ARRIVED ──► IN_PROGRESS ──► COMPLETED ──► DEPARTED
   │              │              │
   │              └──────────────┤ (skip allowed)
   └─────────────────────────────┘
```

**Allowed Transitions**:
| From | To | Notes |
|------|----|-------|
| `ARRIVED` | `IN_PROGRESS` | Unloading starts |
| `ARRIVED` | `DEPARTED` | Quick departure (trailer pulled) |
| `IN_PROGRESS` | `COMPLETED` | Unloading finished |
| `IN_PROGRESS` | `DEPARTED` | Early departure |
| `COMPLETED` | `DEPARTED` | Normal departure after completion |

**Illegal Transitions** (examples):
- `DEPARTED` → any (final state)
- `COMPLETED` → `ARRIVED` (no backwards)
- `IN_PROGRESS` → `ARRIVED` (no backwards)

---

## 7. Isolation Contract

The Unload module MUST remain isolated from the existing tracker application until explicitly enabled.

### 7.1 New Resources Only

| Resource Type | Unload Module | Existing Tracker |
|---------------|---------------|------------------|
| **Routes** | `/unload`, `/unload/*` | `/`, `/cars`, etc. |
| **API Prefix** | `/api/unload/*` | `/api/cars`, `/api/shifts`, etc. |
| **D1 Tables** | `unload_doors`, `unload_visits`, `unload_events` | `cars`, `shifts`, `audit_log`, etc. |
| **KV Namespaces** | None (share rate limiting) | `RATE_LIMIT_KV` |
| **Durable Objects** | None initially | `TrackerWebSocket` |

### 7.2 Feature Flag

```javascript
// Proposed env variable
ENABLE_UNLOAD_MODULE = "false"  // default OFF

// Worker routing check
if (path.startsWith('/api/unload/')) {
  if (env.ENABLE_UNLOAD_MODULE !== 'true') {
    return jsonResponse({ error: 'Unload module not enabled' }, corsHeaders, 404);
  }
  return await handleUnloadRequest(request, env, corsHeaders);
}
```

**Frontend**:
- Nav item hidden when feature flag OFF.
- Route `/unload` returns 404 or redirects to home when disabled.

**V1 Scope**: Environment-based flag only (dev/prod). No per-user or per-session toggles in v1 to avoid "works for me" debugging complexity.

### 7.3 Rollback Strategy

1. Set `ENABLE_UNLOAD_MODULE = false` in Cloudflare environment.
2. Unload API returns 404; nav item hidden.
3. Existing tracker unaffected.
4. If data needs to be purged: drop tables via migration (no cascade to existing tables).

---

## 8. Alignment with Existing Patterns

### 8.1 API Error Envelope

From `workers/api.js` (lines 239-256):

```javascript
// 401 - Authentication
return jsonResponse({ error: 'Authentication required' }, corsHeaders, 401);

// 429 - Rate limit
return jsonResponse({ error: 'Rate limit exceeded' }, corsHeaders, 429);

// 400 - Validation
return jsonResponse({ error: 'Validation failed', details: error.message }, corsHeaders, 400);

// 404 - Not found
return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

// 500 - Server error
return jsonResponse({ 
  error: 'Internal server error',
  ...(isDevelopment && { message: error.message, stack: error.stack })
}, corsHeaders, 500);
```

Unload module MUST use the same envelope pattern:
```javascript
// Success
{ "success": true, ...data }

// Error
{ "error": "Error message", "details": "..." }
```

### 8.2 Authentication

From `workers/auth.js` (lines 31-55):
- All API requests validated via `X-API-Key` header.
- `validateApiKey(request, env)` called before routing.
- Rate limiting via `checkRateLimit(env, clientIP, path)`.

Unload endpoints MUST use the same guards—no new auth mechanism.

### 8.3 Shift/Session Concepts

From `migrations/0001_initial_schema.sql` (lines 39-53):
- `shifts` table: `started_at`, `ended_at`, `started_by`, `ended_by`, `notes`, `snapshot`, `stats`.
- Unload module links visits to shifts via `shift_id` FK for grouping.

From `src/api/apiClient.js` (lines 106-120):
```javascript
export const shiftsApi = {
  async getRecent(limit = 10) { return apiRequest(`/api/shifts?limit=${limit}`); },
  async start(userId, notes = '') { ... },
  async end(userId, notes = '') { ... },
};
```

**V1 Behavior**: 
- When creating a visit, auto-attach to the current active shift if one exists (query: `SELECT id FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`).
- If no active shift, `shift_id` is NULL.
- No separate "unload shift" concept in v1—reuse existing shift.

### 8.4 Frontend Routing

From `src/App.jsx`: No React Router used—single-page app with component switching.

**V1 Approach**: Use hash-based routing (`#unload`) to avoid modifying existing App.jsx with a global router. React Router deferred to Phase 2.

Recommendation: Introduce React Router with lazy-loaded Unload component to minimize bundle impact on existing tracker.

---

## 9. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Should doors have a persistent "master list" or be dynamic? | Doors 9–23 are fixed; pre-populated in `unload_doors` table. |
| How to handle shift boundaries for visits? | Optional `shift_id` FK; visits not required to have shift link. |
| Should remaining_percent support decimals? | No, integers 0–100 are sufficient for UX. |
| How many trailers per door per night? | Typically 1–5; data model supports unlimited. |

---

## 10. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Door board displays correct state for all doors | Manual verification during shift |
| Visit lifecycle events recorded in event log | Query `unload_events` table |
| Initial percent locked correctly | Attempt update via API, expect 400 |
| Existing tracker unaffected | E2E tests pass, no regressions |
| Feature flag controls visibility | Toggle flag, verify nav/API behavior |

---

## References

- `workers/api.js` - API patterns, error handling
- `workers/auth.js` - Authentication, rate limiting
- `workers/validators.js` - Input validation patterns
- `migrations/0001_initial_schema.sql` - D1 schema patterns
- `src/api/apiClient.js` - Frontend API client patterns
- `docs/SECURITY.md` - Security implementation guide
