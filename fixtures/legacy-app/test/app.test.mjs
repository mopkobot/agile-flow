import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from '../src/app.mjs';

// Legacy coverage: happy path only. The limit and empty cases are untested,
// which is why the duplicated rule in handler() diverged unnoticed.

test('greets a name', () => {
  assert.equal(greet('Ada'), 'Hello, Ada!');
});

test('trims surrounding whitespace', () => {
  assert.equal(greet('  Ada  '), 'Hello, Ada!');
});
