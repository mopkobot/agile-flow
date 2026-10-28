import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../src/stack.mjs';

async function project(files) {
  const dir = await mkdtemp(join(tmpdir(), 'af-stack-'));
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body);
  return dir;
}

test('detects java with maven commands', async () => {
  const dir = await project({ 'pom.xml': '<project></project>' });
  const profile = detectStack(dir);
  assert.equal(profile.language, 'java');
  assert.equal(profile.manifest, 'pom.xml');
  assert.equal(profile.test, 'mvn test');
  assert.equal(profile.coverage, 'mvn verify');
  assert.equal(profile.build, 'mvn package -DskipTests');
  assert.match(profile.secretScan, /git grep/);
});

test('detects ruby with bundler commands', async () => {
  const dir = await project({ Gemfile: 'source "https://rubygems.org"\n' });
  const profile = detectStack(dir);
  assert.equal(profile.language, 'ruby');
  assert.equal(profile.test, 'bundle exec rspec');
  assert.equal(profile.lint, 'bundle exec rubocop');
  assert.equal(profile.coverage, null);
});

test('prefers the first matching manifest deterministically', async () => {
  const dir = await project({ 'package.json': '{"scripts":{"test":"node --test"}}', Gemfile: 'x' });
  assert.equal(detectStack(dir).language, 'node');
});

test('java and ruby profiles survive a render and parse round-trip', async () => {
  const { renderProfile, parseProfile } = await import('../src/stack.mjs');
  const dir = await project({ Gemfile: 'x' });
  const profile = detectStack(dir);
  assert.deepEqual(parseProfile(renderProfile(profile)), profile);
});
