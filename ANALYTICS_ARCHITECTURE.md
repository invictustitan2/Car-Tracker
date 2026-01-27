# Analytics Dashboard Architecture

This document outlines the architecture of the Analytics Dashboard and provides a guide for extending it with new metrics and visualizations.

## Overview

The Analytics Dashboard is designed to be **extensible** and **modular**. It consumes data from the `usage_stats` table in Cloudflare D1 via the Worker API.

### Core Components

1.  **Backend (`workers/api.js`)**:
    *   `POST /api/usage`: Ingests raw events.
    *   `GET /api/usage/stats`: Aggregates data. Supports `groupBy` (day/hour) and `period` (7d/30d).

2.  **Frontend (`src/components/AnalyticsDashboard.jsx`)**:
    *   Fetches data using `usageApi.getStats`.
    *   Visualizes data using `recharts`.

## How to Add New Metrics

### 1. Track the Event
To track a new user action or system event, use the `trackUsage` helper in `PackageCarTracker.jsx` or call `usageApi.submit` directly.

**Example:**
```javascript
// In PackageCarTracker.jsx
trackUsage('my_new_event_type');
```

Or define a constant in `src/usage/usageCounters.js`:
```javascript
export const USAGE_EVENTS = {
  // ... existing events
  MY_NEW_EVENT: 'myNewEvent',
};
```

### 2. Visualize the Data
To display the new metric on the dashboard, update `src/components/AnalyticsDashboard.jsx`.

**Add a Bar to the Chart:**
```jsx
<Bar dataKey="myNewEvent" name="My New Metric" stackId="a" fill="#8884d8" />
```

**Add a Card:**
```jsx
<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
  <h3>My Metric</h3>
  <p>{distributionData.find(d => d.event_type === 'myNewEvent')?.total_count || 0}</p>
</div>
```

## Future Expansion Capabilities

The current architecture supports:
-   **Custom Date Ranges**: The API can be easily updated to support arbitrary `startDate` and `endDate`.
-   **User-Specific Stats**: The `usage_stats` table already includes `user_id`. You can filter by user to show personal dashboards.
-   **Real-Time Updates**: The dashboard currently fetches on load. You could subscribe to WebSocket updates to refresh stats in real-time.
