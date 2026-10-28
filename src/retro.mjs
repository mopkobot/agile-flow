import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agileDir } from './state.mjs';

const TYPES = ['process', 'product', 'debt', 'dropped'];
const FLOW_SKILLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

function cells(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

export async function parseRetroActions(root, sprint) {
  const nn = String(sprint).padStart(2, '0');
  const path = join(agileDir(root), 'retro', `retro-${nn}.md`);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return null;
  }
  const section = text.split('## Actions')[1] ?? '';
  const rows = section.split('\n').filter((l) => l.trim().startsWith('|'));
  const body = rows.filter((l) => !/^\|\s*-/.test(l)).slice(1);
  return body.map((line) => {
    const [action, type, target, owner, due] = cells(line);
    return { action, type, target, owner, due };
  });
}

export async function checkRetroActions(root, sprint) {
  const actions = await parseRetroActions(root, sprint);
  if (actions === null) return [`no retro file for sprint ${sprint}`];
  if (actions.length === 0) return ['retro has no actions table rows'];

  const failures = [];
  const backlog = await readFile(join(agileDir(root), 'backlog.md'), 'utf8').catch(() => '');
  const debt = await readFile(join(agileDir(root), 'architecture/debt.md'), 'utf8').catch(() => '');

  for (const action of actions) {
    if (!TYPES.includes(action.type)) {
      failures.push(`action "${action.action}" has unknown type "${action.type}"`);
      continue;
    }
    if (!action.owner) failures.push(`action "${action.action}" names no owner`);
    if (action.type === 'process') {
      if (!existsSync(join(FLOW_SKILLS, action.target, 'SKILL.md'))) {
        failures.push(`process action "${action.action}" targets unknown skill "${action.target}"`);
      }
    }
    if (action.type === 'product') {
      if (!action.target || !backlog.includes(action.target)) {
        failures.push(`product action "${action.action}" names no card in docs/agile/backlog.md (target "${action.target}")`);
      }
    }
    if (action.type === 'debt') {
      if (!action.target || !debt.includes(action.target)) {
        failures.push(`debt action "${action.action}" names no row in docs/agile/architecture/debt.md (target "${action.target}")`);
      }
    }
    if (action.type === 'dropped' && !/reason/i.test(action.action)) {
      failures.push(`dropped action "${action.action}" needs a reason in the action text`);
    }
  }
  return failures;
}
