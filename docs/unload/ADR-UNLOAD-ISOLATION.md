# ADR: Unload Module Isolation Strategy

**Status**: Accepted  
**Date**: January 2026  
**Decision Makers**: Maintainer  

---

## Context

The UPS Package Car Tracker needs a new "Unload" module to track trailer unloading at doors 9–23. This module has fundamentally different requirements from the existing car tracker:

1. **Doors are reused** – A single door sees multiple trailers per shift.
2. **History matters** – Each trailer visit is a distinct event with its own lifecycle.
3. **Real-time door board** – Supervisors need at-a-glance view of all doors.
4. **Percent tracking** – Track how much of each trailer remains to unload.

The existing Package Car Tracker has been in production since November 2025 and must remain stable during and after Unload module development.

---

## Decision

We will implement the Unload module with **strict isolation** from the existing tracker:

### 1. Separate Data Model: Door + Visit + Event Tables

**Decision**: Create three new tables instead of extending existing tables.

**Structure**:
- `unload_doors` – Current state of each physical door (9–23)
- `unload_visits` – One row per trailer visit (many per door per shift)
- `unload_events` – Append-only audit log per visit

**Rationale**:
- Doors are reused multiple times; a single-row-per-door model would lose history.
- Visits need independent lifecycle tracking.
- Events provide complete audit trail without complex joins.

### 2. New API Prefix: `/api/unload/*`

**Decision**: All Unload endpoints use the `/api/unload/` prefix.

**Rationale**:
- Clear separation from existing `/api/cars`, `/api/shifts`, etc.
- Feature flag can gate entire prefix.
- No risk of route conflicts.

### 3. New UI Routes: `/unload`, `/unload/*`

**Decision**: Unload UI lives under `/unload` path, likely using React Router.

**Rationale**:
- Lazy-loadable, doesn't affect main bundle.
- Clear URL separation for bookmarking/sharing.
- Feature flag can hide nav item and gate route.

### 4. Feature Flag: `ENABLE_UNLOAD_MODULE`

**Decision**: Default OFF. When disabled:
- API returns 404 for `/api/unload/*`
- Nav item hidden
- Route redirects to home

**Rationale**:
- Allows implementation to proceed without affecting production.
- Can enable for testing before full rollout.
- Easy rollback by setting to `false`.

---

## Alternatives Considered

### Alternative A: Single Table per Door-Shift

**Approach**: One row per door per shift, with JSON arrays for events.

```sql
CREATE TABLE unload_door_shifts (
  door_number INTEGER,
  shift_id INTEGER,
  current_trailer TEXT,
  events TEXT, -- JSON array
  PRIMARY KEY (door_number, shift_id)
);
```

**Rejected Because**:
- Hard to query individual events.
- JSON arrays grow large, harder to index.
- Complex updates for concurrent access.
- Doesn't model door reuse cleanly.

### Alternative B: Derive State from Events Only (Event Sourcing)

**Approach**: Only store events; compute current state on read.

```sql
CREATE TABLE unload_events (
  id INTEGER PRIMARY KEY,
  door_number INTEGER,
  action TEXT,
  data TEXT,
  created_at TEXT
);
-- No doors or visits table; reconstruct state from events
```

**Rejected Because**:
- Expensive reads for door board (must replay all events).
- Complex for real-time dashboard.
- Overkill for this use case.
- Can always add event sourcing later if needed.

### Alternative C: Extend Existing `cars` Table

**Approach**: Add door-related columns to existing `cars` table.

**Rejected Because**:
- Completely different domain model (doors ≠ cars).
- Would pollute existing schema.
- Violates single responsibility principle.
- Risk of breaking existing functionality.

### Alternative D: No Feature Flag (Direct Deployment)

**Approach**: Implement and deploy Unload immediately.

**Rejected Because**:
- High risk if bugs discovered.
- No way to disable without rollback.
- Feature flag is low-cost insurance.

---

## Consequences

### Positive

1. **Zero risk to existing tracker** – Complete isolation.
2. **Independent deployment** – Can enable/disable Unload without touching tracker.
3. **Clean data model** – Matches domain requirements.
4. **Clear audit trail** – Every action logged.
5. **Future flexibility** – Can extend without legacy constraints.

### Negative

1. **More tables** – Slightly more complex schema.
2. **Some duplication** – Separate validators, components, tests.
3. **Feature flag management** – Must track flag state across environments.

### Neutral

1. **React Router dependency** – May need to add, but is standard practice.
2. **Shift integration optional** – Can link to existing shifts or operate standalone.

---

## Implementation Notes

### Data Integrity

The door → visit relationship uses:
- `unload_doors.active_visit_id` points to current visit.
- When visit departs, `active_visit_id` set to NULL, door state to EMPTY.
- Visit retains `door_number` for history queries.

### Invariant Enforcement

Key invariants enforced at application layer:
1. `initial_percent` immutable (except via FIX action).
2. `remaining_percent <= initial_percent`.
3. Door can only have one active visit.
4. State machine transitions validated before DB update.

### Migration Strategy

1. Create tables via D1 migration.
2. Pre-populate doors 9–23.
3. No data migration from existing tables.
4. Tables can coexist indefinitely.

### Rollback Strategy

1. Set `ENABLE_UNLOAD_MODULE = false`.
2. Unload UI/API becomes inaccessible.
3. Data remains in tables (no loss).
4. If permanent removal needed: drop tables in future migration.

---

## References

- [UNLOAD_SPEC.md](./UNLOAD_SPEC.md) – Full specification
- [UNLOAD_DATA_MODEL.md](./UNLOAD_DATA_MODEL.md) – Table schemas
- [UNLOAD_API_CONTRACT.md](./UNLOAD_API_CONTRACT.md) – API design
- `migrations/0001_initial_schema.sql` – Existing schema patterns
