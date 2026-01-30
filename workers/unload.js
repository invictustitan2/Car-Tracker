/**
 * Unload Module API Handlers
 * 
 * Isolated endpoints under /api/unload/* for door board tracking.
 * Feature-flagged via ENABLE_UNLOAD_MODULE env variable.
 * 
 * See docs/unload/UNLOAD_API_CONTRACT.md for full specification.
 */

import { ValidationError } from './validators.js';

// Door range constants
const MIN_DOOR = 9;
const MAX_DOOR = 23;

/**
 * Validate door number (9-23)
 */
function validateDoorNumber(door) {
  const num = parseInt(door, 10);
  if (isNaN(num) || num < MIN_DOOR || num > MAX_DOOR) {
    throw new ValidationError(`Door number must be between ${MIN_DOOR} and ${MAX_DOOR}`, 'doorNumber');
  }
  return num;
}

/**
 * Validate percent (0-100)
 */
function validatePercent(value, fieldName = 'percent') {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new ValidationError(`${fieldName} must be between 0 and 100`, fieldName);
  }
  return num;
}

/**
 * Validate trailer number
 */
function validateTrailerNumber(trailer) {
  if (!trailer) {
    throw new ValidationError('Trailer number is required', 'trailerNumber');
  }
  const sanitized = String(trailer).trim().toUpperCase();
  if (sanitized.length === 0 || sanitized.length > 20) {
    throw new ValidationError('Trailer number must be 1-20 characters', 'trailerNumber');
  }
  if (!/^[A-Z0-9-]+$/i.test(sanitized)) {
    throw new ValidationError('Trailer number must be alphanumeric with dashes only', 'trailerNumber');
  }
  return sanitized;
}

/**
 * Validate door state
 */
function validateDoorState(state) {
  const valid = ['EMPTY', 'PENDING', 'OCCUPIED'];
  const upper = String(state).toUpperCase();
  if (!valid.includes(upper)) {
    throw new ValidationError(`Door state must be one of: ${valid.join(', ')}`, 'doorState');
  }
  return upper;
}

/**
 * Validate action type
 */
function validateAction(action) {
  const valid = ['START', 'PROGRESS_DELTA', 'FINISH', 'DEPART', 'FIX_INITIAL_PERCENT', 'NOTE'];
  const upper = String(action).toUpperCase();
  if (!valid.includes(upper)) {
    throw new ValidationError(`Action must be one of: ${valid.join(', ')}`, 'action');
  }
  return upper;
}

/**
 * Get current active shift (if any)
 */
async function getCurrentShiftId(db) {
  const shift = await db.prepare(
    'SELECT id FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  ).first();
  return shift?.id ?? null;
}

/**
 * Seed doors 9-23 for a shift if they don't exist
 */
async function seedDoorsForShift(db, shiftId) {
  const existing = await db.prepare(
    'SELECT COUNT(*) as count FROM unload_doors WHERE shift_id = ?'
  ).bind(shiftId).first();
  
  if (existing.count > 0) return;
  
  // Insert all doors as EMPTY
  const stmt = db.prepare(
    'INSERT INTO unload_doors (shift_id, door_number, door_state) VALUES (?, ?, ?)'
  );
  
  const batch = [];
  for (let door = MIN_DOOR; door <= MAX_DOOR; door++) {
    batch.push(stmt.bind(shiftId, door, 'EMPTY'));
  }
  
  await db.batch(batch);
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Main router for /api/unload/* requests
 */
export async function handleUnloadRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Helper for JSON responses
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  
  try {
    // GET /api/unload/doors
    if (method === 'GET' && path === '/api/unload/doors') {
      return await handleGetDoors(url, env.DB, json);
    }
    
    // POST /api/unload/verify
    if (method === 'POST' && path === '/api/unload/verify') {
      return await handleVerifyDoors(request, env.DB, json);
    }
    
    // POST /api/unload/visits/:id/action
    const actionMatch = path.match(/^\/api\/unload\/visits\/([^/]+)\/action$/);
    if (method === 'POST' && actionMatch) {
      return await handleVisitAction(actionMatch[1], request, env.DB, json);
    }
    
    // GET /api/unload/visits/:id/events
    const eventsMatch = path.match(/^\/api\/unload\/visits\/([^/]+)\/events$/);
    if (method === 'GET' && eventsMatch) {
      return await handleGetVisitEvents(eventsMatch[1], env.DB, json);
    }
    
    // GET /api/unload/visits/:id
    const visitMatch = path.match(/^\/api\/unload\/visits\/([^/]+)$/);
    if (method === 'GET' && visitMatch) {
      return await handleGetVisit(visitMatch[1], env.DB, json);
    }
    
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json({ error: 'Validation failed', details: error.message }, 400);
    }
    console.error('Unload API error:', error);
    throw error;
  }
}

/**
 * GET /api/unload/doors
 * Returns door board state for current or specified shift
 */
async function handleGetDoors(url, db, json) {
  let shiftId = url.searchParams.get('shift_id');
  
  // If no shift_id provided, use current active shift
  if (!shiftId) {
    shiftId = await getCurrentShiftId(db);
  }
  
  if (!shiftId) {
    // No active shift - return empty doors without shift context
    const doors = [];
    for (let door = MIN_DOOR; door <= MAX_DOOR; door++) {
      doors.push({
        doorNumber: door,
        doorState: 'EMPTY',
        activeVisit: null,
      });
    }
    return json({ success: true, shiftId: null, doors });
  }
  
  // Seed doors if first access for this shift
  await seedDoorsForShift(db, shiftId);
  
  // Get doors with active visits
  const { results } = await db.prepare(`
    SELECT 
      d.door_number,
      d.door_state,
      d.active_visit_id,
      d.updated_at,
      v.id as visit_id,
      v.trailer_number,
      v.origin_code,
      v.initial_percent,
      v.remaining_percent,
      v.status as visit_status,
      v.created_at as visit_created_at
    FROM unload_doors d
    LEFT JOIN unload_visits v ON d.active_visit_id = v.id
    WHERE d.shift_id = ?
    ORDER BY d.door_number
  `).bind(shiftId).all();
  
  const doors = results.map(row => ({
    doorNumber: row.door_number,
    doorState: row.door_state,
    updatedAt: row.updated_at,
    activeVisit: row.visit_id ? {
      id: row.visit_id,
      trailerNumber: row.trailer_number,
      originCode: row.origin_code,
      initialPercent: row.initial_percent,
      remainingPercent: row.remaining_percent,
      status: row.visit_status,
      createdAt: row.visit_created_at,
    } : null,
  }));
  
  return json({ success: true, shiftId: parseInt(shiftId), doors });
}

/**
 * POST /api/unload/verify
 * Bulk verify doors at start of shift
 */
async function handleVerifyDoors(request, db, json) {
  const body = await request.json();
  const { userId, doors } = body;
  
  if (!userId) {
    throw new ValidationError('userId is required', 'userId');
  }
  if (!Array.isArray(doors) || doors.length === 0) {
    throw new ValidationError('doors array is required', 'doors');
  }
  
  // Get or create shift
  let shiftId = await getCurrentShiftId(db);
  if (!shiftId) {
    // Auto-start a shift if none active
    await db.prepare(
      'INSERT INTO shifts (started_at, started_by, notes) VALUES (datetime("now"), ?, ?)'
    ).bind(userId, 'Auto-started for unload verify').run();
    shiftId = await getCurrentShiftId(db);
  }
  
  // Seed doors if needed
  await seedDoorsForShift(db, shiftId);
  
  const results = { doorsUpdated: 0, visitsCreated: 0, errors: [] };
  
  for (const doorEntry of doors) {
    try {
      const doorNumber = validateDoorNumber(doorEntry.doorNumber);
      const doorState = validateDoorState(doorEntry.doorState);
      
      if (doorState === 'OCCUPIED') {
        // Validate required fields for occupied
        const trailerNumber = validateTrailerNumber(doorEntry.trailerNumber);
        const initialPercent = validatePercent(doorEntry.initialPercent, 'initialPercent');
        const originCode = doorEntry.originCode?.trim().toUpperCase() || null;
        
        // Create visit
        const visitId = generateUUID();
        await db.prepare(`
          INSERT INTO unload_visits 
            (id, shift_id, door_number, trailer_number, origin_code, initial_percent, remaining_percent, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ARRIVED')
        `).bind(visitId, shiftId, doorNumber, trailerNumber, originCode, initialPercent, initialPercent).run();
        
        // Update door
        await db.prepare(`
          UPDATE unload_doors 
          SET door_state = 'OCCUPIED', active_visit_id = ?, updated_at = datetime('now'), updated_by = ?
          WHERE shift_id = ? AND door_number = ?
        `).bind(visitId, userId, shiftId, doorNumber).run();
        
        // Log event
        await db.prepare(`
          INSERT INTO unload_events (visit_id, shift_id, door_number, event_type, payload, actor)
          VALUES (?, ?, ?, 'VISIT_CREATE', ?, ?)
        `).bind(visitId, shiftId, doorNumber, JSON.stringify({
          trailerNumber,
          initialPercent,
          originCode,
        }), userId).run();
        
        results.visitsCreated++;
      } else {
        // EMPTY or PENDING - just update door state
        await db.prepare(`
          UPDATE unload_doors 
          SET door_state = ?, active_visit_id = NULL, updated_at = datetime('now'), updated_by = ?
          WHERE shift_id = ? AND door_number = ?
        `).bind(doorState, userId, shiftId, doorNumber).run();
        
        // Log event
        await db.prepare(`
          INSERT INTO unload_events (shift_id, door_number, event_type, payload, actor)
          VALUES (?, ?, 'DOOR_SET', ?, ?)
        `).bind(shiftId, doorNumber, JSON.stringify({ doorState }), userId).run();
      }
      
      results.doorsUpdated++;
    } catch (error) {
      results.errors.push({
        doorNumber: doorEntry.doorNumber,
        error: error.message,
      });
    }
  }
  
  return json({ success: true, shiftId, results });
}

/**
 * POST /api/unload/visits/:id/action
 * Perform action on a visit
 */
async function handleVisitAction(visitId, request, db, json) {
  const body = await request.json();
  const { action, userId } = body;
  
  if (!userId) {
    throw new ValidationError('userId is required', 'userId');
  }
  
  const validAction = validateAction(action);
  
  // Get visit
  const visit = await db.prepare(
    'SELECT * FROM unload_visits WHERE id = ?'
  ).bind(visitId).first();
  
  if (!visit) {
    return json({ error: 'Visit not found' }, 404);
  }
  
  if (visit.status === 'DEPARTED') {
    throw new ValidationError('Cannot perform actions on departed visit', 'status');
  }
  
  let eventPayload = {};
  let updates = { updated_at: "datetime('now')" };
  
  switch (validAction) {
    case 'START': {
      if (visit.status !== 'ARRIVED') {
        throw new ValidationError('Can only start from ARRIVED status', 'status');
      }
      updates.status = 'IN_PROGRESS';
      updates.started_at = "datetime('now')";
      eventPayload = { oldStatus: visit.status, newStatus: 'IN_PROGRESS' };
      break;
    }
    
    case 'PROGRESS_DELTA': {
      const delta = parseInt(body.delta, 10);
      if (isNaN(delta)) {
        throw new ValidationError('delta is required for PROGRESS_DELTA', 'delta');
      }
      
      const oldPercent = visit.remaining_percent;
      let newPercent = oldPercent + delta;
      
      // Clamp to valid range
      newPercent = Math.max(0, Math.min(visit.initial_percent, newPercent));
      
      updates.remaining_percent = newPercent;
      eventPayload = { delta, oldPercent, newPercent };
      break;
    }
    
    case 'FINISH': {
      updates.status = 'COMPLETED';
      updates.remaining_percent = 0;
      updates.completed_at = "datetime('now')";
      eventPayload = { oldStatus: visit.status, newStatus: 'COMPLETED', oldPercent: visit.remaining_percent };
      break;
    }
    
    case 'DEPART': {
      updates.status = 'DEPARTED';
      updates.departed_at = "datetime('now')";
      eventPayload = { oldStatus: visit.status, newStatus: 'DEPARTED' };
      
      // Clear door's active visit
      const nextDoorState = body.nextDoorState?.toUpperCase() === 'PENDING' ? 'PENDING' : 'EMPTY';
      await db.prepare(`
        UPDATE unload_doors 
        SET door_state = ?, active_visit_id = NULL, updated_at = datetime('now'), updated_by = ?
        WHERE active_visit_id = ?
      `).bind(nextDoorState, userId, visitId).run();
      
      eventPayload.nextDoorState = nextDoorState;
      break;
    }
    
    case 'FIX_INITIAL_PERCENT': {
      const newInitial = validatePercent(body.newInitialPercent, 'newInitialPercent');
      const reason = body.reason?.trim();
      if (!reason) {
        throw new ValidationError('reason is required for FIX_INITIAL_PERCENT', 'reason');
      }
      
      const oldInitial = visit.initial_percent;
      updates.initial_percent = newInitial;
      
      // Also adjust remaining if it exceeds new initial
      if (visit.remaining_percent > newInitial) {
        updates.remaining_percent = newInitial;
      }
      
      eventPayload = { oldInitial, newInitial, reason };
      break;
    }
    
    case 'NOTE': {
      const note = body.note?.trim();
      if (!note) {
        throw new ValidationError('note is required for NOTE action', 'note');
      }
      eventPayload = { note };
      // No updates to visit itself
      updates = {};
      break;
    }
  }
  
  // Build update query
  if (Object.keys(updates).length > 0) {
    const setClauses = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === "datetime('now')") {
        setClauses.push(`${key} = datetime('now')`);
      } else {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (setClauses.length > 0) {
      // Always update updated_at
      if (!setClauses.some(c => c.startsWith('updated_at'))) {
        setClauses.push("updated_at = datetime('now')");
      }
      
      values.push(visitId);
      await db.prepare(
        `UPDATE unload_visits SET ${setClauses.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }
  }
  
  // Log event
  await db.prepare(`
    INSERT INTO unload_events (visit_id, shift_id, door_number, event_type, payload, actor)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(visitId, visit.shift_id, visit.door_number, validAction, JSON.stringify(eventPayload), userId).run();
  
  // Get updated visit
  const updatedVisit = await db.prepare(
    'SELECT * FROM unload_visits WHERE id = ?'
  ).bind(visitId).first();
  
  return json({
    success: true,
    visit: {
      id: updatedVisit.id,
      doorNumber: updatedVisit.door_number,
      trailerNumber: updatedVisit.trailer_number,
      initialPercent: updatedVisit.initial_percent,
      remainingPercent: updatedVisit.remaining_percent,
      status: updatedVisit.status,
      updatedAt: updatedVisit.updated_at,
    },
    event: {
      action: validAction,
      payload: eventPayload,
    },
  });
}

/**
 * GET /api/unload/visits/:id
 */
async function handleGetVisit(visitId, db, json) {
  const visit = await db.prepare(
    'SELECT * FROM unload_visits WHERE id = ?'
  ).bind(visitId).first();
  
  if (!visit) {
    return json({ error: 'Visit not found' }, 404);
  }
  
  return json({
    success: true,
    visit: {
      id: visit.id,
      shiftId: visit.shift_id,
      doorNumber: visit.door_number,
      trailerNumber: visit.trailer_number,
      originCode: visit.origin_code,
      initialPercent: visit.initial_percent,
      remainingPercent: visit.remaining_percent,
      status: visit.status,
      startedAt: visit.started_at,
      completedAt: visit.completed_at,
      departedAt: visit.departed_at,
      createdAt: visit.created_at,
      updatedAt: visit.updated_at,
      notes: visit.notes,
    },
  });
}

/**
 * GET /api/unload/visits/:id/events
 */
async function handleGetVisitEvents(visitId, db, json) {
  // Verify visit exists
  const visit = await db.prepare(
    'SELECT id FROM unload_visits WHERE id = ?'
  ).bind(visitId).first();
  
  if (!visit) {
    return json({ error: 'Visit not found' }, 404);
  }
  
  const { results } = await db.prepare(`
    SELECT id, event_type, payload, actor, created_at
    FROM unload_events
    WHERE visit_id = ?
    ORDER BY created_at ASC
  `).bind(visitId).all();
  
  const events = results.map(row => ({
    id: row.id,
    eventType: row.event_type,
    payload: row.payload ? JSON.parse(row.payload) : null,
    actor: row.actor,
    createdAt: row.created_at,
  }));
  
  return json({ success: true, events });
}
