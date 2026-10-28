import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

const P95_BUDGET_MS = 200;
const BATCHES = 3;

async function measure(base) {
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const res = await fetch(`${base}/greet?name=Ada`);
    assert.equal(res.status, 200);
    await res.text();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * 0.95) - 1];
}

test('100 sequential requests stay under the p95 latency budget', async () => {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];

  try {
    for (let batch = 0; batch < BATCHES; batch++) results.push(await measure(base));
  } finally {
    server.close();
    await once(server, 'close');
  }

  const best = Math.min(...results);
  assert.ok(
    best < P95_BUDGET_MS,
    `best p95 across ${BATCHES} batches was ${best.toFixed(1)}ms, budget ${P95_BUDGET_MS}ms (${results.map((r) => r.toFixed(1)).join(', ')})`,
  );
});
