import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

test('100 sequential requests stay under the p95 latency budget', async () => {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/greet?name=Ada`;
  const samples = [];

  try {
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const res = await fetch(url);
      assert.equal(res.status, 200);
      await res.text();
      samples.push(performance.now() - start);
    }
  } finally {
    server.close();
    await once(server, 'close');
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95) - 1];
  assert.ok(p95 < 200, `p95 ${p95.toFixed(1)}ms exceeded 200ms`);
});
