import { http, HttpResponse } from 'msw';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const STORAGE_KEY = 'ups-tracker-data';

const getDb = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { cars: [] };
  } catch {
    return { cars: [] };
  }
};

const saveDb = (data) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * Mock Service Worker handlers for API endpoints
 * This provides realistic API mocking for both tests and development
 */
export const handlers = [
  // Cars API
  http.get(`${API_BASE}/api/cars`, () => {
    const db = getDb();
    console.log('MSW GET /api/cars returning:', db.cars ? db.cars.length : 0, 'cars');
    return HttpResponse.json({
      cars: db.cars || [],
      count: (db.cars || []).length,
    });
  }),

  http.get(`${API_BASE}/api/cars/:id`, ({ params }) => {
    const { id } = params;
    const db = getDb();
    const car = (db.cars || []).find(c => c.id === id);
    
    if (car) {
        return HttpResponse.json({ car });
    }
    
    return HttpResponse.json({
      car: {
        id,
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.post(`${API_BASE}/api/cars`, async ({ request }) => {
    const body = await request.json();
    const db = getDb();
    const cars = db.cars || [];
    
    const newCar = {
      ...body,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Check if exists
    const existingIndex = cars.findIndex(c => c.id === newCar.id);
    if (existingIndex >= 0) {
        cars[existingIndex] = newCar;
    } else {
        cars.push(newCar);
    }
    
    saveDb({ ...db, cars });

    return HttpResponse.json(
      { car: newCar },
      { status: 201 }
    );
  }),

  http.put(`${API_BASE}/api/cars/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const db = getDb();
    const cars = db.cars || [];
    const index = cars.findIndex(c => c.id === id);
    
    let updatedCar;
    if (index >= 0) {
        // Extract updates from body (excluding expectedVersion)
        const { expectedVersion: _expectedVersion, ...updates } = body;
        
        updatedCar = {
            ...cars[index],
            ...updates,
            version: (cars[index].version || 1) + 1,
            updatedAt: new Date().toISOString(),
        };
        cars[index] = updatedCar;
    } else {
        // Create if not exists (upsert-ish behavior for mock)
        updatedCar = {
            id,
            ...body.updates,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        cars.push(updatedCar);
    }
    
    saveDb({ ...db, cars });

    return HttpResponse.json({ car: updatedCar });
  }),

  http.delete(`${API_BASE}/api/cars/:id`, ({ params }) => {
    const { id } = params;
    const db = getDb();
    const cars = db.cars || [];
    const newCars = cars.filter(c => c.id !== id);
    
    saveDb({ ...db, cars: newCars });

    return HttpResponse.json(
      {
        success: true,
        message: 'Car deleted successfully',
      },
      { status: 200 }
    );
  }),

  // Shifts API
  http.post(`${API_BASE}/api/shifts/start`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        shift: {
          id: Math.floor(Math.random() * 10000),
          userId: body.userId || 'test-user',
          startedAt: new Date().toISOString(),
          snapshot: body.snapshot || [],
          carCount: body.snapshot?.length || 0,
        },
      },
      { status: 201 }
    );
  }),

  http.post(`${API_BASE}/api/shifts/:id/end`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    return HttpResponse.json({
      shift: {
        id: parseInt(id),
        endedAt: new Date().toISOString(),
        finalSnapshot: body.finalSnapshot || [],
        duration: 28800, // 8 hours in seconds
      },
    });
  }),

  http.get(`${API_BASE}/api/shifts`, () => {
    return HttpResponse.json({
      shifts: [],
      count: 0,
    });
  }),

  // Sessions API
  http.post(`${API_BASE}/api/sessions/start`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        sessionId: `session-${Date.now()}`,
        userId: body.userId || 'test-user',
        startedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  http.post(`${API_BASE}/api/sessions/:sessionId/heartbeat`, () => {
    return HttpResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/api/sessions/:sessionId/end`, () => {
    return HttpResponse.json({
      success: true,
      endedAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/api/sessions/active-count`, () => {
    return HttpResponse.json({
      activeUsers: 1,
      sessions: [
        {
          sessionId: 'test-session',
          userId: 'test-user',
          lastSeen: new Date().toISOString(),
        },
      ],
    });
  }),

  // Usage API
  http.post(`${API_BASE}/api/usage`, () => {
    return HttpResponse.json(
      {
        success: true,
        message: 'Usage counters submitted',
      },
      { status: 201 }
    );
  }),

  http.get(`${API_BASE}/api/usage/stats`, () => {
    return HttpResponse.json({
      stats: [
        {
          userId: 'test-user',
          totalAdds: 0,
          totalUpdates: 0,
          totalDeletes: 0,
          totalImports: 0,
          totalExports: 0,
        },
      ],
    });
  }),

  // Audit API
  http.get(`${API_BASE}/api/audit`, () => {
    return HttpResponse.json({
      logs: [],
      count: 0,
    });
  }),

  http.get(`${API_BASE}/api/audit/car/:carId`, ({ params }) => {
    const { carId } = params;
    return HttpResponse.json({
      logs: [
        {
          id: 1,
          carId,
          action: 'created',
          userId: 'test-user',
          timestamp: new Date().toISOString(),
          changes: {},
        },
      ],
      count: 1,
    });
  }),

  // Notifications API
  http.post(`${API_BASE}/api/notifications/subscribe`, () => {
    return HttpResponse.json(
      {
        success: true,
        message: 'Subscription saved',
      },
      { status: 201 }
    );
  }),

  http.post(`${API_BASE}/api/notifications/unsubscribe`, () => {
    return HttpResponse.json({
      success: true,
      message: 'Subscription removed',
    });
  }),

  http.post(`${API_BASE}/api/notifications/send`, () => {
    return HttpResponse.json(
      {
        success: true,
        message: 'Notification sent',
        delivered: 1,
      },
      { status: 201 }
    );
  }),

  // Reset all cars (shift reset)
  http.post(`${API_BASE}/api/cars/reset`, () => {
    const db = getDb();
    const cars = (db.cars || []).map(car => ({
      ...car,
      arrived: false,
      late: false,
      empty: false,
      version: (car.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    }));
    
    saveDb({ ...db, cars });
    
    return HttpResponse.json(
      {
        success: true,
        message: 'All cars reset successfully',
        resetCount: cars.length,
      },
      { status: 200 }
    );
  }),
];

/**
 * Error handlers for testing error scenarios
 */
export const errorHandlers = [
  http.get(`${API_BASE}/api/cars`, () => {
    return HttpResponse.json(
      {
        error: 'Internal server error',
        message: 'Database connection failed',
      },
      { status: 500 }
    );
  }),
];
