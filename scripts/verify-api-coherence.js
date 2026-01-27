import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://ups-tracker-api.invictustitan2.workers.dev';
const API_KEY = process.env.API_KEY || 'iILElb/wm5ErKmLOyJeHS8SwSODJpu05yHUT+F2eeJc=';

async function verifyApiCoherence() {
  console.log(`🔍 Verifying API Coherence against ${API_URL}...`);

  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  // 1. Submit a test usage event
  const testEvent = {
    userId: 'test-verifier',
    events: [
      { type: 'verification_test', count: 1, metadata: { timestamp: Date.now() } }
    ]
  };

  console.log('📤 Submitting test event...');
  const submitRes = await fetch(`${API_URL}/api/usage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(testEvent),
  });

  if (!submitRes.ok) {
    console.error(`❌ Submit failed: ${submitRes.status} ${submitRes.statusText}`);
    const text = await submitRes.text();
    console.error('Response:', text);
    process.exit(1);
  }
  console.log('✅ Submit successful');

  // 2. Fetch stats to verify the event was recorded
  console.log('nm📥 Fetching usage stats...');
  const statsRes = await fetch(`${API_URL}/api/usage/stats?limit=100`, {
    headers,
  });

  if (!statsRes.ok) {
    console.error(`❌ Fetch stats failed: ${statsRes.status} ${statsRes.statusText}`);
    process.exit(1);
  }

  const data = await statsRes.json();
  console.log('📊 Stats received:', JSON.stringify(data, null, 2));

  const verificationStat = data.stats.find(s => s.event_type === 'verification_test');
  if (verificationStat && verificationStat.total_count > 0) {
    console.log(`✅ PROOF: Found 'verification_test' with count ${verificationStat.total_count}`);
  } else {
    console.error('❌ FAILURE: Did not find the submitted test event in stats.');
    process.exit(1);
  }

  // 3. Verify Time-Series Aggregation
  console.log('nm📥 Fetching time-series stats (groupBy=day)...');
  const timeSeriesRes = await fetch(`${API_URL}/api/usage/stats?groupBy=day&period=7d`, {
    headers,
  });

  if (!timeSeriesRes.ok) {
    console.error(`❌ Fetch time-series failed: ${timeSeriesRes.status} ${timeSeriesRes.statusText}`);
    process.exit(1);
  }

  const tsData = await timeSeriesRes.json();
  console.log('📊 Time-Series Data:', JSON.stringify(tsData, null, 2));

  if (tsData.stats && tsData.stats.length > 0 && tsData.stats[0].date) {
    console.log('✅ PROOF: Time-series data contains "date" field.');
  } else {
    console.error('❌ FAILURE: Time-series data missing or malformed.');
    process.exit(1);
  }
}

verifyApiCoherence().catch(console.error);
