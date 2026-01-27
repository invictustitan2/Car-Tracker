#!/bin/bash
# Test script to verify real-time sync is working

API_URL="https://ups-tracker-api.invictustitan2.workers.dev"

echo "🔍 Testing Real-Time Sync Integration"
echo "======================================"
echo ""

# Test 1: Check API health
echo "1. Checking API health..."
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ API is healthy"
  echo "$HEALTH" | jq '.'
else
  echo "❌ API health check failed"
  echo "$HEALTH"
  exit 1
fi
echo ""

# Test 2: Get current cars
echo "2. Fetching current cars from API..."
CARS=$(curl -s "$API_URL/api/cars")
CAR_COUNT=$(echo "$CARS" | jq '.cars | length')
echo "✅ Found $CAR_COUNT cars in database"
echo ""

# Test 3: Update a car and verify
if [ "$CAR_COUNT" -gt 0 ]; then
  FIRST_CAR_ID=$(echo "$CARS" | jq -r '.cars[0].id')
  echo "3. Testing update sync for car $FIRST_CAR_ID..."
  
  # Mark car as arrived
  UPDATE_RESULT=$(curl -s -X PUT \
    -H "Content-Type: application/json" \
    -d '{"arrived":true}' \
    "$API_URL/api/cars/$FIRST_CAR_ID")
  
  if echo "$UPDATE_RESULT" | grep -q '"car":'; then
    NEW_VERSION=$(echo "$UPDATE_RESULT" | jq -r '.car.version')
    echo "✅ Car updated successfully (version: $NEW_VERSION)"
    echo "$UPDATE_RESULT" | jq '.car'
  else
    echo "❌ Car update failed"
    echo "$UPDATE_RESULT"
  fi
  echo ""
  
  # Check audit log
  echo "4. Checking audit log..."
  AUDIT=$(curl -s "$API_URL/api/audit?carId=$FIRST_CAR_ID&limit=3")
  AUDIT_COUNT=$(echo "$AUDIT" | jq '.auditLogs | length')
  echo "✅ Found $AUDIT_COUNT audit entries for car $FIRST_CAR_ID"
  echo "$AUDIT" | jq '.auditLogs | .[0:3]'
else
  echo "⚠️  No cars in database to test updates"
fi

echo ""
echo "======================================"
echo "✨ Sync integration test complete!"
echo ""
echo "To test in browser:"
echo "1. Open https://tracker.aperion.cc in two different tabs"
echo "2. Mark a car as arrived in tab 1"
echo "3. Within 5 seconds, you should see the update in tab 2"
echo ""
