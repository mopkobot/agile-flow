import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

async function withServer(fn) {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('returns a greeting for a valid name', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/greet?name=Ada`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Hello, Ada!' });
  });
});

test('rejects a missing name with 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/greet`);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /name is required/);
  });
});

test('rejects an over-long name with 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/greet?name=${'a'.repeat(41)}`);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /name is too long/);
  });
});

test('returns 404 for an unknown path', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/unknown`);
    assert.equal(res.status, 404);
  });
});
