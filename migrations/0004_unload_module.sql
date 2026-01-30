-- Unload Module Tables (Phase 1)
-- Isolated from existing tracker tables
-- See docs/unload/UNLOAD_DATA_MODEL.md for design rationale

-- Table: unload_doors
-- Current state of each physical door (9-23)
-- Pre-populated with 15 doors on first query if shift_id not found
CREATE TABLE IF NOT EXISTS unload_doors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER,
  door_number INTEGER NOT NULL CHECK (door_number >= 9 AND door_number <= 23),
  door_state TEXT NOT NULL DEFAULT 'EMPTY' CHECK (door_state IN ('EMPTY', 'PENDING', 'OCCUPIED')),
  active_visit_id TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  UNIQUE (shift_id, door_number),
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_unload_doors_shift_door ON unload_doors(shift_id, door_number);
CREATE INDEX IF NOT EXISTS idx_unload_doors_state ON unload_doors(door_state);

-- Table: unload_visits
-- One row per trailer visit (a door may have many visits per shift)
CREATE TABLE IF NOT EXISTS unload_visits (
  id TEXT PRIMARY KEY,
  shift_id INTEGER,
  door_number INTEGER NOT NULL CHECK (door_number >= 9 AND door_number <= 23),
  trailer_number TEXT NOT NULL,
  origin_code TEXT,
  initial_percent INTEGER NOT NULL CHECK (initial_percent >= 0 AND initial_percent <= 100),
  remaining_percent INTEGER NOT NULL CHECK (remaining_percent >= 0 AND remaining_percent <= 100),
  status TEXT NOT NULL DEFAULT 'ARRIVED' CHECK (status IN ('ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DEPARTED')),
  started_at TEXT,
  completed_at TEXT,
  departed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  notes TEXT,
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_unload_visits_shift_door ON unload_visits(shift_id, door_number);
CREATE INDEX IF NOT EXISTS idx_unload_visits_status ON unload_visits(status);
CREATE INDEX IF NOT EXISTS idx_unload_visits_created ON unload_visits(created_at);

-- Table: unload_events
-- Append-only audit log for unload actions
CREATE TABLE IF NOT EXISTS unload_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id TEXT,
  shift_id INTEGER,
  door_number INTEGER,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'DOOR_SET', 'VISIT_CREATE', 'START', 'PROGRESS', 'PROGRESS_DELTA',
    'FINISH', 'DEPART', 'FIX_INITIAL_PERCENT', 'NOTE'
  )),
  payload TEXT,
  actor TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (visit_id) REFERENCES unload_visits(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_unload_events_visit ON unload_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_unload_events_shift ON unload_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_unload_events_created ON unload_events(created_at);
