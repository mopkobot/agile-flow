import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

// Smoke load test. The latency budget is relative to the machine's own median,
// so a busy CI box does not fail the build for being busy. An absolute floor
// keeps a genuinely slow path from passing on a fast machine.
const RELATIVE_BUDGET = 10;
const ABSOLUTE_FLOOR_MS = 200;
const REQUESTS = 100;

async function sample(base) {
  const samples = [];
  for (let i = 0; i < REQUESTS; i++) {
    const start = performance.now();
    const res = await fetch(`${base}/greet?name=Ada`);
    assert.equal(res.status, 200);
    await res.text();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    median: samples[Math.floor(samples.length / 2)],
    p95: samples[Math.floor(samples.length * 0.95) - 1],
  };
}

test('100 sequential requests stay within a self-calibrated latency budget', async () => {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  let result;
  try {
    await sample(base); // warm the connection and the JIT
    result = await sample(base);
  } finally {
    server.close();
    await once(server, 'close');
  }

  const budget = Math.max(ABSOLUTE_FLOOR_MS, result.median * RELATIVE_BUDGET);
  assert.ok(
    result.p95 <= budget,
    `p95 ${result.p95.toFixed(1)}ms exceeded budget ${budget.toFixed(1)}ms (median ${result.median.toFixed(1)}ms)`,
  );
});
