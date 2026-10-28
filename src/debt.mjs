import { loadState, saveState } from './state.mjs';

export const SIZE_WEIGHT = { small: 1, medium: 2, large: 3 };

export class DebtError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DebtError';
  }
}

export function parsePercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new DebtError('debt allocation must be a number between 0 and 100');
  }
  return Math.round(percent);
}

export async function setDebtAllocation(root, percent, setBy = 'human') {
  const state = await loadState(root);
  state.debtAllocation = {
    percent: parsePercent(percent),
    setBy,
    at: new Date().toISOString(),
  };
  await saveState(root, state);
  return state.debtAllocation;
}

function section(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return null;
  const after = text.slice(start + heading.length);
  const next = after.search(/\n## /);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

export function checkDebtAllocation(planText, requiredPercent) {
  const failures = [];
  const debtSection = section(planText, '## Debt allocation');
  if (debtSection === null) {
    return ['sprint plan has no "## Debt allocation" section'];
  }

  const declared = debtSection.match(/percent:\s*(\d+(?:\.\d+)?)/);
  if (!declared) {
    failures.push('debt allocation section declares no percent');
  } else if (Number(declared[1]) !== requiredPercent) {
    failures.push(`declared debt allocation ${declared[1]}% does not match the configured ${requiredPercent}%`);
  }

  const rows = debtSection.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
  const body = rows.slice(1);
  if (body.length === 0) {
    failures.push('debt allocation table lists no stories');
    return failures;
  }

  let total = 0;
  let debt = 0;
  for (const row of body) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    const [id, size, isDebt] = cells;
    const weight = SIZE_WEIGHT[size];
    if (!weight) {
      failures.push(`story ${id || '?'} has unknown size "${size}"`);
      continue;
    }
    total += weight;
    if (/^yes$/i.test(isDebt)) debt += weight;
  }

  if (total === 0) {
    failures.push('debt allocation table has no weighted stories');
    return failures;
  }
  const share = (debt / total) * 100;
  if (share + 0.001 < requiredPercent) {
    failures.push(`debt share is ${share.toFixed(0)}%, below the allocated ${requiredPercent}%`);
  }
  return failures;
}
