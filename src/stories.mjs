import { loadState, saveState } from './state.mjs';

export const STORY_STATUSES = ['ready', 'in-dev', 'in-qa', 'done'];

const ROLE_FOR_STATUS = {
  'in-dev': 'dev',
  'in-qa': 'qa',
  done: 'flow',
};

const REQUIRED_PREVIOUS = {
  'in-dev': ['ready', 'in-dev'],
  'in-qa': ['in-dev', 'in-qa'],
  done: ['in-qa', 'done'],
};

export class StoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoryError';
  }
}

export async function setStoryStatus(root, id, status, role, agent = null) {
  if (!STORY_STATUSES.includes(status)) throw new StoryError(`unknown status: ${status}`);
  const expectedRole = ROLE_FOR_STATUS[status];
  if (!expectedRole) throw new StoryError(`status needs no role: ${status}`);
  if (role !== expectedRole && !(status === 'done' && role === 'po')) {
    throw new StoryError(`${status} must be set by the ${expectedRole} role, not ${role}`);
  }

  const state = await loadState(root);
  const story = state.stories?.[id];
  if (!story) throw new StoryError(`unknown story: ${id}`);
  if (story.dor !== 'pass') throw new StoryError(`story ${id} has not passed DoR`);

  const previous = story.status ?? 'ready';
  if (!REQUIRED_PREVIOUS[status].includes(previous)) {
    throw new StoryError(`${id} cannot move from ${previous} to ${status}`);
  }

  if (previous === status) return state.stories[id];

  story.status = status;
  story.owner = agent ?? role;
  story.updatedAt = new Date().toISOString();
  story.history = [...(story.history ?? []), { status, role, agent: story.owner, at: story.updatedAt }];
  await saveState(root, state);
  return story;
}
