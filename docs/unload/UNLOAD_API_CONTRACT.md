# Unload Module API Contract

**Version**: 1.0.0  
**Status**: Planning (Doc-First)  
**Base Path**: `/api/unload`  
**Related**: [UNLOAD_SPEC.md](./UNLOAD_SPEC.md), [UNLOAD_DATA_MODEL.md](./UNLOAD_DATA_MODEL.md)

---

## 1. Overview

All Unload endpoints are prefixed with `/api/unload/` and isolated from existing `/api/*` routes. The module inherits the existing authentication, rate limiting, and error handling patterns.

### 1.1 Authentication

All requests require the `X-API-Key` header (same as existing API):

```http
X-API-Key: <your-api-key>
```

See: `workers/auth.js:validateApiKey()` (lines 31-55)

### 1.2 Error Envelope

Follows existing pattern from `workers/api.js` (lines 239-256):

```javascript
// Success
{ "success": true, ...data }

// Error
{ 
  "error": "Error message",
  "details": "Optional details for validation errors"
}
```

**HTTP Status Codes**:
| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | GET requests, successful updates |
| 201 | Created | New visit created |
| 400 | Bad Request | Validation failure |
| 401 | Unauthorized | Missing/invalid API key |
| 404 | Not Found | Resource not found or module disabled |
| 409 | Conflict | Invalid state transition |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Unexpected error |

### 1.3 Feature Flag

When `ENABLE_UNLOAD_MODULE !== 'true'`, all `/api/unload/*` endpoints return:

```json
HTTP/1.1 404 Not Found
{ "error": "Unload module not enabled" }
```

---

## 2. Endpoints

### 2.1 Shifts (Optional Integration)

The Unload module can optionally integrate with existing shifts for grouping visits.

#### GET `/api/unload/shifts/current`

Get the current active shift (if any) and door board state.

**Response** (200):
```json
{
  "success": true,
  "shift": {
    "id": 42,
    "startedAt": "2026-01-30T00:00:00.000Z",
    "startedBy": "supervisor1",
    "notes": "Night shift starting"
  },
  "doors": [
    {
      "doorNumber": 9,
      "state": "EMPTY",
      "activeVisit": null
    },
    {
      "doorNumber": 12,
      "state": "OCCUPIED",
      "activeVisit": {
        "id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
        "trailerNumber": "T4521",
        "origin": "CACH",
        "initialPercent": 75,
        "remainingPercent": 25,
        "status": "IN_PROGRESS",
        "createdAt": "2026-01-30T02:15:00.000Z"
      }
    }
  ]
}
```

**Response** (200, no active shift):
```json
{
  "success": true,
  "shift": null,
  "doors": [ ... ]
}
```

---

### 2.2 Doors

#### GET `/api/unload/doors`

List all doors with current state.

**Response** (200):
```json
{
  "success": true,
  "doors": [
    {
      "doorNumber": 9,
      "state": "EMPTY",
      "activeVisit": null,
      "updatedAt": "2026-01-30T00:00:00.000Z"
    },
    {
      "doorNumber": 10,
      "state": "PENDING",
      "activeVisit": null,
      "updatedAt": "2026-01-30T01:00:00.000Z"
    },
    {
      "doorNumber": 12,
      "state": "OCCUPIED",
      "activeVisit": {
        "id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
        "trailerNumber": "T4521",
        "remainingPercent": 25,
        "status": "IN_PROGRESS"
      },
      "updatedAt": "2026-01-30T02:15:00.000Z"
    }
  ]
}
```

---

#### POST `/api/unload/doors/{door}/set`

Set door state (EMPTY or PENDING). Used for doors without an active visit.

**Path Parameters**:
- `door` (integer, required): Door number 9-23

**Request Body**:
```json
{
  "state": "PENDING",
  "userId": "supervisor1"
}
```

**Validation**:
- `door`: Must be integer 9-23
- `state`: Must be "EMPTY" or "PENDING" (not "OCCUPIED" – use visit creation)
- `userId`: Required, 1-100 characters (uses existing `Validators.userId()`)

**Response** (200):
```json
{
  "success": true,
  "door": {
    "doorNumber": 10,
    "state": "PENDING",
    "activeVisit": null,
    "updatedAt": "2026-01-30T01:30:00.000Z"
  }
}
```

**Error** (400 - Door has active visit):
```json
{
  "error": "Validation failed",
  "details": "Cannot set state while door has active visit. Depart the trailer first."
}
```

**Error** (400 - Invalid door):
```json
{
  "error": "Validation failed",
  "details": "Door number must be between 9 and 23"
}
```

---

### 2.3 Visits

#### POST `/api/unload/visits`

Create a new visit and assign to a door. Sets door state to OCCUPIED.

**Request Body**:
```json
{
  "doorNumber": 12,
  "trailerNumber": "T4521",
  "initialPercent": 75,
  "origin": "CACH",
  "userId": "supervisor1"
}
```

**Validation**:
- `doorNumber`: Integer 9-23, door must not already be OCCUPIED
- `trailerNumber`: Required, 1-20 characters, alphanumeric + dashes
- `initialPercent`: Required, integer 0-100
- `origin`: Optional, 1-20 characters
- `userId`: Required (uses `Validators.userId()`)

**Response** (201):
```json
{
  "success": true,
  "visit": {
    "id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "doorNumber": 12,
    "shiftId": 42,
    "trailerNumber": "T4521",
    "origin": "CACH",
    "initialPercent": 75,
    "remainingPercent": 75,
    "status": "ARRIVED",
    "createdAt": "2026-01-30T02:15:00.000Z"
  },
  "door": {
    "doorNumber": 12,
    "state": "OCCUPIED",
    "activeVisit": { ... }
  }
}
```

**Error** (409 - Door already occupied):
```json
{
  "error": "Conflict",
  "details": "Door 12 already has an active visit. Depart trailer first."
}
```

---

#### GET `/api/unload/visits/{id}`

Get visit details.

**Path Parameters**:
- `id` (UUID, required): Visit ID

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "doorNumber": 12,
    "shiftId": 42,
    "trailerNumber": "T4521",
    "origin": "CACH",
    "initialPercent": 75,
    "remainingPercent": 25,
    "status": "IN_PROGRESS",
    "createdAt": "2026-01-30T02:15:00.000Z",
    "updatedAt": "2026-01-30T03:45:00.000Z",
    "departedAt": null,
    "notes": "Heavy freight"
  }
}
```

---

#### POST `/api/unload/visits/{id}/action`

Perform an action on a visit.

**Path Parameters**:
- `id` (UUID, required): Visit ID

**Request Body** (varies by action):

##### Action: `START` (→ IN_PROGRESS)

```json
{
  "action": "START",
  "userId": "operator1"
}
```

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "status": "IN_PROGRESS",
    "updatedAt": "..."
  },
  "event": {
    "id": 5,
    "action": "START",
    "createdAt": "..."
  }
}
```

##### Action: `PROGRESS` (Update remaining_percent)

```json
{
  "action": "PROGRESS",
  "remainingPercent": 25,
  "userId": "operator1"
}
```

**Validation**:
- `remainingPercent`: Integer 0-100, must be <= `initial_percent`
- Status must be `ARRIVED` or `IN_PROGRESS`

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "remainingPercent": 25,
    "updatedAt": "..."
  },
  "event": {
    "id": 6,
    "action": "PROGRESS",
    "data": "{\"old_percent\": 50, \"new_percent\": 25}",
    "createdAt": "..."
  }
}
```

**Error** (400 - Invalid percent):
```json
{
  "error": "Validation failed",
  "details": "remaining_percent (90) cannot exceed initial_percent (75)"
}
```

##### Action: `PROGRESS_DELTA` (Quick decrement)

For fast UI taps (e.g., "Quick Update" buttons). Server computes new value.

```json
{
  "action": "PROGRESS_DELTA",
  "delta": -25,
  "userId": "operator1"
}
```

**Validation**:
- `delta`: Integer (typically negative for "less remaining")
- Result clamped to `0 <= new_remaining <= initial_percent`
- Status must be `ARRIVED` or `IN_PROGRESS`

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "remainingPercent": 25,
    "updatedAt": "..."
  },
  "event": {
    "id": 7,
    "action": "PROGRESS_DELTA",
    "data": "{\"delta\": -25, \"old_percent\": 50, \"new_percent\": 25}",
    "createdAt": "..."
  }
}
```

**Note**: If delta would push remaining below 0, server clamps to 0. If delta would push above initial, server clamps to initial. This makes the action safe for rapid taps without validation errors.

##### Action: `FINISH` (→ COMPLETED)

```json
{
  "action": "FINISH",
  "userId": "operator1"
}
```

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "status": "COMPLETED",
    "remainingPercent": 0,
    "updatedAt": "..."
  }
}
```

##### Action: `DEPART` (→ DEPARTED, Door → EMPTY)

```json
{
  "action": "DEPART",
  "userId": "supervisor1",
  "nextDoorState": "EMPTY"
}
```

**Optional Parameters**:
- `nextDoorState`: "EMPTY" (default) or "PENDING" (expecting next trailer)

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "status": "DEPARTED",
    "departedAt": "2026-01-30T04:00:00.000Z"
  },
  "door": {
    "doorNumber": 12,
    "state": "EMPTY",
    "activeVisit": null
  }
}
```

##### Action: `FIX_INITIAL_PERCENT` (Correct locked value)

```json
{
  "action": "FIX_INITIAL_PERCENT",
  "newInitialPercent": 80,
  "reason": "Supervisor corrected initial estimate",
  "userId": "supervisor1"
}
```

**Validation**:
- `newInitialPercent`: Required, integer 0-100
- `reason`: Required, 1-500 characters
- Only supervisors should use this (enforcement optional at API level)

**Response** (200):
```json
{
  "success": true,
  "visit": {
    "id": "...",
    "initialPercent": 80
  },
  "event": {
    "id": 7,
    "action": "FIX_INITIAL_PERCENT",
    "data": "{\"old_initial\": 75, \"new_initial\": 80, \"reason\": \"...\"}",
    "createdAt": "..."
  }
}
```

##### Action: `NOTE` (Add note to event log)

```json
{
  "action": "NOTE",
  "note": "Trailer has some damaged packages",
  "userId": "operator1"
}
```

**Validation**:
- `note`: Required, 1-1000 characters (uses existing `Validators.notes()` pattern)

**Response** (200):
```json
{
  "success": true,
  "event": {
    "id": 8,
    "action": "NOTE",
    "data": "{\"note\": \"Trailer has some damaged packages\"}",
    "createdAt": "..."
  }
}
```

---

#### GET `/api/unload/visits/{id}/events`

Get event timeline for a visit.

**Path Parameters**:
- `id` (UUID, required): Visit ID

**Query Parameters**:
- `limit` (integer, optional): Max events, default 100

**Response** (200):
```json
{
  "success": true,
  "events": [
    {
      "id": 1,
      "action": "CREATE",
      "data": "{\"initial_percent\": 75}",
      "actor": "supervisor1",
      "createdAt": "2026-01-30T02:15:00.000Z"
    },
    {
      "id": 2,
      "action": "START",
      "data": null,
      "actor": "operator1",
      "createdAt": "2026-01-30T02:20:00.000Z"
    },
    {
      "id": 3,
      "action": "PROGRESS",
      "data": "{\"old_percent\": 75, \"new_percent\": 50}",
      "actor": "operator1",
      "createdAt": "2026-01-30T03:00:00.000Z"
    }
  ]
}
```

---

#### GET `/api/unload/visits`

List visits with optional filters.

**Query Parameters**:
- `door` (integer, optional): Filter by door number
- `status` (string, optional): Filter by status (ARRIVED, IN_PROGRESS, COMPLETED, DEPARTED)
- `shiftId` (integer, optional): Filter by shift
- `limit` (integer, optional): Max results, default 50, max 200
- `offset` (integer, optional): Pagination offset

**Response** (200):
```json
{
  "success": true,
  "visits": [ ... ],
  "pagination": {
    "total": 127,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2.4 Verify Doors (Bulk Operation)

#### POST `/api/unload/doors/verify`

Bulk verify doors at start of shift. Creates visits for occupied doors.

**Request Body**:
```json
{
  "userId": "supervisor1",
  "doors": [
    { "doorNumber": 9, "state": "EMPTY" },
    { "doorNumber": 10, "state": "PENDING" },
    { "doorNumber": 12, "state": "OCCUPIED", "trailerNumber": "T1001", "initialPercent": 50 },
    { "doorNumber": 15, "state": "OCCUPIED", "trailerNumber": "T1002", "initialPercent": 80, "origin": "CACH" }
  ]
}
```

**Validation**:
- Each door entry validated per field rules above.
- OCCUPIED entries require `trailerNumber` and `initialPercent`.

**Response** (200):
```json
{
  "success": true,
  "results": {
    "doorsUpdated": 15,
    "visitsCreated": 2,
    "errors": []
  },
  "doors": [ ... ]
}
```

**Partial Success** (200 with errors):
```json
{
  "success": true,
  "results": {
    "doorsUpdated": 14,
    "visitsCreated": 1,
    "errors": [
      { "doorNumber": 12, "error": "Door already has active visit" }
    ]
  },
  "doors": [ ... ]
}
```

---

## 3. Validation Rules

### 3.1 Field Validators

Using existing patterns from `workers/validators.js`:

| Field | Rule | Error Message |
|-------|------|---------------|
| `doorNumber` | Integer 9-23 | "Door number must be between 9 and 23" |
| `trailerNumber` | Alphanumeric + dash, 1-20 chars | "Trailer number must be 1-20 alphanumeric characters" |
| `initialPercent` | Integer 0-100 | "Initial percent must be between 0 and 100" |
| `remainingPercent` | Integer 0-100, <= initialPercent | "Remaining percent must be between 0 and initial percent" |
| `origin` | Alphanumeric, 1-20 chars (optional) | "Origin must be 1-20 alphanumeric characters" |
| `userId` | Existing `Validators.userId()` | (see validators.js) |
| `note` | Existing `Validators.notes()` pattern | "Note must be 1000 characters or less" |
| `reason` | 1-500 chars for FIX actions | "Reason is required for corrections" |

### 3.2 Proposed Validator (workers/validators.js extension)

```javascript
/**
 * Validate door number
 */
doorNumber(door) {
  const num = parseInt(door, 10);
  if (isNaN(num) || num < 9 || num > 23) {
    throw new ValidationError('Door number must be between 9 and 23', 'doorNumber');
  }
  return num;
},

/**
 * Validate trailer number
 */
trailerNumber(trailer) {
  if (!trailer) {
    throw new ValidationError('Trailer number is required', 'trailerNumber');
  }
  const sanitized = String(trailer).trim().toUpperCase();
  if (sanitized.length === 0 || sanitized.length > 20) {
    throw new ValidationError('Trailer number must be 1-20 characters', 'trailerNumber');
  }
  if (!/^[A-Z0-9-]+$/i.test(sanitized)) {
    throw new ValidationError('Trailer number must be alphanumeric with dashes only', 'trailerNumber');
  }
  return sanitized;
},

/**
 * Validate percent (0-100)
 */
percent(value, fieldName = 'percent') {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new ValidationError(`${fieldName} must be between 0 and 100`, fieldName);
  }
  return num;
},
```

---

## 4. Concurrency Considerations

### 4.1 Double Tap Prevention

**Problem**: Operator taps "Depart" twice quickly, creating race condition.

**Solution**: Check visit status before state transition:
```sql
UPDATE unload_visits 
SET status = 'DEPARTED', departed_at = datetime('now')
WHERE id = ? AND status != 'DEPARTED'
```

If no rows affected, visit already departed → return success (idempotent).

### 4.2 Conflicting Door Updates

**Problem**: Two users try to assign trailers to same door simultaneously.

**Solution**: Use D1 transaction to atomically:
1. Check door is not OCCUPIED
2. Create visit
3. Update door to OCCUPIED with new visit ID

If step 1 fails, return 409 Conflict.

### 4.3 Optimistic Concurrency (Future Enhancement)

Consider adding `version` column to visits for optimistic locking:
```json
{
  "action": "PROGRESS",
  "remainingPercent": 25,
  "expectedVersion": 3
}
```

If version mismatch, return 409. Not required for v1.

---

## 5. Example cURL Commands

```bash
# Get door board
curl -H "X-API-Key: $API_KEY" \
  https://api.example.com/api/unload/doors

# Create visit
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"doorNumber":12,"trailerNumber":"T4521","initialPercent":75,"userId":"super1"}' \
  https://api.example.com/api/unload/visits

# Update progress
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"action":"PROGRESS","remainingPercent":25,"userId":"op1"}' \
  https://api.example.com/api/unload/visits/a1b2c3d4-e5f6-4789-abcd-ef0123456789/action

# Depart trailer
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"action":"DEPART","userId":"super1"}' \
  https://api.example.com/api/unload/visits/a1b2c3d4-e5f6-4789-abcd-ef0123456789/action
```

---

## References

- `workers/api.js` – Existing endpoint patterns, error handling
- `workers/auth.js` – Authentication and CORS
- `workers/validators.js` – Input validation patterns
- `src/api/apiClient.js` – Frontend API client patterns
