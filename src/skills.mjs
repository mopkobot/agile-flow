import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const REQUIRED_SECTIONS = ['## Inputs', '## Outputs', '## Boundaries', '## Method', '## Refuse'];

export function validateSkill(path) {
  const failures = [];
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, failures: [`unreadable skill: ${path}`] };
  }

  if (!text.startsWith('---\n')) failures.push('missing frontmatter');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (front) {
    const fields = front[1];
    if (!/^name:\s*\S+/m.test(fields)) failures.push('frontmatter missing name');
    if (!/^description:\s*\S+/m.test(fields)) failures.push('frontmatter missing description');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) failures.push(`missing section: ${section}`);
  }

  const boundaries = text.split('## Boundaries')[1];
  if (boundaries) {
    const body = boundaries.split('\n## ')[0];
    if (!/owned_paths:/.test(body)) failures.push('Boundaries missing owned_paths');
    if (!/must_not:/.test(body)) failures.push('Boundaries missing must_not');
  }

  return { ok: failures.length === 0, failures };
}

export function validateSkillTree(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { ok: false, failures: [`skills directory not found: ${dir}`] };
  }
  const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  if (dirs.length === 0) return { ok: false, failures: ['skills directory has no skills'] };
  const failures = [];
  for (const entry of dirs) {
    const path = join(dir, entry.name, 'SKILL.md');
    try {
      statSync(path);
    } catch {
      failures.push(`${entry.name}: missing SKILL.md`);
      continue;
    }
    const result = validateSkill(path);
    for (const failure of result.failures) failures.push(`${entry.name}: ${failure}`);
  }
  return { ok: failures.length === 0, failures };
}
