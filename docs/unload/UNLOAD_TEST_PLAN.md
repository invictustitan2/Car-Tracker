# Unload Module Test Plan

**Version**: 1.0.0  
**Status**: Planning (Doc-First)  
**Related**: [UNLOAD_SPEC.md](./UNLOAD_SPEC.md), [UNLOAD_API_CONTRACT.md](./UNLOAD_API_CONTRACT.md)

---

## 1. Overview

Testing for the Unload module follows the existing project patterns:
- **Unit tests**: Vitest + React Testing Library
- **Integration tests**: API tests against D1
- **E2E tests**: Playwright

All tests are isolated to Unload functionality and do not modify or depend on existing tracker tests.

---

## 2. Unit Tests

### 2.1 Validation Tests

**File**: `src/unload/utils/unloadValidators.test.js`

```javascript
describe('Unload Validators', () => {
  describe('doorNumber', () => {
    it('accepts valid door numbers 9-23', () => {
      expect(validateDoorNumber(9)).toBe(9);
      expect(validateDoorNumber(23)).toBe(23);
      expect(validateDoorNumber(15)).toBe(15);
    });
    
    it('rejects door numbers outside 9-23', () => {
      expect(() => validateDoorNumber(8)).toThrow('Door number must be between 9 and 23');
      expect(() => validateDoorNumber(24)).toThrow('Door number must be between 9 and 23');
      expect(() => validateDoorNumber(0)).toThrow();
      expect(() => validateDoorNumber(-1)).toThrow();
    });
    
    it('handles string inputs', () => {
      expect(validateDoorNumber('12')).toBe(12);
      expect(() => validateDoorNumber('abc')).toThrow();
    });
  });
  
  describe('trailerNumber', () => {
    it('accepts valid trailer numbers', () => {
      expect(validateTrailerNumber('T4521')).toBe('T4521');
      expect(validateTrailerNumber('t-1234')).toBe('T-1234'); // Uppercase
    });
    
    it('rejects invalid trailer numbers', () => {
      expect(() => validateTrailerNumber('')).toThrow('Trailer number is required');
      expect(() => validateTrailerNumber('A'.repeat(21))).toThrow('1-20 characters');
      expect(() => validateTrailerNumber('T@123!')).toThrow('alphanumeric');
    });
  });
  
  describe('percent', () => {
    it('accepts 0-100', () => {
      expect(validatePercent(0)).toBe(0);
      expect(validatePercent(50)).toBe(50);
      expect(validatePercent(100)).toBe(100);
    });
    
    it('rejects out of range', () => {
      expect(() => validatePercent(-1)).toThrow();
      expect(() => validatePercent(101)).toThrow();
    });
  });
  
  describe('remainingPercent with initialPercent', () => {
    it('accepts remaining <= initial', () => {
      expect(validateRemainingPercent(25, 75)).toBe(25);
      expect(validateRemainingPercent(0, 75)).toBe(0);
      expect(validateRemainingPercent(75, 75)).toBe(75);
    });
    
    it('rejects remaining > initial', () => {
      expect(() => validateRemainingPercent(80, 75)).toThrow('cannot exceed initial');
    });
  });
});
```

### 2.2 State Machine Tests

**File**: `src/unload/utils/visitStateMachine.test.js`

```javascript
describe('Visit State Machine', () => {
  describe('allowed transitions', () => {
    it('allows ARRIVED → IN_PROGRESS', () => {
      expect(canTransition('ARRIVED', 'IN_PROGRESS')).toBe(true);
    });
    
    it('allows ARRIVED → DEPARTED (quick departure)', () => {
      expect(canTransition('ARRIVED', 'DEPARTED')).toBe(true);
    });
    
    it('allows IN_PROGRESS → COMPLETED', () => {
      expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });
    
    it('allows IN_PROGRESS → DEPARTED (early departure)', () => {
      expect(canTransition('IN_PROGRESS', 'DEPARTED')).toBe(true);
    });
    
    it('allows COMPLETED → DEPARTED', () => {
      expect(canTransition('COMPLETED', 'DEPARTED')).toBe(true);
    });
  });
  
  describe('illegal transitions', () => {
    it('disallows DEPARTED → any', () => {
      expect(canTransition('DEPARTED', 'ARRIVED')).toBe(false);
      expect(canTransition('DEPARTED', 'IN_PROGRESS')).toBe(false);
      expect(canTransition('DEPARTED', 'COMPLETED')).toBe(false);
    });
    
    it('disallows backwards transitions', () => {
      expect(canTransition('IN_PROGRESS', 'ARRIVED')).toBe(false);
      expect(canTransition('COMPLETED', 'ARRIVED')).toBe(false);
      expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    });
  });
});
```

### 2.3 Door State Tests

**File**: `src/unload/utils/doorStateMachine.test.js`

```javascript
describe('Door State Machine', () => {
  it('allows EMPTY → PENDING', () => {
    expect(canSetDoorState('EMPTY', 'PENDING', null)).toBe(true);
  });
  
  it('allows PENDING → EMPTY', () => {
    expect(canSetDoorState('PENDING', 'EMPTY', null)).toBe(true);
  });
  
  it('allows EMPTY → OCCUPIED when assigning visit', () => {
    expect(canSetDoorState('EMPTY', 'OCCUPIED', 'visit-id')).toBe(true);
  });
  
  it('allows PENDING → OCCUPIED when assigning visit', () => {
    expect(canSetDoorState('PENDING', 'OCCUPIED', 'visit-id')).toBe(true);
  });
  
  it('disallows setting OCCUPIED without visit', () => {
    expect(canSetDoorState('EMPTY', 'OCCUPIED', null)).toBe(false);
  });
  
  it('disallows changing state when OCCUPIED (must depart first)', () => {
    expect(canSetDoorState('OCCUPIED', 'EMPTY', null)).toBe(false);
    expect(canSetDoorState('OCCUPIED', 'PENDING', null)).toBe(false);
  });
});
```

### 2.4 Component Tests

**File**: `src/unload/components/DoorCard.test.jsx`

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import DoorCard from './DoorCard';

describe('DoorCard', () => {
  it('renders door number and state', () => {
    render(<DoorCard door={{ doorNumber: 12, state: 'EMPTY' }} />);
    
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
  
  it('shows trailer info when occupied', () => {
    const door = {
      doorNumber: 12,
      state: 'OCCUPIED',
      activeVisit: {
        trailerNumber: 'T4521',
        remainingPercent: 25,
        status: 'IN_PROGRESS',
      },
    };
    
    render(<DoorCard door={door} />);
    
    expect(screen.getByText('T4521')).toBeInTheDocument();
    expect(screen.getByTestId('percent-bar')).toHaveStyle({ width: '25%' });
  });
  
  it('calls onTap when clicked', () => {
    const onTap = vi.fn();
    const door = { doorNumber: 12, state: 'EMPTY' };
    
    render(<DoorCard door={door} onTap={onTap} />);
    fireEvent.click(screen.getByTestId('door-card-12'));
    
    expect(onTap).toHaveBeenCalledWith(door);
  });
  
  it('has correct test-id for E2E', () => {
    render(<DoorCard door={{ doorNumber: 15, state: 'PENDING' }} />);
    
    expect(screen.getByTestId('door-card-15')).toBeInTheDocument();
  });
});
```

---

## 3. Integration Tests

### 3.1 API Integration Tests

**File**: `workers/unload.integration.test.js`

These tests run against a test D1 database (using wrangler local or miniflare).

```javascript
describe('Unload API Integration', () => {
  beforeEach(async () => {
    // Reset test database
    await db.exec('DELETE FROM unload_events');
    await db.exec('DELETE FROM unload_visits');
    await db.exec('UPDATE unload_doors SET state = "EMPTY", active_visit_id = NULL');
  });
  
  describe('POST /api/unload/visits', () => {
    it('creates visit and updates door state', async () => {
      const response = await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4521',
          initialPercent: 75,
          userId: 'test-user',
        }),
      });
      
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.visit.trailerNumber).toBe('T4521');
      expect(data.visit.status).toBe('ARRIVED');
      expect(data.door.state).toBe('OCCUPIED');
      
      // Verify event created
      const events = await db.prepare(
        'SELECT * FROM unload_events WHERE visit_id = ?'
      ).bind(data.visit.id).all();
      
      expect(events.results).toHaveLength(1);
      expect(events.results[0].action).toBe('CREATE');
    });
    
    it('rejects creating visit on occupied door', async () => {
      // First visit
      await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4521',
          initialPercent: 75,
          userId: 'test-user',
        }),
      });
      
      // Second visit same door
      const response = await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4522',
          initialPercent: 50,
          userId: 'test-user',
        }),
      });
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Conflict');
    });
  });
  
  describe('POST /api/unload/visits/:id/action', () => {
    let visitId;
    
    beforeEach(async () => {
      const response = await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4521',
          initialPercent: 75,
          userId: 'test-user',
        }),
      });
      const data = await response.json();
      visitId = data.visit.id;
    });
    
    it('updates remaining percent', async () => {
      const response = await fetch(`/api/unload/visits/${visitId}/action`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROGRESS',
          remainingPercent: 25,
          userId: 'test-user',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.visit.remainingPercent).toBe(25);
    });
    
    it('rejects remaining > initial', async () => {
      const response = await fetch(`/api/unload/visits/${visitId}/action`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROGRESS',
          remainingPercent: 90,
          userId: 'test-user',
        }),
      });
      
      expect(response.status).toBe(400);
    });
    
    it('departs visit and clears door', async () => {
      const response = await fetch(`/api/unload/visits/${visitId}/action`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DEPART',
          userId: 'test-user',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.visit.status).toBe('DEPARTED');
      expect(data.door.state).toBe('EMPTY');
      expect(data.door.activeVisit).toBeNull();
    });
  });
  
  describe('initial_percent immutability', () => {
    it('cannot update initial_percent via normal action', async () => {
      const create = await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4521',
          initialPercent: 75,
          userId: 'test-user',
        }),
      });
      const { visit } = await create.json();
      
      // Attempt to update via PROGRESS (should not change initial)
      await fetch(`/api/unload/visits/${visit.id}/action`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROGRESS',
          remainingPercent: 50,
          initialPercent: 90, // Ignored
          userId: 'test-user',
        }),
      });
      
      const get = await fetch(`/api/unload/visits/${visit.id}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await get.json();
      
      expect(data.visit.initialPercent).toBe(75); // Unchanged
    });
    
    it('allows FIX_INITIAL_PERCENT with reason', async () => {
      const create = await fetch('/api/unload/visits', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNumber: 12,
          trailerNumber: 'T4521',
          initialPercent: 75,
          userId: 'test-user',
        }),
      });
      const { visit } = await create.json();
      
      const fix = await fetch(`/api/unload/visits/${visit.id}/action`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FIX_INITIAL_PERCENT',
          newInitialPercent: 80,
          reason: 'Initial estimate was wrong',
          userId: 'supervisor1',
        }),
      });
      
      expect(fix.status).toBe(200);
      const data = await fix.json();
      expect(data.visit.initialPercent).toBe(80);
      
      // Verify event logged
      const events = await fetch(`/api/unload/visits/${visit.id}/events`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const eventData = await events.json();
      const fixEvent = eventData.events.find(e => e.action === 'FIX_INITIAL_PERCENT');
      expect(fixEvent).toBeDefined();
      expect(JSON.parse(fixEvent.data).reason).toBe('Initial estimate was wrong');
    });
  });
});
```

---

## 4. E2E Tests

**File**: `e2e/unload.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Unload Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Set feature flag (could be via API or test helper)
    // Navigate to unload module
    await page.goto('/unload');
  });
  
  test('displays door board with all doors 9-23', async ({ page }) => {
    await expect(page.getByTestId('door-card-9')).toBeVisible();
    await expect(page.getByTestId('door-card-23')).toBeVisible();
    
    // Count all doors
    const doors = await page.getByTestId(/^door-card-\d+$/).all();
    expect(doors).toHaveLength(15);
  });
  
  test('full visit lifecycle: arrive → progress → depart → reuse', async ({ page }) => {
    // Step 1: Create visit on door 12
    await page.getByTestId('door-card-12').click();
    await page.getByTestId('assign-trailer-btn').click();
    
    await page.getByLabel('Trailer Number').fill('T4521');
    await page.getByLabel('Initial Percent').fill('75');
    await page.getByTestId('create-visit-btn').click();
    
    // Verify door shows occupied
    await expect(page.getByTestId('door-card-12')).toContainText('T4521');
    await expect(page.getByTestId('door-state-12')).toHaveText('Arrived');
    
    // Step 2: Start unloading
    await page.getByTestId('action-START').click();
    await expect(page.getByTestId('door-state-12')).toHaveText('Unloading');
    
    // Step 3: Update progress
    await page.getByTestId('quick-update-50').click();
    await expect(page.getByTestId('door-card-12')).toContainText('50%');
    
    await page.getByTestId('quick-update-25').click();
    await expect(page.getByTestId('door-card-12')).toContainText('25%');
    
    // Step 4: Finish
    await page.getByTestId('action-FINISH').click();
    await expect(page.getByTestId('door-state-12')).toHaveText('Done');
    
    // Step 5: Depart
    await page.getByTestId('action-DEPART').click();
    await expect(page.getByTestId('door-state-12')).toHaveText('Empty');
    await expect(page.getByTestId('door-card-12')).not.toContainText('T4521');
    
    // Step 6: Assign new trailer (reuse)
    await page.getByTestId('door-card-12').click();
    await page.getByTestId('assign-trailer-btn').click();
    await page.getByLabel('Trailer Number').fill('T4599');
    await page.getByLabel('Initial Percent').fill('50');
    await page.getByTestId('create-visit-btn').click();
    
    await expect(page.getByTestId('door-card-12')).toContainText('T4599');
  });
  
  test('verify doors sweep', async ({ page }) => {
    await page.getByTestId('verify-doors-btn').click();
    
    // Door 9: Mark EMPTY
    await expect(page.getByText('DOOR 9')).toBeVisible();
    await page.getByTestId('state-empty').click();
    await page.getByTestId('next-btn').click();
    
    // Door 10: Mark PENDING
    await expect(page.getByText('DOOR 10')).toBeVisible();
    await page.getByTestId('state-pending').click();
    await page.getByTestId('next-btn').click();
    
    // Door 11: Mark OCCUPIED
    await expect(page.getByText('DOOR 11')).toBeVisible();
    await page.getByTestId('state-occupied').click();
    await page.getByLabel('Trailer Number').fill('LEFTOVER-T1');
    await page.getByLabel('Initial Percent').fill('25');
    await page.getByTestId('next-btn').click();
    
    // Skip remaining doors
    for (let i = 12; i <= 23; i++) {
      await page.getByTestId('skip-btn').click();
    }
    
    // Complete verification
    await page.getByTestId('complete-verify-btn').click();
    
    // Verify results on door board
    await expect(page.getByTestId('door-state-9')).toHaveText('Empty');
    await expect(page.getByTestId('door-state-10')).toHaveText('Pending');
    await expect(page.getByTestId('door-state-11')).toHaveText('Arrived');
    await expect(page.getByTestId('door-card-11')).toContainText('LEFTOVER-T1');
  });
  
  test('event timeline shows all actions', async ({ page }) => {
    // Create and work with a visit
    await page.getByTestId('door-card-15').click();
    await page.getByTestId('assign-trailer-btn').click();
    await page.getByLabel('Trailer Number').fill('T9999');
    await page.getByLabel('Initial Percent').fill('100');
    await page.getByTestId('create-visit-btn').click();
    
    await page.getByTestId('action-START').click();
    await page.getByTestId('quick-update-50').click();
    
    // Open visit drawer
    await page.getByTestId('door-card-15').click();
    
    // Check timeline
    const timeline = page.getByTestId('event-timeline');
    await expect(timeline.getByText('CREATE')).toBeVisible();
    await expect(timeline.getByText('START')).toBeVisible();
    await expect(timeline.getByText('PROGRESS')).toBeVisible();
  });
  
  test('existing tracker unaffected', async ({ page }) => {
    // Navigate to main tracker
    await page.goto('/');
    
    // Verify car tracker works
    await expect(page.getByText('Package Car Tracker')).toBeVisible();
    
    // Verify no unload UI elements
    await expect(page.getByTestId('door-card-12')).not.toBeVisible();
  });
});

test.describe('Unload Module - Feature Flag Off', () => {
  test.beforeEach(async ({ page }) => {
    // Simulate feature flag off (env variable or mock)
  });
  
  test('nav item hidden when disabled', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Unload')).not.toBeVisible();
  });
  
  test('direct URL access redirects home', async ({ page }) => {
    await page.goto('/unload');
    await expect(page).toHaveURL('/');
  });
});
```

---

## 5. Definition of Done

### 5.1 Checklist

| Item | Criteria |
|------|----------|
| **Unit Tests** | All validation and state machine tests pass |
| **Component Tests** | All UI components have coverage |
| **Integration Tests** | API endpoints work correctly with D1 |
| **E2E Tests** | Full workflow test passes |
| **Isolation** | Existing tracker E2E tests still pass |
| **Feature Flag** | Module hidden when flag is off |
| **Accessibility** | Keyboard navigation works, ARIA labels present |
| **Mobile** | Works on TC57 handheld (manual test) |
| **Performance** | Door board loads < 2 seconds |
| **Events** | All actions create event records |

### 5.2 Coverage Targets

| Category | Target |
|----------|--------|
| Validators | 100% |
| State machines | 100% |
| API handlers | 90%+ |
| UI components | 80%+ |
| E2E critical paths | 100% of workflows |

### 5.3 Regression Check

Before merge:
1. Run full existing test suite: `ups_test`
2. Run existing E2E suite: `ups_e2e`
3. Verify no failures in non-unload tests
4. Manual smoke test on production URL (with flag off)

---

## References

- `TESTING.md` – Project testing guide
- `src/PackageCarTracker.test.jsx` – Component test patterns
- `e2e/` – Existing E2E test patterns
- `playwright.config.js` – Playwright configuration
