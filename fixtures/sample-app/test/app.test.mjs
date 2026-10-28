import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from '../src/app.mjs';

test('greets a name', () => {
  assert.equal(greet('Ada'), 'Hello, Ada!');
});

test('trims surrounding whitespace', () => {
  assert.equal(greet('  Ada  '), 'Hello, Ada!');
});

test('rejects an empty name', () => {
  assert.throws(() => greet('   '), /name is required/);
});

test('rejects a name over 40 characters', () => {
  assert.throws(() => greet('a'.repeat(41)), /name is too long/);
});
