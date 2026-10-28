import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir, loadState, saveState } from './state.mjs';

export const STATUS_LABELS = {
  ready: 'status:ready',
  'in-dev': 'status:in-dev',
  'in-qa': 'status:in-qa',
  done: 'status:done',
};

export class TrackerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrackerError';
  }
}

export function storyTitle(markdown) {
  const line = markdown.split('\n').find((l) => /^#\s+/.test(l));
  if (!line) return null;
  return line.replace(/^#\s+/, '').replace(/^[A-Z]+-\d+\s+/, '').trim();
}

export async function syncGitHub(root, { dryRun = false, env = process.env, print = console.log } = {}) {
  const state = await loadState(root);
  const stories = Object.entries(state.stories ?? {}).filter(([, s]) => s.dor === 'pass');
  if (stories.length === 0) {
    print('tracker: no ready stories to sync');
    return { synced: 0 };
  }

  const run = (args) => {
    if (dryRun) {
      print(`gh ${args.join(' ')}`);
      return '';
    }
    try {
      return execFileSync('gh', args, { encoding: 'utf8', env });
    } catch (err) {
      throw new TrackerError(`gh ${args[0]} failed: ${err.message.split('\n')[0]}`);
    }
  };

  let synced = 0;
  for (const [id, story] of stories) {
    const storyPath = join(agileDir(root), 'stories', `${id}.md`);
    const markdown = await readFile(storyPath, 'utf8').catch(() => '');
    const title = storyTitle(markdown) ?? id;

    let issue = story.issue ?? null;
    if (!issue) {
      const listed = run(['issue', 'list', '--search', `${id} in:title`, '--json', 'number,title', '--limit', '10']);
      if (!dryRun) {
        const issues = JSON.parse(listed || '[]');
        const found = issues.find((i) => String(i.title).startsWith(id));
        issue = found?.number ?? null;
      }
      if (!issue) {
        const url = run(['issue', 'create', '--title', `${id} ${title}`, '--body-file', storyPath]);
        if (!dryRun) {
          const match = String(url).trim().match(/(\d+)\s*$/);
          if (!match) throw new TrackerError(`could not read an issue number from: ${url}`);
          issue = Number(match[1]);
        }
      }
    }

    const label = STATUS_LABELS[story.status ?? 'ready'];
    run(['issue', 'edit', String(issue ?? '<number>'), '--add-label', label]);

    if (!dryRun) {
      state.stories[id].issue = issue;
      synced += 1;
    }
    print(`${id} -> issue ${issue ?? '(new)'} label ${label}`);
  }

  if (!dryRun) {
    state.tracker = { provider: 'github', syncedAt: new Date().toISOString() };
    await saveState(root, state);
  }
  return { synced };
}
