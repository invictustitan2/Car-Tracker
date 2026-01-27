import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportPath = path.join(__dirname, '..', 'playwright-report', 'results.json');

try {
  if (!fs.existsSync(reportPath)) {
    console.error('❌ E2E Validation Failed: Report file not found');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  // Playwright JSON report structure: 
  // stats: { expected: number, unexpected: number, flaky: number, skipped: number }
  const stats = report.stats || {};
  const suites = report.suites || [];
  
  // Calculate totals from suites if stats are missing/zero (fallback)
  let totalTests = 0;
  let failedTests = 0;
  
  // Recursive function to count tests
  const countTests = (suite) => {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        totalTests++;
        // Check if the last result was a failure
        if (!spec.ok && spec.tests[0]?.results?.some(r => r.status === 'failed' || r.status === 'timedOut')) {
          failedTests++;
        }
      });
    }
    if (suite.suites) {
      suite.suites.forEach(countTests);
    }
  };

  suites.forEach(countTests);

  // Use stats.unexpected if available, otherwise use manual count
  const unexpectedFailures = stats.unexpected ?? failedTests;

  console.log('----------------------------------------');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed:      ${totalTests - unexpectedFailures}`);
  console.log(`Failed:      ${unexpectedFailures}`);
  console.log('----------------------------------------');

  if (unexpectedFailures > 0) {
    console.error(`❌ E2E Validation Failed: ${unexpectedFailures} tests failed.`);
    process.exit(1);
  } else if (totalTests === 0) {
    console.error('❌ E2E Validation Failed: 0 tests executed. Something went wrong.');
    process.exit(1);
  } else {
    console.log('✅ E2E Validation Passed');
    process.exit(0);
  }

} catch (error) {
  console.error('❌ E2E Validation Error:', error.message);
  process.exit(1);
}
