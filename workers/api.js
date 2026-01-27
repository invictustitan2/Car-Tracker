/**
 * UPS Package Car Tracker - Cloudflare Worker API
 * * Handles all API requests for the tracker application.
 * Integrates with D1 database for persistence and Durable Objects for real-time sync.
 */

import {
    AuthenticationError,
    checkRateLimit,
    getClientIP,
    getCorsHeaders,
    RateLimitError,
    validateApiKey,
    validateWebSocketToken
} from './auth.js';
import { ValidationError, Validators } from './validators.js';

/**
 * Durable Object for WebSocket Connection Management
 * Handles real-time updates and broadcasts to all connected clients
 */
export class TrackerWebSocket {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // Map of WebSocket connections
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      await this.handleSession(server, request);
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Broadcast endpoint (called by worker to push updates)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const data = await request.json();
      this.broadcast(data);
      return new Response(JSON.stringify({ success: true, clients: this.sessions.size }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async handleSession(webSocket, request) {
    webSocket.accept();

    // Validate WebSocket authentication token
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const userIdParam = url.searchParams.get('userId');
    
    try {
      let userId;
      let dbSessionId = null;

      if (token) {
        const session = await validateWebSocketToken(token, this.env);
        userId = session.user_id;
        dbSessionId = session.id;
      } else if (userIdParam) {
        // Allow connection with just userId (legacy/simple mode)
        userId = userIdParam;
      } else {
        throw new AuthenticationError('Missing authentication (token or userId)');
      }

      const sessionId = crypto.randomUUID();
      
      const wsSession = {
        webSocket,
        userId,
        sessionId,
        dbSessionId,
        connectedAt: Date.now(),
      };
      
      this.sessions.set(sessionId, wsSession);
      
      // Send welcome message
      webSocket.send(JSON.stringify({
        type: 'connected',
        sessionId,
        userId,
        timestamp: new Date().toISOString(),
        activeClients: this.sessions.size,
      }));
      
      // Broadcast new connection to other clients
      this.broadcast({
        type: 'client_connected',
        userId,
        activeClients: this.sessions.size,
      }, sessionId);

      // Handle incoming messages
      webSocket.addEventListener('message', async (msg) => {
        try {
          const data = JSON.parse(msg.data);
          await this.handleMessage(sessionId, data);
        } catch (error) {
          console.error('Error handling message:', error);
          webSocket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
          }));
        }
      });

      // Handle disconnection
      webSocket.addEventListener('close', () => {
        this.sessions.delete(sessionId);
        this.broadcast({
          type: 'client_disconnected',
          userId,
          activeClients: this.sessions.size,
        });
      });
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      try {
        webSocket.send(JSON.stringify({ type: 'error', message: `Auth failed: ${error.message}` }));
      } catch (e) {}
      webSocket.close(1008, 'Authentication required');
    }

    webSocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.sessions.delete(sessionId);
    });
  }

  async handleMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Handle different message types
    switch (data.type) {
      case 'ping':
        session.webSocket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        }));
        break;
      
      case 'subscribe':
        // Client can subscribe to specific event types
        session.subscriptions = data.events || [];
        break;
      
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  broadcast(data, excludeSessionId = null) {
    const message = JSON.stringify(data);
    console.log(`DO broadcasting message to ${this.sessions.size} clients:`, message);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId !== excludeSessionId) {
        try {
          session.webSocket.send(message);
        } catch (error) {
          console.error('Error broadcasting to session:', sessionId, error);
          this.sessions.delete(sessionId);
        }
      }
    }
  }
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const clientIP = getClientIP(request);

    // Get proper CORS headers
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handlers
      
      // WebSocket upgrade endpoint
      if (path === '/api/ws') {
        // Get or create Durable Object instance
        const id = env.TRACKER_WS.idFromName('global');
        const stub = env.TRACKER_WS.get(id);
        return await stub.fetch(request);
      }
      
      // Protect API routes with authentication and rate limiting
      if (path.startsWith('/api/')) {
        await validateApiKey(request, env);
        await checkRateLimit(env, clientIP, path);
      }
      
      if (path.startsWith('/api/cars')) {
        return await handleCarsRequest(request, env, corsHeaders);
      } else if (path.startsWith('/api/sync')) {
        return await handleSyncRequest(request, env, corsHeaders);
      } else if (path.startsWith('/api/shifts')) {
        return await handleShiftsRequest(request, env, corsHeaders);
      } else if (path.startsWith('/api/audit')) {
        return await handleAuditRequest(request, env, corsHeaders);
      } else if (path.startsWith('/api/sessions')) {
        const response = await handleSessionsRequest(request, env, corsHeaders);
        // Broadcast active user count changes
        if (request.method !== 'GET' || path.includes('/active')) {
          // await broadcastUpdate(env, { type: 'active_users_updated' });
        }
        return response;
      } else if (path.startsWith('/api/usage')) {
        return await handleUsageRequest(request, env, corsHeaders);
      } else if (path.startsWith('/api/notifications')) {
        return await handleNotificationsRequest(request, env, corsHeaders);
      } else if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    } catch (error) {
      console.error('Worker error:', error);
      
      // Handle custom errors with appropriate status codes
      if (error instanceof AuthenticationError) {
        return jsonResponse({ error: 'Authentication required' }, corsHeaders, 401);
      }
      if (error instanceof RateLimitError) {
        return jsonResponse({ error: 'Rate limit exceeded' }, corsHeaders, 429);
      }
      if (error instanceof ValidationError) {
        return jsonResponse({ error: 'Validation failed', details: error.message }, corsHeaders, 400);
      }
      
      // Hide error details in production
      const isDevelopment = env.ENVIRONMENT === 'development';
      return jsonResponse({ 
        error: 'Internal server error',
        ...(isDevelopment && { message: error.message, stack: error.stack })
      }, corsHeaders, 500);
    }
  },
};

/**
 * Handle car-related requests (GET, POST, PUT, DELETE)
 */
async function handleCarsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const carId = url.pathname.split('/').pop();

  // GET /api/cars - List all cars
  if (method === 'GET' && url.pathname === '/api/cars') {
    const stmt = env.DB.prepare('SELECT * FROM cars ORDER BY id');
    const { results } = await stmt.all();
    
    const cars = results.map(row => ({
      id: row.id,
      location: row.location,
      arrived: Boolean(row.arrived),
      late: Boolean(row.late),
      empty: Boolean(row.empty),
      notes: row.notes,
      lastUpdatedAt: row.last_updated_at,
      lastUpdatedBy: row.last_updated_by,
      version: row.version,
    }));

    return jsonResponse({ cars }, corsHeaders);
  }

  // POST /api/cars/reset - Reset all cars (start new shift)
  if (method === 'POST' && url.pathname === '/api/cars/reset') {
    const userId = url.searchParams.get('userId') || 'anonymous';
    const hard = url.searchParams.get('hard') === 'true';
    
    if (hard) {
      // HARD RESET: Delete everything
      await env.DB.prepare('DELETE FROM cars').run();
      // Try to clear audit log if it exists, but ignore errors if it doesn't to prevent 500s
      try { await env.DB.prepare('DELETE FROM audit_log').run(); } catch(e) {}
      
      // Log audit for the wipe (if table still exists/wasn't dropped)
      try { await logAudit(env.DB, 'ALL', 'delete', null, null, 'Hard Reset (Database Wiped)', userId); } catch(e) {}

      await broadcastUpdate(env, { type: 'cars_updated' });
      return jsonResponse({ success: true, message: 'Database wiped' }, corsHeaders);
    }
    
    // SOFT RESET
    // Reset all cars to pending state
    await env.DB.prepare(`
      UPDATE cars 
      SET arrived = 0, late = 0, empty = 0, 
          last_updated_at = datetime('now'), 
          version = version + 1
    `).run();

    // Log audit
    await logAudit(env.DB, 'ALL', 'reset', null, null, 'Shift Reset', userId);

    // Broadcast update
    await broadcastUpdate(env, { type: 'cars_updated' });

    return jsonResponse({ success: true }, corsHeaders);
  }

  // GET /api/cars/:id - Get single car
  if (method === 'GET' && carId !== 'cars') {
    Validators.carId(carId);
    
    const stmt = env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(carId);
    const car = await stmt.first();
    
    if (!car) {
      return jsonResponse({ error: 'Car not found' }, corsHeaders, 404);
    }

    return jsonResponse({
      car: {
        id: car.id,
        location: car.location,
        arrived: Boolean(car.arrived),
        late: Boolean(car.late),
        empty: Boolean(car.empty),
        notes: car.notes,
        lastUpdatedAt: car.last_updated_at,
        lastUpdatedBy: car.last_updated_by,
        version: car.version,
      }
    }, corsHeaders);
  }

  // POST /api/cars - Create new car
  if (method === 'POST' && url.pathname === '/api/cars') {
    Validators.requestBodySize(request);
    const body = await request.json();
    const { id, location = 'Yard', userId = 'anonymous' } = body;

    if (!id) {
      return jsonResponse({ error: 'Car ID required' }, corsHeaders, 400);
    }

    // Validate inputs
    Validators.carId(id);
    Validators.userId(userId);
    Validators.location(location);

    // Check if car already exists
    const existing = await env.DB.prepare('SELECT id FROM cars WHERE id = ?').bind(id).first();
    if (existing) {
      return jsonResponse({ error: 'Car already exists' }, corsHeaders, 409);
    }

    // Insert new car
    await env.DB.prepare(`
      INSERT INTO cars (id, location, arrived, late, empty, last_updated_by, last_updated_at)
      VALUES (?, ?, 0, 0, 0, ?, datetime('now'))
    `).bind(id, location, userId).run();

    // Log to audit
    await logAudit(env.DB, id, 'created', null, null, JSON.stringify({ location }), userId);

    // Broadcast update
    console.log('Broadcasting cars_updated from handleCarsRequest POST');
    await broadcastUpdate(env, { type: 'cars_updated' });

    const car = await env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(id).first();

    return jsonResponse({
      car: {
        id: car.id,
        location: car.location,
        arrived: Boolean(car.arrived),
        late: Boolean(car.late),
        empty: Boolean(car.empty),
        version: car.version,
      }
    }, corsHeaders, 201);
  }

  // PUT /api/cars/:id - Update car
  if (method === 'PUT' && carId !== 'cars') {
    Validators.requestBodySize(request);
    Validators.carId(carId);
    
    const body = await request.json();
    const { location, arrived, late, empty, notes, userId = 'anonymous', expectedVersion } = body;

    // Validate inputs
    Validators.userId(userId);
    if (location !== undefined) Validators.location(location);
    if (notes !== undefined) Validators.notes(notes);

    // Get current car state
    const current = await env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(carId).first();
    
    // If car doesn't exist, create it (Upsert behavior)
    if (!current) {
      // Insert new car with provided values or defaults
      await env.DB.prepare(`
        INSERT INTO cars (id, location, arrived, late, empty, notes, last_updated_by, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        carId, 
        location !== undefined ? location : 'Yard', 
        arrived ? 1 : 0, 
        late ? 1 : 0, 
        empty ? 1 : 0,
        notes || null,
        userId
      ).run();

      await logAudit(env.DB, carId, 'created', null, null, 'Auto-created via update', userId);
      
      // Broadcast update
      await broadcastUpdate(env, { type: 'cars_updated' });

      const newCar = await env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(carId).first();
      
      return jsonResponse({
        car: {
          id: newCar.id,
          location: newCar.location,
          arrived: Boolean(newCar.arrived),
          late: Boolean(newCar.late),
          empty: Boolean(newCar.empty),
          notes: newCar.notes,
          lastUpdatedAt: newCar.last_updated_at,
          lastUpdatedBy: newCar.last_updated_by,
          version: newCar.version,
        }
      }, corsHeaders, 200);
    }

    // Optimistic concurrency control
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      return jsonResponse({ 
        error: 'Version conflict',
        currentVersion: current.version,
        expectedVersion 
      }, corsHeaders, 409);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    const auditLogs = [];

    if (location !== undefined && location !== current.location) {
      updates.push('location = ?');
      values.push(location);
      auditLogs.push({ field: 'location', oldValue: current.location, newValue: location });
    }

    if (arrived !== undefined && Boolean(arrived) !== Boolean(current.arrived)) {
      updates.push('arrived = ?');
      values.push(arrived ? 1 : 0);
      auditLogs.push({ field: 'arrived', oldValue: String(Boolean(current.arrived)), newValue: String(Boolean(arrived)) });
    }

    if (late !== undefined && Boolean(late) !== Boolean(current.late)) {
      updates.push('late = ?');
      values.push(late ? 1 : 0);
      auditLogs.push({ field: 'late', oldValue: String(Boolean(current.late)), newValue: String(Boolean(late)) });
    }

    if (empty !== undefined && Boolean(empty) !== Boolean(current.empty)) {
      updates.push('empty = ?');
      values.push(empty ? 1 : 0);
      auditLogs.push({ field: 'empty', oldValue: String(Boolean(current.empty)), newValue: String(Boolean(empty)) });
    }

    if (notes !== undefined && notes !== current.notes) {
      updates.push('notes = ?');
      values.push(notes);
      auditLogs.push({ field: 'notes', oldValue: current.notes || '', newValue: notes });
    }

    if (updates.length === 0) {
      // No changes, return current state
      return jsonResponse({
        car: {
          id: current.id,
          location: current.location,
          arrived: Boolean(current.arrived),
          late: Boolean(current.late),
          empty: Boolean(current.empty),
          notes: current.notes,
          version: current.version,
        }
      }, corsHeaders);
    }

    // Increment version
    updates.push('version = version + 1');
    updates.push('last_updated_by = ?');
    values.push(userId);
    updates.push('last_updated_at = datetime(\'now\')');

    // Execute update
    values.push(carId);
    await env.DB.prepare(`
      UPDATE cars 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    // Log all changes to audit
    for (const log of auditLogs) {
      await logAudit(env.DB, carId, 'updated', log.field, log.oldValue, log.newValue, userId);
    }

    // Broadcast update
    await broadcastUpdate(env, { type: 'cars_updated' });

    // Return updated car
    const updated = await env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(carId).first();

    return jsonResponse({
      car: {
        id: updated.id,
        location: updated.location,
        arrived: Boolean(updated.arrived),
        late: Boolean(updated.late),
        empty: Boolean(updated.empty),
        notes: updated.notes,
        lastUpdatedAt: updated.last_updated_at,
        lastUpdatedBy: updated.last_updated_by,
        version: updated.version,
      }
    }, corsHeaders);
  }

  // DELETE /api/cars/:id - Delete car
  if (method === 'DELETE' && carId !== 'cars') {
    Validators.carId(carId);
    
    const userId = url.searchParams.get('userId') || 'anonymous';
    Validators.userId(userId);

    const car = await env.DB.prepare('SELECT * FROM cars WHERE id = ?').bind(carId).first();
    if (!car) {
      return jsonResponse({ error: 'Car not found' }, corsHeaders, 404);
    }

    await env.DB.prepare('DELETE FROM cars WHERE id = ?').bind(carId).run();
    await logAudit(env.DB, carId, 'deleted', null, JSON.stringify(car), null, userId);

    // Broadcast update
    await broadcastUpdate(env, { type: 'cars_updated' });

    return jsonResponse({ success: true }, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle sync-related requests (for real-time updates)
 */
async function handleSyncRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  
  // GET /api/sync/changes?since=timestamp
  if (request.method === 'GET' && url.pathname === '/api/sync/changes') {
    const since = url.searchParams.get('since');
    
    let query = 'SELECT * FROM cars';
    let stmt;
    
    if (since) {
      stmt = env.DB.prepare(`${query} WHERE last_updated_at > ? ORDER BY last_updated_at`).bind(since);
    } else {
      stmt = env.DB.prepare(`${query} ORDER BY last_updated_at`);
    }

    const { results } = await stmt.all();
    
    const cars = results.map(row => ({
      id: row.id,
      location: row.location,
      arrived: Boolean(row.arrived),
      late: Boolean(row.late),
      empty: Boolean(row.empty),
      notes: row.notes,
      lastUpdatedAt: row.last_updated_at,
      lastUpdatedBy: row.last_updated_by,
      version: row.version,
    }));

    return jsonResponse({ 
      cars,
      timestamp: new Date().toISOString(),
    }, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle shift-related requests
 */
async function handleShiftsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  // GET /api/shifts - List recent shifts
  if (method === 'GET' && url.pathname === '/api/shifts') {
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    Validators.pagination(limit, 0);
    
    const stmt = env.DB.prepare(`
      SELECT * FROM shifts 
      ORDER BY started_at DESC 
      LIMIT ?
    `).bind(limit);
    
    const { results } = await stmt.all();
    
    const shifts = results.map(row => ({
      id: row.id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      startedBy: row.started_by,
      endedBy: row.ended_by,
      notes: row.notes,
      snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
      stats: row.stats ? JSON.parse(row.stats) : null,
    }));

    return jsonResponse({ shifts }, corsHeaders);
  }

  // POST /api/shifts - Start or end a shift
  if (method === 'POST' && url.pathname === '/api/shifts') {
    Validators.requestBodySize(request);
    const body = await request.json();
    const { action, userId, notes } = body;

    Validators.userId(userId || 'anonymous');
    if (notes) Validators.shiftNotes(notes);

    if (action === 'start') {
      await env.DB.prepare(`
        INSERT INTO shifts (started_at, started_by, notes)
        VALUES (datetime('now'), ?, ?)
      `).bind(userId || 'anonymous', notes || '').run();

      // Broadcast update
      await broadcastUpdate(env, { type: 'shift_started' });

      return jsonResponse({ success: true, action: 'start' }, corsHeaders, 201);
    }

    if (action === 'end') {
      // Get current shift
      const currentShift = await env.DB.prepare(`
        SELECT id FROM shifts 
        WHERE ended_at IS NULL 
        ORDER BY started_at DESC 
        LIMIT 1
      `).first();

      if (!currentShift) {
        return jsonResponse({ error: 'No active shift found' }, corsHeaders, 404);
      }

      // Get snapshot of all cars
      const { results } = await env.DB.prepare('SELECT * FROM cars').all();
      const snapshot = results.map(row => ({
        id: row.id,
        location: row.location,
        arrived: Boolean(row.arrived),
        late: Boolean(row.late),
        empty: Boolean(row.empty),
      }));

      // Calculate stats
      const stats = {
        totalCars: results.length,
        arrived: results.filter(r => r.arrived).length,
        late: results.filter(r => r.late).length,
        empty: results.filter(r => r.empty).length,
        notArrived: results.filter(r => !r.arrived).length,
      };

      // End shift
      await env.DB.prepare(`
        UPDATE shifts 
        SET ended_at = datetime('now'), 
            ended_by = ?,
            notes = ?,
            snapshot = ?,
            stats = ?
        WHERE id = ?
      `).bind(
        userId || 'anonymous',
        notes || '',
        JSON.stringify(snapshot),
        JSON.stringify(stats),
        currentShift.id
      ).run();

      return jsonResponse({ 
        success: true, 
        action: 'end',
        stats,
      }, corsHeaders);
    }

    return jsonResponse({ error: 'Invalid action' }, corsHeaders, 400);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle audit log requests
 */
async function handleAuditRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  
  // GET /api/audit?carId=xxx&limit=50
  if (request.method === 'GET' && url.pathname === '/api/audit') {
    const carId = url.searchParams.get('carId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let stmt;
    if (carId) {
      stmt = env.DB.prepare(`
        SELECT * FROM audit_log 
        WHERE car_id = ? 
        ORDER BY changed_at DESC 
        LIMIT ?
      `).bind(carId, limit);
    } else {
      stmt = env.DB.prepare(`
        SELECT * FROM audit_log 
        ORDER BY changed_at DESC 
        LIMIT ?
      `).bind(limit);
    }

    const { results } = await stmt.all();

    return jsonResponse({ auditLogs: results }, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle session-related requests
 */
async function handleSessionsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[3]; // /api/sessions/:id

  // POST /api/sessions/start - Start new session
  if (method === 'POST' && url.pathname === '/api/sessions/start') {
    Validators.requestBodySize(request);
    const body = await request.json();
    const { userId, deviceInfo } = body;
    
    Validators.userId(userId || 'anonymous');
    
    const newSessionId = crypto.randomUUID();
    
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, device_info)
      VALUES (?, ?, ?)
    `).bind(newSessionId, userId || 'anonymous', deviceInfo || '').run();

    // Broadcast update
    await broadcastUpdate(env, { type: 'active_users_updated' });

    return jsonResponse({ 
      sessionId: newSessionId,
      userId: userId || 'anonymous',
      startedAt: new Date().toISOString(),
    }, corsHeaders, 201);
  }

  // PUT /api/sessions/:id/heartbeat - Update session activity
  if (method === 'PUT' && sessionId && url.pathname.endsWith('/heartbeat')) {
    Validators.sessionId(sessionId);
    
    await env.DB.prepare(`
      UPDATE sessions 
      SET last_heartbeat = datetime('now')
      WHERE id = ?
    `).bind(sessionId).run();

    return jsonResponse({ success: true }, corsHeaders);
  }

  // POST /api/sessions/:id/end - End session
  if (method === 'POST' && sessionId && url.pathname.endsWith('/end')) {
    Validators.sessionId(sessionId);
    
    await env.DB.prepare(`
      UPDATE sessions 
      SET ended_at = datetime('now')
      WHERE id = ?
    `).bind(sessionId).run();

    // Broadcast update
    await broadcastUpdate(env, { type: 'active_users_updated' });

    return jsonResponse({ success: true }, corsHeaders);
  }

  // GET /api/sessions/active - Get active sessions count
  if (method === 'GET' && url.pathname === '/api/sessions/active') {
    const { results } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM sessions
      WHERE ended_at IS NULL 
      AND last_heartbeat > datetime('now', '-5 minutes')
    `).all();

    return jsonResponse({ 
      activeUsers: results[0]?.count || 0 
    }, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle usage stats requests
 */
async function handleUsageRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  // POST /api/usage - Submit usage events
  if (method === 'POST' && url.pathname === '/api/usage') {
    const body = await request.json();
    const { userId, events } = body;

    if (!events || !Array.isArray(events)) {
      return jsonResponse({ error: 'Events array required' }, corsHeaders, 400);
    }

    // Insert usage events
    for (const event of events) {
      await env.DB.prepare(`
        INSERT INTO usage_stats (user_id, event_type, event_count, metadata)
        VALUES (?, ?, ?, ?)
      `).bind(
        userId || 'anonymous',
        event.type,
        event.count || 1,
        event.metadata ? JSON.stringify(event.metadata) : null
      ).run();
    }

    return jsonResponse({ 
      success: true,
      eventsRecorded: events.length 
    }, corsHeaders, 201);
  }

  // GET /api/usage/stats - Get aggregated usage stats
  if (method === 'GET' && url.pathname === '/api/usage/stats') {
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const groupBy = url.searchParams.get('groupBy'); // 'day', 'hour'
    const period = url.searchParams.get('period'); // '7d', '30d'
    
    let query = 'SELECT event_type, SUM(event_count) as total_count';
    let groupByClause = 'GROUP BY event_type';
    let orderByClause = 'ORDER BY total_count DESC';
    let params = [];

    // Handle time-series grouping
    if (groupBy === 'day') {
      query += ", strftime('%Y-%m-%d', recorded_at) as date";
      groupByClause = "GROUP BY date, event_type";
      orderByClause = "ORDER BY date ASC, event_type";
    } else if (groupBy === 'hour') {
      query += ", strftime('%Y-%m-%d %H:00', recorded_at) as hour";
      groupByClause = "GROUP BY hour, event_type";
      orderByClause = "ORDER BY hour ASC, event_type";
    }

    query += ' FROM usage_stats';

    // Handle period filtering
    if (period) {
      const days = period === '30d' ? 30 : 7;
      query += ` WHERE recorded_at > datetime('now', '-${days} days')`;
    }

    query += ` ${groupByClause} ${orderByClause}`;
    
    if (!groupBy) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const { results } = await env.DB.prepare(query).bind(...params).all();

    return jsonResponse({ stats: results }, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Log an audit entry
 */
async function logAudit(db, carId, action, field, oldValue, newValue, userId, sessionId = null) {
  await db.prepare(`
    INSERT INTO audit_log (car_id, action, field_changed, old_value, new_value, changed_by, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(carId, action, field, oldValue, newValue, userId, sessionId).run();
}

/**
 * Handle push notification subscription requests
 */
async function handleNotificationsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;

  // POST /api/notifications/subscribe - Save push subscription
  if (path === '/api/notifications/subscribe' && request.method === 'POST') {
    try {
      const { userId, subscription } = await request.json();

      if (!userId || !subscription) {
        return jsonResponse({ error: 'Missing userId or subscription' }, corsHeaders, 400);
      }

      // Store subscription in database
      const stmt = env.DB.prepare(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          endpoint = excluded.endpoint,
          p256dh_key = excluded.p256dh_key,
          auth_key = excluded.auth_key,
          updated_at = datetime('now')
      `).bind(
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth
      );

      await stmt.run();

      return jsonResponse({ 
        success: true,
        message: 'Push subscription saved' 
      }, corsHeaders);
    } catch (error) {
      console.error('Error saving push subscription:', error);
      return jsonResponse({ error: 'Failed to save subscription', message: error.message }, corsHeaders, 500);
    }
  }

  // POST /api/notifications/unsubscribe - Remove push subscription
  if (path === '/api/notifications/unsubscribe' && request.method === 'POST') {
    try {
      const { userId } = await request.json();

      if (!userId) {
        return jsonResponse({ error: 'Missing userId' }, corsHeaders, 400);
      }

      const stmt = env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId);
      await stmt.run();

      return jsonResponse({ 
        success: true,
        message: 'Push subscription removed' 
      }, corsHeaders);
    } catch (error) {
      console.error('Error removing push subscription:', error);
      return jsonResponse({ error: 'Failed to remove subscription', message: error.message }, corsHeaders, 500);
    }
  }

  // POST /api/notifications/send - Send push notification (admin only)
  if (path === '/api/notifications/send' && request.method === 'POST') {
    try {
      const { title, body, userId } = await request.json();

      if (!title || !body) {
        return jsonResponse({ error: 'Missing title or body' }, corsHeaders, 400);
      }

      // Get subscriptions (all users or specific user)
      let stmt;
      if (userId) {
        stmt = env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(userId);
      } else {
        stmt = env.DB.prepare('SELECT * FROM push_subscriptions');
      }

      const { results: subscriptions } = await stmt.all();

      // Note: Actual push notification sending requires web-push library
      // This is a placeholder for the implementation
      // In production, you would use VAPID keys and web-push to send notifications

      return jsonResponse({ 
        success: true,
        message: `Would send notification to ${subscriptions.length} subscribers`,
        count: subscriptions.length
      }, corsHeaders);
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return jsonResponse({ error: 'Failed to send notifications', message: error.message }, corsHeaders, 500);
    }
  }

  return jsonResponse({ error: 'Invalid notification endpoint' }, corsHeaders, 404);
}

/**
 * Broadcast update to all connected WebSocket clients
 */
async function broadcastUpdate(env, data) {
  try {
    console.log('broadcastUpdate called with:', JSON.stringify(data));
    const id = env.TRACKER_WS.idFromName('global');
    const stub = env.TRACKER_WS.get(id);
    await stub.fetch(new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
}

/**
 * Helper to create JSON responses
 */
function jsonResponse(data, corsHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

import webPush from 'web-push';

/**
 * Send Web Push notification to a subscription
 */
async function sendPushNotification(subscription, payload, env) {
  try {
    // Check if we have VAPID keys configured
    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
      console.warn('VAPID keys not configured - skipping push notification');
      return false;
    }

    // Configure web-push
    webPush.setVapidDetails(
      'mailto:admin@ups-tracker.com',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
    };

    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    // 410 Gone means subscription is invalid
    if (error.statusCode === 410) {
      return 'invalid';
    }
    return false;
  }
}

/**
 * Check for late cars and send notifications
 * Called by scheduled event (cron trigger)
 */
async function checkLateCarNotifications(env) {
  try {
    // Get all cars marked as late
    const lateCars = await env.DB.prepare(
      'SELECT id, location, updated_at FROM cars WHERE late = 1'
    ).all();

    if (!lateCars.results || lateCars.results.length === 0) {
      console.log('No late cars found');
      return { sent: 0, failed: 0 };
    }

    console.log(`Found ${lateCars.results.length} late car(s)`);

    // Get all active push subscriptions
    const subscriptions = await env.DB.prepare(
      'SELECT * FROM push_subscriptions'
    ).all();

    if (!subscriptions.results || subscriptions.results.length === 0) {
      console.log('No push subscriptions found');
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Send notification to each subscription
    for (const subscription of subscriptions.results) {
      const payload = {
        title: 'Late Package Cars Alert',
        body: `${lateCars.results.length} car(s) are marked as late`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: {
          type: 'late_cars',
          count: lateCars.results.length,
          cars: lateCars.results.map(car => ({
            id: car.id,
            location: car.location,
          })),
        },
      };

      const result = await sendPushNotification(subscription, payload, env);
      if (result === true) {
        sent++;
      } else if (result === 'invalid') {
        // Remove invalid subscription
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
          .bind(subscription.endpoint)
          .run();
        console.log('Removed invalid subscription:', subscription.user_id);
        failed++;
      } else {
        failed++;
      }
    }

    console.log(`Push notifications sent: ${sent}, failed: ${failed}`);
    return { sent, failed, lateCars: lateCars.results.length };
  } catch (error) {
    console.error('Error checking late car notifications:', error);
    return { error: error.message };
  }
}

/**
 * Scheduled event handler (Cron Triggers)
 * Runs periodically to check for late cars and send notifications
 */
export async function scheduled(event, env, ctx) {
  console.log('Scheduled event triggered:', event.cron);
  
  switch (event.cron) {
    case '*/15 * * * *': // Every 15 minutes
      ctx.waitUntil(checkLateCarNotifications(env));
      break;
    default:
      console.log('Unknown cron schedule:', event.cron);
  }
}
