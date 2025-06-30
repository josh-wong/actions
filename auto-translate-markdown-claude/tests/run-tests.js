#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Auto-Translate Markdown Tests\n');

const tests = [
  { name: 'Unit Tests', command: 'npm run test:unit' },
  { name: 'Integration Tests', command: 'npm run test:integration' },
  { name: 'Local Workflow Test', command: 'npm run test:local' }
];

let passedTests = 0;
let totalTests = tests.length;

for (const test of tests) {
  try {
    console.log(`🔍 Running ${test.name}...`);
    execSync(test.command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${test.name} passed\n`);
    passedTests++;
  } catch (error) {
    console.error(`❌ ${test.name} failed\n`);
  }
}

console.log('📊 Test Summary:');
console.log(`✅ Passed: ${passedTests}/${totalTests}`);
console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n💥 Some tests failed');
  process.exit(1);
}
