# Testing Guide for UPS Package Car Tracker

This document outlines the comprehensive testing strategy implemented for the UPS Package Car Tracker application.

## Table of Contents

1. [Overview](#overview)
2. [Testing Stack](#testing-stack)
3. [Running Tests](#running-tests)
4. [Unit Tests](#unit-tests)
5. [E2E Tests](#e2e-tests)
6. [API Mocking](#api-mocking)
7. [WebSocket Testing](#websocket-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Coverage Reports](#coverage-reports)
10. [CI/CD Integration](#cicd-integration)

---

## Overview

The application uses a multi-layered testing approach:

- **Unit Tests**: Component-level tests using Vitest + React Testing Library
- **Integration Tests**: API mocking with Mock Service Worker (MSW)
- **E2E Tests**: Full browser automation with Playwright
- **Accessibility Tests**: WCAG 2.1 compliance with axe-core
- **WebSocket Tests**: Real-time communication testing with mock-socket

---

## Testing Stack

### Core Testing Frameworks

- **[Vitest](https://vitest.dev/)** - Fast unit testing framework
- **[Playwright](https://playwright.dev/)** - E2E browser automation
- **[React Testing Library](https://testing-library.com/react)** - Component testing utilities
- **[@testing-library/user-event](https://testing-library.com/docs/user-event/intro)** - User interaction simulation

### Mocking & Utilities

- **[Mock Service Worker (MSW)](https://mswjs.io/)** - API request mocking
- **[mock-socket](https://github.com/thoov/mock-socket)** - WebSocket mocking
- **[axe-core](https://github.com/dequelabs/axe-core)** - Accessibility testing
- **[@vitest/coverage-v8](https://vitest.dev/guide/coverage.html)** - Code coverage reporting

---

## Running Tests

### All Tests

```bash
# Run all unit and E2E tests
npm run test:all
```

### Unit Tests

```bash
# Run unit tests in watch mode
npm test

# Run unit tests once
npm run test:unit

# Run with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
```

> **Local worker automation**: The `ups_e2e` dev-shell command now launches a local Cloudflare Worker (`npm run dev:worker`) automatically before Playwright runs, waits for `/api/health`, and writes logs to `.tmp/local-worker.log`. The worker is torn down once the tests complete. Set `UPS_SKIP_LOCAL_WORKER=1` if you intentionally want to target a remote/staging API instead, or call `npx playwright test` directly. The health probe sends the API key header (`x-api-key`) using `VITE_API_KEY` (defaults to `test-api-key`); override it if you need to exercise auth failures. Before the worker boots, the helper script applies all SQL files under `migrations/` to the local D1 instance (via `npx wrangler d1 execute … --local`), so the test database always has the latest schema, and it exports `DISABLE_RATE_LIMIT=1` so the worker skips rate limiting during local CI-style runs. Because `wrangler dev` reads `.dev.vars` from the project root when invoked via `npm run dev:worker`, we now mirror both `API_SECRET_KEY` and `DISABLE_RATE_LIMIT=1` there to guarantee the bypass flag is honored during Playwright runs.

### Linting

```bash
npm run lint
```

---

## Unit Tests

Unit tests are located alongside their source files with `.test.jsx` extension.

### Example Test Structure

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.jsx';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeVisible();
  });
});
```

### Existing Unit Tests

- `src/PackageCarTracker.test.jsx` - Main component tests
- `src/WebSocketService.test.jsx` - WebSocket service tests
- `src/components/DiagnosticsDrawer.test.jsx` - Diagnostics component
- `src/components/AppErrorBoundary.test.jsx` - Error boundary
- `src/model/packageCarSchema.test.jsx` - Data model validation
- `src/storage/trackerStorage.test.jsx` - LocalStorage operations
- `src/usage/usageCounters.test.jsx` - Usage tracking
- `src/utils/csvParser.test.jsx` - CSV import/export

---

## E2E Tests

E2E tests are located in the `e2e/` directory and test the actual running application.

### Test Files

- `e2e/core-features.spec.js` - Core CRUD operations and filtering
- `e2e/shift-tracking.spec.js` - Shift management workflows
- `e2e/accessibility.spec.js` - WCAG compliance testing

### Writing E2E Tests

```javascript
import { test, expect } from '@playwright/test';

test('should add a package car', async ({ page }) => {
  await page.goto('/');
  
  // Click Add Car button
  await page.getByRole('button', { name: /Add Car/i }).click();
  
  // Fill in car ID
  await page.getByPlaceholder(/Enter car ID/i).fill('123456');
  
  // Submit
  await page.getByRole('button', { name: /Add/i }).click();
  
  // Verify car was added
  await expect(page.getByTestId('car-card-123456')).toBeVisible();
});
```

### Playwright Configuration

Configuration is in `playwright.config.js`:

- **baseURL**: `http://localhost:5173`
- **Browser**: Chromium (can enable Firefox/WebKit)
- **Screenshots**: On failure
- **Videos**: Retained on failure
- **Traces**: On first retry

---

## API Mocking

We use Mock Service Worker (MSW) for realistic API mocking.

### MSW Handlers

Located in `src/mocks/handlers.js`:

```javascript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/cars', () => {
    return HttpResponse.json({ cars: [] });
  }),
  
  http.post('/api/cars', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { car: { ...body, version: 1 } },
      { status: 201 }
    );
  }),
];
```

### MSW Server Setup

In `src/setupTests.js`:

```javascript
import { server } from './mocks/server.js';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Overriding Handlers in Tests

```javascript
import { server } from './mocks/server.js';
import { http, HttpResponse } from 'msw';

it('should handle API errors', async () => {
  server.use(
    http.get('/api/cars', () => {
      return HttpResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    })
  );
  
  // Test error handling...
});
```

---

## WebSocket Testing

WebSocket testing uses `mock-socket` for realistic WebSocket server simulation.

### Mock WebSocket Server

Located in `src/mocks/websocket.js`:

```javascript
import { startMockWebSocketServer, broadcastCarUpdate } from './mocks/websocket.js';

beforeEach(() => {
  startMockWebSocketServer();
});

it('should receive car updates', async () => {
  const updatePromise = new Promise((resolve) => {
    wsService.on('car_updated', resolve);
  });
  
  wsService.connect('test-user');
  
  broadcastCarUpdate({ id: '123456', arrived: true });
  
  const car = await updatePromise;
  expect(car.arrived).toBe(true);
});
```

### Available Mock Functions

- `startMockWebSocketServer()` - Start the mock server
- `stopMockWebSocketServer()` - Stop the mock server
- `broadcastMessage(msg)` - Send message to all clients
- `broadcastCarUpdate(car)` - Broadcast car update
- `broadcastShiftStarted(shift)` - Broadcast shift started
- `broadcastActiveUsers(count)` - Broadcast active users count
- `getConnectedClients()` - Get number of connected clients

---

## Accessibility Testing

Accessibility tests ensure WCAG 2.1 AA compliance using axe-core.

### Running Accessibility Tests

```bash
npm run test:e2e -- accessibility.spec.js
```

### Example Accessibility Test

```javascript
import { injectAxe, checkA11y } from 'axe-playwright';

test('should have no a11y violations', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  
  await checkA11y(page, null, {
    detailedReport: true,
  });
});
```

### Tested Accessibility Features

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader compatibility (ARIA labels)
- ✅ Color contrast (WCAG AA)
- ✅ Focus management
- ✅ Form labels and descriptions
- ✅ Semantic HTML

---

## Coverage Reports

Code coverage is generated using Vitest's V8 coverage provider.

### Generate Coverage

```bash
npm run test:coverage
```

### Coverage Thresholds

Configured in `vite.config.js`:

```javascript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70,
  },
}
```

### Coverage Reports

After running coverage, reports are available:

- **HTML**: `coverage/index.html` (open in browser)
- **Text**: Console output
- **LCOV**: `coverage/lcov.info` (for CI tools)

### Viewing HTML Report

```bash
npm run test:coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

---

## CI/CD Integration

Tests run automatically on GitHub Actions for all PRs and pushes to main.

### Workflow: `.github/workflows/test.yml`

**Jobs:**

1. **unit-tests** - Run Vitest unit tests with coverage
2. **e2e-tests** - Run Playwright E2E tests
3. **lint** - ESLint checks
4. **build** - Build verification

### Triggering CI

Tests run on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

### Viewing Results

- Visit GitHub Actions tab in repository
- Click on the workflow run
- View logs and artifacts (Playwright reports, coverage)

### Coverage Upload

Coverage reports are uploaded to Codecov for tracking over time.

---

## Best Practices

### 1. Test Naming

Use descriptive test names:

```javascript
// ✅ Good
it('should mark car as arrived when Arrived button is clicked', () => {});

// ❌ Bad
it('test 1', () => {});
```

### 2. Arrange-Act-Assert Pattern

```javascript
it('should add a car', async () => {
  // Arrange
  render(<PackageCarTracker />);
  const user = userEvent.setup();
  
  // Act
  await user.click(screen.getByRole('button', { name: /Add Car/i }));
  await user.type(screen.getByPlaceholder(/Enter car ID/i), '123456');
  await user.click(screen.getByRole('button', { name: /Add/i }));
  
  // Assert
  expect(screen.getByTestId('car-card-123456')).toBeVisible();
});
```

### 3. Avoid Implementation Details

```javascript
// ✅ Good - test behavior
await user.click(screen.getByRole('button', { name: /Add/i }));

// ❌ Bad - test implementation
await user.click(screen.getByClassName('add-button'));
```

### 4. Use Data Attributes for Test IDs

```jsx
<div data-testid="car-card-123456">
  {/* content */}
</div>
```

```javascript
expect(screen.getByTestId('car-card-123456')).toBeVisible();
```

### 5. Clean Up Between Tests

```javascript
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
```

---

## Troubleshooting

### Tests Timing Out

Increase timeout in `playwright.config.js`:

```javascript
use: {
  timeout: 30000, // 30 seconds
}
```

### WebSocket Connection Issues

Ensure mock server is started:

```javascript
beforeEach(() => {
  startMockWebSocketServer();
});
```

### MSW Handlers Not Working

Check that server is listening:

```javascript
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
```

### Coverage Not Updating

Clear coverage cache:

```bash
rm -rf coverage
npm run test:coverage
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)

---

## Contributing

When adding new features:

1. Write unit tests for components and utilities
2. Add E2E tests for user workflows
3. Ensure accessibility compliance
4. Maintain coverage above thresholds
5. Run all tests before committing

```bash
npm run test:all
npm run lint
```
