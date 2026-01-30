# Unload Module UI Plan

**Version**: 1.0.0  
**Status**: Planning (Doc-First)  
**Related**: [UNLOAD_SPEC.md](./UNLOAD_SPEC.md), [UNLOAD_API_CONTRACT.md](./UNLOAD_API_CONTRACT.md)

---

## 1. Overview

The Unload module UI is a **separate, isolated React application** (or lazy-loaded route) that does not modify any existing tracker components. It provides:

1. **Door Board** – Real-time grid of doors 9–23 with current state
2. **Verify Doors Mode** – Rapid entry for start-of-night sweep
3. **Visit Details Drawer** – Event timeline, notes, and correction actions

---

## 2. Route Plan

### 2.1 Proposed Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/unload` | `UnloadDashboard` | Main door board view |
| `/unload/verify` | `VerifyDoorsWizard` | Start-of-night sweep |
| `/unload/visit/:id` | Opens drawer on current route | Visit details drawer |

### 2.2 Implementation Options

### ⚠️ V1 Decision: React Router Deferred

**React Router is deferred to Phase 2.** Initial implementation uses hash routing or a minimal route shim to avoid modifying `src/App.jsx` with a global router change. This preserves the "existing site unaffected" isolation guarantee.

---

**Option A: Hash-based Routing (V1 – Recommended)**

Use URL hash to switch views without adding dependency:

```jsx
// src/App.jsx
const [view, setView] = useState(() => {
  return window.location.hash === '#unload' ? 'unload' : 'tracker';
});

return view === 'unload' 
  ? <UnloadDashboard /> 
  : <PackageCarTracker />;
```

**Benefits**:
- No new dependency
- Works with existing Cloudflare Pages setup
- Zero changes to existing App.jsx behavior

**Option B: React Router (Phase 2)**

React Router can be added later once Unload is stable and the benefit of clean URLs outweighs the refactor cost. This would be a separate PR that touches `src/App.jsx`.

---

## 3. Feature Flag Integration

### 3.1 Environment Variable

```env
# .env / Cloudflare Pages env
VITE_ENABLE_UNLOAD_MODULE=false
```

### 3.2 Frontend Check

```jsx
// src/App.jsx
const isUnloadEnabled = () => {
  try {
    return import.meta.env.VITE_ENABLE_UNLOAD_MODULE === 'true';
  } catch {
    return false;
  }
};

// Usage in nav (Header.jsx)
{unloadEnabled && (
  <a href="/unload">Unload</a>
)}

// Route guard
<Route 
  path="/unload/*" 
  element={FEATURES.unload ? <UnloadDashboard /> : <Navigate to="/" />} 
/>
```

### 3.3 Behavior When Disabled

- Nav item hidden
- Direct URL access redirects to home
- API returns 404 (handled by worker feature flag)

---

## 4. Door Board UI

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ◀ Back to Tracker    UNLOAD DOOR BOARD    [Verify Doors] ⚙ │
├─────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │  9  │ │ 10  │ │ 11  │ │ 12  │ │ 13  │                    │
│ │EMPTY│ │PEND │ │OCCUP│ │OCCUP│ │EMPTY│                    │
│ │     │ │     │ │T4521│ │T4522│ │     │                    │
│ │     │ │     │ │ 25% │ │ 80% │ │     │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ 14  │ │ 15  │ │ 16  │ │ 17  │ │ 18  │                    │
│ │EMPTY│ │OCCUP│ │EMPTY│ │PEND │ │EMPTY│                    │
│ │     │ │T4523│ │     │ │     │ │     │                    │
│ │     │ │ 0%  │ │     │ │     │ │     │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ 19  │ │ 20  │ │ 21  │ │ 22  │ │ 23  │                    │
│ │EMPTY│ │EMPTY│ │OCCUP│ │EMPTY│ │EMPTY│                    │
│ │     │ │     │ │T4524│ │     │ │     │                    │
│ │     │ │     │ │ 50% │ │     │ │     │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Door Card Component

```jsx
// src/unload/components/DoorCard.jsx
function DoorCard({ door, onTap }) {
  const stateColors = {
    EMPTY: 'bg-slate-100 dark:bg-slate-800',
    PENDING: 'bg-amber-100 dark:bg-amber-900/30 border-amber-400',
    OCCUPIED: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400',
  };
  
  return (
    <button
      onClick={() => onTap(door)}
      className={`
        relative p-4 rounded-xl border-2 transition-all
        ${stateColors[door.state]}
        hover:scale-[1.02] active:scale-[0.98]
      `}
      data-testid={`door-card-${door.doorNumber}`}
    >
      <div className="text-2xl font-bold">{door.doorNumber}</div>
      <StatePill state={door.state} />
      {door.activeVisit && (
        <>
          <div className="text-sm font-mono mt-2">
            {door.activeVisit.trailerNumber}
          </div>
          <PercentBar percent={door.activeVisit.remainingPercent} />
        </>
      )}
    </button>
  );
}
```

### 4.3 State Pills

| State | Color | Text |
|-------|-------|------|
| EMPTY | Gray | "Empty" |
| PENDING | Amber | "Pending" |
| OCCUPIED (ARRIVED) | Green | "Arrived" |
| OCCUPIED (IN_PROGRESS) | Blue | "Unloading" |
| OCCUPIED (COMPLETED) | Purple | "Done" |

### 4.4 Percent Bar

Visual indicator of remaining percent:

```jsx
function PercentBar({ percent }) {
  const width = `${percent}%`;
  const color = percent > 50 
    ? 'bg-red-500' 
    : percent > 20 
      ? 'bg-amber-500' 
      : 'bg-emerald-500';
  
  return (
    <div className="h-2 bg-slate-200 rounded-full mt-2">
      <div className={`h-full rounded-full ${color}`} style={{ width }} />
    </div>
  );
}
```

---

## 5. Verify Doors Mode

### 5.1 Purpose

Rapid entry interface for start-of-night sweep. Supervisor walks through all doors and marks current state.

### 5.2 UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│              VERIFY DOORS - Start of Shift                  │
│                                                             │
│  Progress: [████████░░░░░░░░░░░░░░░░░░░░] 8/15              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                     DOOR 12                           │   │
│  │                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐   │   │
│  │  │  EMPTY  │  │ PENDING │  │      OCCUPIED       │   │   │
│  │  │         │  │         │  │                     │   │   │
│  │  │    ○    │  │    ○    │  │    ◉  (selected)    │   │   │
│  │  └─────────┘  └─────────┘  └─────────────────────┘   │   │
│  │                                                       │   │
│  │  If OCCUPIED:                                        │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ Trailer #: [T4521_________________]          │   │   │
│  │  │ Initial %: [75__] %                          │   │   │
│  │  │ Origin:    [CACH_] (optional)                │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [◀ Previous]              [Skip]              [Next ▶]     │
│                                                             │
│                    [✓ Complete Verification]                │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Implementation Notes

- **Keyboard-optimized**: Tab through fields, arrow keys for state selection
- **Mobile-optimized**: Large tap targets, swipe for prev/next
- **Auto-advance**: After confirming EMPTY/PENDING, auto-advance to next door
- **Summary screen**: Show all verified doors before final submit

---

## 6. Visit Details Drawer

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ╳                    VISIT DETAILS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Door 12 • Trailer T4521                                    │
│  Origin: CACH                                               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  INITIAL     REMAINING                               │  │
│  │    75%    →    25%                                   │  │
│  │  [▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░]                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Status: IN_PROGRESS                                        │
│  Started: 2:15 AM • Duration: 1h 30m                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            QUICK UPDATE                              │   │
│  │  [50%] [25%] [10%] [0% Done]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            ACTIONS                                   │   │
│  │  [▶ Start Unload]  [✓ Mark Complete]  [↗ Depart]   │   │
│  │  [📝 Add Note]     [🔧 Fix Initial %]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  EVENT TIMELINE                                             │
│                                                             │
│  ● CREATE    2:15 AM   supervisor1   Initial: 75%          │
│  │                                                          │
│  ● START     2:20 AM   operator1     Started unloading     │
│  │                                                          │
│  ● PROGRESS  3:00 AM   operator1     75% → 50%             │
│  │                                                          │
│  ● PROGRESS  3:45 AM   operator2     50% → 25%             │
│  ▼                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Quick Update Buttons

Pre-set buttons for common percent updates:
- Derived from initial_percent (e.g., 75% initial → show 50%, 25%, 10%, 0%)
- Tap to instantly update remaining_percent

### 6.3 Action Buttons

| Action | Shown When | Result |
|--------|------------|--------|
| Start Unload | status=ARRIVED | → IN_PROGRESS |
| Mark Complete | status=IN_PROGRESS | → COMPLETED (sets 0%) |
| Depart | status != DEPARTED | → DEPARTED, door EMPTY |
| Add Note | always | Opens note input |
| Fix Initial % | always (supervisor) | Opens correction dialog |

---

## 7. Component Architecture

```
src/unload/
├── UnloadDashboard.jsx        # Main container
├── components/
│   ├── DoorBoard.jsx          # Grid of doors
│   ├── DoorCard.jsx           # Individual door
│   ├── StatePill.jsx          # State badge
│   ├── PercentBar.jsx         # Visual percent indicator
│   ├── VisitDrawer.jsx        # Visit details drawer
│   ├── EventTimeline.jsx      # Event log display
│   ├── QuickUpdateBar.jsx     # Percent shortcuts
│   ├── ActionButtons.jsx      # Visit actions
│   └── VerifyDoorsWizard.jsx  # Start-of-night flow
├── hooks/
│   ├── useUnloadApi.js        # API hooks
│   ├── useDoorBoard.js        # Door state management
│   └── useVisitPolling.js     # Real-time updates
├── api/
│   └── unloadClient.js        # API client module
└── utils/
    └── unloadValidators.js    # Client-side validation
```

---

## 8. Reuse Strategy

### 8.1 Safe to Reuse (No Modifications)

These existing components can be imported as-is:

| Component | Location | Usage |
|-----------|----------|-------|
| Theme toggle | `src/App.jsx` | Share theme context |
| Loading spinner | `src/components/` | (if exists) |
| Modal/drawer base | `src/components/` | Base drawer styling |
| Tailwind utilities | `tailwind.config.js` | All utility classes |
| API error handling | `src/api/apiClient.js` | `apiRequest` helper |

### 8.2 New Components (Unload-specific)

All components in `src/unload/` are new and do not modify shared code.

### 8.3 Isolation Guarantee

**DO NOT**:
- Modify `src/components/Header.jsx` (create separate header)
- Modify `src/PackageCarTracker.jsx`
- Modify shared context providers (create unload-specific ones)
- Add dependencies that affect existing bundle

**DO**:
- Create separate unload context if needed
- Lazy-load entire unload module
- Use existing Tailwind classes without modifications

---

## 9. Mobile Optimization

### 9.1 TC57 Handheld Considerations

- **Touch targets**: Minimum 44x44px
- **Font size**: Minimum 16px for inputs (prevents zoom)
- **Contrast**: WCAG AA compliant
- **Orientation**: Support both portrait and landscape

### 9.2 Responsive Grid

```css
/* Door grid */
.door-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);  /* Desktop: 5 columns */
  gap: 1rem;
}

@media (max-width: 768px) {
  .door-grid {
    grid-template-columns: repeat(3, 1fr);  /* Tablet: 3 columns */
  }
}

@media (max-width: 480px) {
  .door-grid {
    grid-template-columns: repeat(2, 1fr);  /* Mobile: 2 columns */
  }
}
```

---

## 10. Accessibility

### 10.1 Requirements

- Keyboard navigation throughout
- ARIA labels on all interactive elements
- Screen reader announcements for state changes
- Focus management in drawers

### 10.2 Implementation

```jsx
<button
  role="button"
  aria-label={`Door ${door.doorNumber}, ${door.state}${
    door.activeVisit 
      ? `, trailer ${door.activeVisit.trailerNumber}, ${door.activeVisit.remainingPercent}% remaining`
      : ''
  }`}
  data-testid={`door-card-${door.doorNumber}`}
>
```

---

## 11. Test IDs

| Element | Test ID |
|---------|---------|
| Door card | `door-card-{N}` |
| Door state pill | `door-state-{N}` |
| Verify button | `verify-doors-btn` |
| Visit drawer | `visit-drawer` |
| Quick update buttons | `quick-update-{percent}` |
| Action buttons | `action-{action}` |
| Event timeline | `event-timeline` |

---

## References

- `src/App.jsx` – Theme handling pattern
- `src/PackageCarTracker.jsx` – Component structure pattern
- `src/components/ShiftDialog.jsx` – Dialog/drawer pattern
- `tailwind.config.js` – Existing color palette
