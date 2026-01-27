# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-11-21

### Added
- **Snap-to-start columns**: Board view now uses `scroll-snap-type: x mandatory` and sticky headers for better handheld usability.
- **CSV Import/Export**: New controls in "Manage Fleet" mode to bulk import car IDs or export current fleet status.
- **LocalStorage Versioning**: Added `trackerVersion` (v2) and `migrateCars` function to handle schema upgrades automatically.
- **Usage Metrics**: Internal counters for filter clicks and view toggles stored in localStorage.

### Changed
- Bumped package version to 0.1.0.
- Updated `README.md` with new feature descriptions.
