import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { activeAgentSlugs, loadAgents, validateAgents } from '../lib/agents.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function roster(...agents) {
  return { account: 'example', agents };
}
const ok = { slug: 'example-claude-opus-agent', harness: 'claude-code', status: 'active' };

test('the checked-in roster is valid and names at least one identity', () => {
  const checkedIn = loadAgents(join(ROOT, 'governance', 'agents.json'));
  assert.deepEqual(validateAgents(checkedIn), []);
  assert.ok(checkedIn.agents.length > 0);
  assert.ok(activeAgentSlugs(checkedIn).length > 0, 'a roster with no active identity provisions nothing');
});

test('a retired identity keeps its row but stops being active', () => {
  const retired = roster(ok, { slug: 'example-old-agent', harness: 'claude-code', status: 'retired' });
  assert.deepEqual(validateAgents(retired), []);
  assert.deepEqual(activeAgentSlugs(retired), ['example-claude-opus-agent']);
});

test('malformed rosters fail rather than silently shrinking what is provisioned', () => {
  assert.deepEqual(validateAgents([]), ['agent roster must be a JSON object']);
  assert.match(validateAgents(roster({ ...ok, slug: '../escape' }))[0] ?? '', /must be a GitHub App slug/);
  assert.match(validateAgents(roster({ ...ok, slug: 'app;echo-owned' }))[0] ?? '', /must be a GitHub App slug/);
  assert.match(validateAgents(roster(ok, ok))[0] ?? '', /duplicates/);
  assert.match(validateAgents(roster({ ...ok, status: 'paused' }))[0] ?? '', /status must be one of/);
  assert.match(validateAgents(roster({ ...ok, harness: '' }))[0] ?? '', /harness must be a non-empty string/);
  assert.match(validateAgents(roster({ ...ok, typo: true }))[0] ?? '', /unknown field "typo"/);
  assert.match(validateAgents({ account: '', agents: [] })[0] ?? '', /account must be/);
  assert.match(validateAgents({ account: 'example' })[0] ?? '', /agents must be an array/);
  assert.match(validateAgents({ account: 'example', agents: [], extra: 1 })[0] ?? '', /roster has unknown field "extra"/);
});
