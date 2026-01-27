# Implementation Action Plan - Frontend Integration Priority

Based on FEATURE_AUDIT.md findings, this plan prioritizes **exposing existing backend features** before building new ones.

---

## Phase 1: Quick Wins (Backend Already Built)
**Estimated Time:** 2-3 days  
**Complexity:** Low-Medium  
**ROI:** Very High - Unlocks 4 existing backend features

### 1.1 Wire Up Shift Management
**Why:** Backend fully implemented, just needs UI integration

**Tasks:**
- [ ] Add "Start Shift" button that calls `shiftsApi.start()`
- [ ] Add "End Shift" confirmation dialog with notes input
- [ ] Call `shiftsApi.end()` before `resetShift()` to capture snapshot
- [ ] Display current shift start time in header
- [ ] Show "Current Shift: Started at X by Y" badge

**Files to Modify:**
- `src/PackageCarTracker.jsx` - Add shift UI controls
- `src/components/Header.jsx` - Add shift status display

**Acceptance Criteria:**
- ✅ Clicking "Start Shift" creates DB record
- ✅ Ending shift captures full snapshot + stats
- ✅ Multiple users see same shift status

---

### 1.2 Create Audit Log Viewer
**Why:** Backend logging all changes, users can't see them

**Tasks:**
- [ ] Create `src/components/AuditLogDrawer.jsx` component
- [ ] Add "View History" button to car cards (board & list view)
- [ ] Show last 10 changes for selected car
- [ ] Display: timestamp, user, field changed, old → new value
- [ ] Add "View All Audit Logs" in diagnostics drawer

**Files to Create:**
- `src/components/AuditLogDrawer.jsx`

**Files to Modify:**
- `src/CarCard.jsx` - Add history button
- `src/PackageCarTracker.jsx` - Wire up drawer state

**Acceptance Criteria:**
- ✅ Click car → see its change history
- ✅ Shows who, when, what changed
- ✅ Works for all cars with changes

---

### 1.3 Shift History View
**Why:** Backend stores shift data, no way to view it

**Tasks:**
- [ ] Create `src/components/ShiftHistoryDrawer.jsx`
- [ ] Add "View Past Shifts" button in header dropdown
- [ ] Display last 10 shifts with:
  - Start/end times
  - Started/ended by
  - Total cars, arrived count, late count
  - Notes
- [ ] Click shift → see full snapshot of car states

**Files to Create:**
- `src/components/ShiftHistoryDrawer.jsx`

**Files to Modify:**
- `src/PackageCarTracker.jsx` - Add history drawer
- `src/components/Header.jsx` - Add "History" menu item

**Acceptance Criteria:**
- ✅ See list of past shifts
- ✅ View shift statistics
- ✅ See car state snapshot at shift end

---

### 1.4 Usage Stats API Integration
**Why:** Usage tracking exists, just needs backend sync

**Tasks:**
- [ ] Add `POST /api/usage` endpoint to `workers/api.js`
- [ ] Create usage batch sender in frontend
- [ ] Send usage stats to API every 5 minutes
- [ ] Aggregate usage across all users in backend

**Files to Modify:**
- `workers/api.js` - Add usage endpoint
- `src/api/apiClient.js` - Add `usageApi.submit()`
- `src/PackageCarTracker.jsx` - Periodically sync usage

**Files to Create:**
- `migrations/0002_usage_aggregation.sql` (optional)

**Acceptance Criteria:**
- ✅ Usage events sent to backend
- ✅ Backend stores in `usage_stats` table
- ✅ Can query aggregate usage via API

---

## Phase 2: Session Management
**Estimated Time:** 1-2 days  
**Complexity:** Low  
**ROI:** Medium - Enables user tracking

### 2.1 Session Tracking
**Tasks:**
- [ ] Add `POST /api/sessions/start` endpoint
- [ ] Add `PUT /api/sessions/:id/heartbeat` endpoint
- [ ] Add `POST /api/sessions/:id/end` endpoint
- [ ] Frontend: Start session on app load
- [ ] Send heartbeat every 30 seconds
- [ ] End session on window unload
- [ ] Show "Active Users: X" in header

**Files to Modify:**
- `workers/api.js` - Add session endpoints
- `src/api/apiClient.js` - Add `sessionsApi`
- `src/PackageCarTracker.jsx` - Session lifecycle

**Acceptance Criteria:**
- ✅ Each device gets unique session
- ✅ Backend tracks active sessions
- ✅ Stale sessions auto-expire after 5 min
- ✅ Shows count of active users

---

## Phase 3: PWA (Critical for Warehouse)
**Estimated Time:** 2-3 days  
**Complexity:** Medium  
**ROI:** Very High - Enables offline use

### 3.1 PWA Implementation
**Tasks:**
- [ ] Create `public/manifest.json`
- [ ] Generate app icons (192x192, 512x512)
- [ ] Add `vite-plugin-pwa` to vite.config.js
- [ ] Create service worker with cache strategies:
  - Cache-first: static assets (JS, CSS, images)
  - Network-first: API calls with fallback
  - Offline page for when API unavailable
- [ ] Add "Install App" prompt
- [ ] Show "Offline Mode" banner when disconnected
- [ ] Queue failed API calls for retry when online

**Files to Create:**
- `public/manifest.json`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `src/registerSW.js`

**Files to Modify:**
- `vite.config.js` - Add PWA plugin
- `src/main.jsx` - Register service worker
- `index.html` - Add manifest link

**Acceptance Criteria:**
- ✅ App installable on mobile
- ✅ Works offline (read-only mode)
- ✅ Shows offline indicator
- ✅ Syncs when back online

---

## Phase 4: Enhanced UX
**Estimated Time:** 3-4 days  
**Complexity:** Medium  
**ROI:** High - Better user experience

### 4.1 User Identification
**Tasks:**
- [ ] Add user ID prompt on first launch
- [ ] Store user ID in localStorage
- [ ] Add "Change User" in settings
- [ ] Use real user ID instead of "anonymous"
- [ ] Show current user in header

**Files to Modify:**
- `src/PackageCarTracker.jsx` - User management
- `src/api/apiClient.js` - Use stored user ID

---

### 4.2 Shift Notes & Handoff
**Tasks:**
- [ ] Add notes input to "End Shift" dialog
- [ ] Show previous shift notes when starting new shift
- [ ] Add "Issues to Address" section
- [ ] Highlight late/stuck cars in handoff view

**Files to Modify:**
- `src/components/ShiftHistoryDrawer.jsx`
- `src/PackageCarTracker.jsx`

---

### 4.3 Real-Time Notifications
**Tasks:**
- [ ] Add toast notification system (react-hot-toast)
- [ ] Show notification when another user updates a car
- [ ] Alert when car marked late
- [ ] Notify on sync errors

**Files to Create:**
- `src/components/Toast.jsx`

**Files to Modify:**
- `src/api/apiClient.js` - Trigger notifications
- `package.json` - Add react-hot-toast

---

## Phase 5: WebSocket Upgrade (Optional)
**Estimated Time:** 5-7 days  
**Complexity:** High  
**ROI:** Medium - Reduces sync latency from 5s to instant

### 5.1 WebSocket Implementation
**Tasks:**
- [ ] Add Durable Object for state management
- [ ] Implement WebSocket connections
- [ ] Fallback to polling if WebSocket fails
- [ ] Handle reconnection logic
- [ ] Broadcast changes to all connected clients

**Files to Create:**
- `workers/durable-objects/TrackerState.js`

**Files to Modify:**
- `workers/api.js` - Add WebSocket upgrade
- `src/api/apiClient.js` - WebSocket client
- `wrangler.toml` - Durable Object binding

---

## Implementation Order

```
Week 1:
├── Day 1-2: Shift Management Integration (1.1)
├── Day 3-4: Audit Log Viewer (1.2)
└── Day 5: Shift History View (1.3)

Week 2:
├── Day 1: Usage Stats Sync (1.4)
├── Day 2: Session Tracking (2.1)
└── Day 3-5: PWA Implementation (3.1)

Week 3:
├── Day 1-2: User Identification (4.1)
├── Day 3: Shift Notes (4.2)
└── Day 4-5: Notifications (4.3)

Optional - Week 4+:
└── WebSocket Upgrade (5.1)
```

---

## Metrics to Track

After each phase, measure:
- [ ] Feature completeness % (vs FEATURE_AUDIT.md)
- [ ] API endpoints used vs unused
- [ ] Database tables used vs unused
- [ ] User-facing features vs backend-only
- [ ] Test coverage on new components

---

## Success Criteria

**Phase 1 Complete:**
- All backend features exposed in UI
- Users can view shift history
- Users can see audit logs
- Usage stats synced to backend

**Phase 2 Complete:**
- Active user count visible
- Session tracking working
- Backend knows who's online

**Phase 3 Complete:**
- App installable on mobile
- Works offline (read-only)
- Auto-syncs when online

**Phase 4 Complete:**
- Users identified (not anonymous)
- Shift handoff workflow complete
- Real-time notifications working

**Final Goal:**
- 100% of backend features exposed in UI
- All 5 database tables actively used
- True "world-class warehouse application"

---

## Notes

- **Start with Phase 1** - Highest ROI, backend already done
- **PWA (Phase 3) is critical** - Warehouse WiFi can be spotty
- **WebSocket (Phase 5) is optional** - Polling works fine for now
- **Document as you go** - Update SYNC_STATUS.md after each phase
