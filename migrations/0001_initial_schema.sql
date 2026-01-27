-- UPS Package Car Tracker - Initial Database Schema
-- Cloudflare D1 SQLite Database

-- Cars table: current state of all package cars
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,
  location TEXT NOT NULL DEFAULT 'Yard',
  arrived INTEGER NOT NULL DEFAULT 0,
  late INTEGER NOT NULL DEFAULT 0,
  empty INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  last_updated_at TEXT DEFAULT (datetime('now')),
  last_updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

-- Create index for faster location queries
CREATE INDEX IF NOT EXISTS idx_cars_location ON cars(location);
CREATE INDEX IF NOT EXISTS idx_cars_arrived ON cars(arrived);
CREATE INDEX IF NOT EXISTS idx_cars_late ON cars(late);

-- Audit log: track all changes for accountability
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'location_changed', 'status_changed'
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT (datetime('now')),
  session_id TEXT
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_car_id ON audit_log(car_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);

-- Shifts table: track shift handoffs and snapshots
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  started_by TEXT,
  ended_by TEXT,
  notes TEXT,
  snapshot TEXT, -- JSON snapshot of all cars at shift end
  stats TEXT -- JSON: arrivals, lates, empties, etc.
);

-- Create index for shift queries
CREATE INDEX IF NOT EXISTS idx_shifts_started_at ON shifts(started_at);
CREATE INDEX IF NOT EXISTS idx_shifts_ended_at ON shifts(ended_at);

-- Usage statistics: aggregate usage data
CREATE TABLE IF NOT EXISTS usage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT DEFAULT (datetime('now')),
  user_id TEXT,
  event_type TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 1,
  metadata TEXT -- JSON for additional context
);

-- Create index for usage queries
CREATE INDEX IF NOT EXISTS idx_usage_recorded_at ON usage_stats(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_event_type ON usage_stats(event_type);

-- Sessions table: track active user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  device_info TEXT
);

-- Create index for session queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);
