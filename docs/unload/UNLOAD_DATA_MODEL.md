# Unload Module Data Model

**Version**: 1.0.0  
**Status**: Planning (Doc-First)  
**Related**: [UNLOAD_SPEC.md](./UNLOAD_SPEC.md)

---

## 1. Overview

The Unload module uses **three new D1 tables** that are completely isolated from existing tracker tables. No existing tables are modified.

**Design Principles**:
1. **Door = Current State Pointer** – Lightweight, frequently read, rarely written.
2. **Visit = History Record** – One row per trailer occupancy, with mutable status and percent.
3. **Event = Append-Only Receipt** – Every action logged for audit.

---

## 2. Tables

### 2.1 `unload_doors` – Current Door State

Represents the **current** state of each physical door. Updated when a trailer arrives or departs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `door_number` | INTEGER | PRIMARY KEY, CHECK(9-23) | Physical door number |
| `state` | TEXT | NOT NULL, DEFAULT 'EMPTY' | One of: EMPTY, PENDING, OCCUPIED |
| `active_visit_id` | TEXT | FK → unload_visits(id), NULLABLE | Currently docked trailer's visit |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last state change |
| `updated_by` | TEXT | NULLABLE | User who made last change |

**Indexes**:
- `idx_unload_doors_state` on `state` (for filtering)

**Rationale**:
- Fixed set of 15 doors (9–23), pre-populated.
- Separate from visits to enable fast "door board" queries.
- `active_visit_id` nullable when door is EMPTY or PENDING.

---

### 2.2 `unload_visits` – Trailer Visit History

One row per trailer visit. A door may have many visits over a shift (or across shifts).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `door_number` | INTEGER | NOT NULL, FK → unload_doors | Door where trailer docked |
| `shift_id` | INTEGER | NULLABLE, FK → shifts(id) | Optional link to existing shift |
| `trailer_number` | TEXT | NOT NULL | Trailer identifier (e.g., "T4521") |
| `origin` | TEXT | NULLABLE | Origin hub (e.g., "CACH", "EARPA") |
| `initial_percent` | INTEGER | NOT NULL, CHECK(0-100) | Starting percent to unload (LOCKED) |
| `remaining_percent` | INTEGER | NOT NULL, CHECK(0-100) | Current percent remaining |
| `status` | TEXT | NOT NULL, DEFAULT 'ARRIVED' | ARRIVED, IN_PROGRESS, COMPLETED, DEPARTED |
| `created_at` | TEXT | DEFAULT datetime('now') | Visit creation timestamp |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last update timestamp |
| `departed_at` | TEXT | NULLABLE | When trailer departed |
| `notes` | TEXT | NULLABLE | Free-form notes |

**Indexes**:
- `idx_unload_visits_door` on `door_number`
- `idx_unload_visits_status` on `status`
- `idx_unload_visits_shift` on `shift_id`
- `idx_unload_visits_created` on `created_at`

**Constraints**:
- `CHECK(remaining_percent >= 0 AND remaining_percent <= initial_percent)` – enforced at application level due to D1 limitations on complex CHECK.

**Rationale**:
- UUID primary key for client-side ID generation (like existing `sessions` table).
- `initial_percent` immutability enforced by application (updates rejected unless via FIX action).
- `shift_id` optional to allow visits without active shift.

---

### 2.3 `unload_events` – Append-Only Audit Log

Every action on a visit creates an event record. Never updated or deleted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Event sequence |
| `visit_id` | TEXT | NOT NULL, FK → unload_visits(id) | Related visit |
| `action` | TEXT | NOT NULL | Action type (see enum) |
| `data` | TEXT | NULLABLE | JSON payload with action-specific data |
| `actor` | TEXT | NOT NULL | User ID who performed action |
| `created_at` | TEXT | DEFAULT datetime('now') | Event timestamp |

**Action Enum Values**:
- `CREATE` – Visit created
- `ARRIVE` – Status → ARRIVED (if not initial)
- `START` – Status → IN_PROGRESS
- `PROGRESS` – `remaining_percent` updated (absolute set)
- `PROGRESS_DELTA` – `remaining_percent` updated (delta, clamped)
- `FINISH` – Status → COMPLETED
- `DEPART` – Status → DEPARTED
- `FIX_INITIAL_PERCENT` – `initial_percent` corrected
- `NOTE` – Note added
- `DOOR_SET` – Door state changed (EMPTY/PENDING, no visit involved)

**Indexes**:
- `idx_unload_events_visit` on `visit_id`
- `idx_unload_events_action` on `action`
- `idx_unload_events_created` on `created_at`

**Rationale**:
- Append-only for audit integrity.
- `data` is JSON for flexibility (e.g., `{"old_percent": 50, "new_percent": 25}`).
- Matches pattern of existing `audit_log` table but scoped to Unload.

---

## 3. Door Reuse Model

### 3.1 How Door Reuse Works

```
Timeline for Door #12:

Shift Start (6 PM)
├── EMPTY
├── Visit A (trailer T1001) arrives → OCCUPIED
│   ├── IN_PROGRESS
│   ├── COMPLETED
│   └── DEPARTED → Door becomes EMPTY
├── EMPTY (door available)
├── Visit B (trailer T1044) arrives → OCCUPIED
│   ├── IN_PROGRESS
│   └── DEPARTED (early pull) → Door becomes EMPTY
├── EMPTY
├── Visit C (trailer T1099) arrives → OCCUPIED
│   ├── COMPLETED
│   └── DEPARTED → Door becomes EMPTY
└── Shift End
```

Each visit is a **separate row** in `unload_visits`. The door's `active_visit_id` points to the current visit (or NULL when empty).

### 3.2 Query Patterns

**Door Board (Current State)**:
```sql
SELECT 
  d.door_number,
  d.state,
  v.id as visit_id,
  v.trailer_number,
  v.remaining_percent,
  v.status
FROM unload_doors d
LEFT JOIN unload_visits v ON d.active_visit_id = v.id
ORDER BY d.door_number;
```

**Visit History for Door**:
```sql
SELECT * FROM unload_visits
WHERE door_number = ?
ORDER BY created_at DESC
LIMIT 50;
```

**Events for Visit**:
```sql
SELECT * FROM unload_events
WHERE visit_id = ?
ORDER BY created_at ASC;
```

**All Visits in Current Shift**:
```sql
SELECT v.* FROM unload_visits v
JOIN shifts s ON v.shift_id = s.id
WHERE s.ended_at IS NULL
ORDER BY v.created_at DESC;
```

---

## 4. Data Retention

### 4.1 Current Shift Definition

The Unload module aligns with the existing `shifts` table:
- Active shift: `SELECT * FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
- Visits created during a shift get `shift_id` set.
- Visits created without an active shift have `shift_id = NULL`.

### 4.2 Historical Data

**Retention Policy** (proposed):
- Visits: Keep indefinitely (rows are small, ~1KB each).
- Events: Keep indefinitely for audit.
- Consider archival after 90 days if volume becomes problematic.

**Future**: Add `archived_at` column to visits if needed for soft archive.

---

## 5. Migration SQL (DRAFT)

> **WARNING**: This is a DRAFT. Do NOT apply to production until implementation phase.

```sql
-- Migration: Create Unload Module Tables
-- File: migrations/XXXX_unload_module.sql

-- Table: unload_doors
-- Current state of each physical door
CREATE TABLE IF NOT EXISTS unload_doors (
  door_number INTEGER PRIMARY KEY CHECK (door_number >= 9 AND door_number <= 23),
  state TEXT NOT NULL DEFAULT 'EMPTY' CHECK (state IN ('EMPTY', 'PENDING', 'OCCUPIED')),
  active_visit_id TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Pre-populate doors 9-23
INSERT OR IGNORE INTO unload_doors (door_number, state) VALUES
  (9, 'EMPTY'), (10, 'EMPTY'), (11, 'EMPTY'), (12, 'EMPTY'), (13, 'EMPTY'),
  (14, 'EMPTY'), (15, 'EMPTY'), (16, 'EMPTY'), (17, 'EMPTY'), (18, 'EMPTY'),
  (19, 'EMPTY'), (20, 'EMPTY'), (21, 'EMPTY'), (22, 'EMPTY'), (23, 'EMPTY');

CREATE INDEX IF NOT EXISTS idx_unload_doors_state ON unload_doors(state);

-- Table: unload_visits
-- One row per trailer visit (door reuse creates multiple visits per door)
CREATE TABLE IF NOT EXISTS unload_visits (
  id TEXT PRIMARY KEY,
  door_number INTEGER NOT NULL,
  shift_id INTEGER,
  trailer_number TEXT NOT NULL,
  origin TEXT,
  initial_percent INTEGER NOT NULL CHECK (initial_percent >= 0 AND initial_percent <= 100),
  remaining_percent INTEGER NOT NULL CHECK (remaining_percent >= 0 AND remaining_percent <= 100),
  status TEXT NOT NULL DEFAULT 'ARRIVED' CHECK (status IN ('ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DEPARTED')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  departed_at TEXT,
  notes TEXT,
  FOREIGN KEY (door_number) REFERENCES unload_doors(door_number),
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_unload_visits_door ON unload_visits(door_number);
CREATE INDEX IF NOT EXISTS idx_unload_visits_status ON unload_visits(status);
CREATE INDEX IF NOT EXISTS idx_unload_visits_shift ON unload_visits(shift_id);
CREATE INDEX IF NOT EXISTS idx_unload_visits_created ON unload_visits(created_at);

-- Table: unload_events
-- Append-only event log for each visit
CREATE TABLE IF NOT EXISTS unload_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'CREATE', 'ARRIVE', 'START', 'PROGRESS', 'PROGRESS_DELTA', 'FINISH', 'DEPART',
    'FIX_INITIAL_PERCENT', 'NOTE', 'DOOR_SET'
  )),
  data TEXT,
  actor TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (visit_id) REFERENCES unload_visits(id)
);

CREATE INDEX IF NOT EXISTS idx_unload_events_visit ON unload_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_unload_events_action ON unload_events(action);
CREATE INDEX IF NOT EXISTS idx_unload_events_created ON unload_events(created_at);

-- Add FK constraint from doors to visits (SQLite doesn't enforce by default)
-- Enforcement happens at application layer
```

---

## 6. Comparison with Existing Schema

| Aspect | Existing Tracker | Unload Module |
|--------|------------------|---------------|
| **Main Entity** | `cars` (current state) | `unload_visits` (history) + `unload_doors` (current) |
| **Audit Log** | `audit_log` (per car) | `unload_events` (per visit) |
| **Shift Link** | `shifts` table | Reuses `shifts` table via FK |
| **Primary Key** | `cars.id` (TEXT, car ID) | `visits.id` (UUID), `doors.door_number` (INT) |
| **State Field** | `arrived`, `late`, `empty` (booleans) | `status` (enum), `state` (enum) |

---

## 7. Schema Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         EXISTING TABLES                          │
├──────────────────────────────────────────────────────────────────┤
│  shifts                                                          │
│  ├── id (PK)                                                     │
│  ├── started_at, ended_at                                        │
│  └── ...                                                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ FK (optional)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      NEW: UNLOAD TABLES                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  unload_doors                    unload_visits                   │
│  ├── door_number (PK, 9-23)      ├── id (PK, UUID)               │
│  ├── state (EMPTY/PENDING/OCC)   ├── door_number (FK) ◄──────────┤
│  ├── active_visit_id (FK) ──────►├── shift_id (FK → shifts)      │
│  ├── updated_at                  ├── trailer_number              │
│  └── updated_by                  ├── origin                      │
│                                  ├── initial_percent (LOCKED)    │
│                                  ├── remaining_percent           │
│                                  ├── status                      │
│                                  ├── created_at, updated_at      │
│                                  ├── departed_at                 │
│                                  └── notes                       │
│                                           │                      │
│                                           │ FK                   │
│                                           ▼                      │
│                                  unload_events                   │
│                                  ├── id (PK, autoincrement)      │
│                                  ├── visit_id (FK)               │
│                                  ├── action                      │
│                                  ├── data (JSON)                 │
│                                  ├── actor                       │
│                                  └── created_at                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Examples

### 8.1 Door Record

```json
{
  "door_number": 12,
  "state": "OCCUPIED",
  "active_visit_id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
  "updated_at": "2026-01-30T02:15:00.000Z",
  "updated_by": "supervisor1"
}
```

### 8.2 Visit Record

```json
{
  "id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
  "door_number": 12,
  "shift_id": 42,
  "trailer_number": "T4521",
  "origin": "CACH",
  "initial_percent": 75,
  "remaining_percent": 25,
  "status": "IN_PROGRESS",
  "created_at": "2026-01-30T02:15:00.000Z",
  "updated_at": "2026-01-30T03:45:00.000Z",
  "departed_at": null,
  "notes": "Heavy freight, need extra help"
}
```

### 8.3 Event Records

```json
[
  {
    "id": 1,
    "visit_id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "action": "CREATE",
    "data": "{\"initial_percent\": 75, \"trailer_number\": \"T4521\"}",
    "actor": "supervisor1",
    "created_at": "2026-01-30T02:15:00.000Z"
  },
  {
    "id": 2,
    "visit_id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "action": "START",
    "data": null,
    "actor": "operator1",
    "created_at": "2026-01-30T02:20:00.000Z"
  },
  {
    "id": 3,
    "visit_id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "action": "PROGRESS",
    "data": "{\"old_percent\": 75, \"new_percent\": 50}",
    "actor": "operator1",
    "created_at": "2026-01-30T03:00:00.000Z"
  },
  {
    "id": 4,
    "visit_id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
    "action": "PROGRESS",
    "data": "{\"old_percent\": 50, \"new_percent\": 25}",
    "actor": "operator2",
    "created_at": "2026-01-30T03:45:00.000Z"
  }
]
```

---

## References

- `migrations/0001_initial_schema.sql` – Existing D1 schema patterns
- `workers/api.js` – D1 query patterns (prepare/bind/run/first/all)
- [UNLOAD_SPEC.md](./UNLOAD_SPEC.md) – Domain model and invariants
