import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAgents } from '../lib/agents.mjs';
import {
  PROFILE_HARNESS_BY_ROSTER,
  defaultSlugFor,
  expectedProfileFor,
  projectOrganizationProfile,
  publishedOrganizationLabel,
  renderOrganizationProfile,
} from '../lib/organization-profile.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = path.join(ROOT, 'tools', 'organization-profile.mjs');
const AGENTS = path.join(ROOT, 'governance', 'agents.json');
const PROFILE = path.join(ROOT, 'governance', 'organization-profile.json');

function roster(...agents) {
  return { account: 'example', agents };
}

const claudeDefault = {
  slug: 'example-claude-agent',
  harness: 'claude-code',
  status: 'active',
};
const claudeModel = {
  slug: 'example-claude-opus-agent',
  harness: 'claude-code',
  status: 'active',
};

test('the checked-in profile is the projection of the roster', () => {
  const expected = expectedProfileFor(AGENTS, PROFILE);
  const actual = JSON.parse(readFileSync(PROFILE, 'utf8'));
  assert.equal(renderOrganizationProfile(actual), renderOrganizationProfile(expected));
});

test('every roster slug appears, notes are stripped, and roster harnesses become runtime harnesses', () => {
  const agents = loadAgents(AGENTS);
  const profile = projectOrganizationProfile(agents);
  assert.equal(profile.schema_version, 1);
  assert.equal(profile.organization, agents.account);
  assert.equal(profile.account_owner, agents.account);
  assert.equal(profile.minimum_runtime_interface_version, 1);
  assert.deepEqual(
    profile.identities.map((identity) => identity.slug).sort(),
    agents.agents.map((agent) => agent.slug).sort(),
  );
  assert.ok(profile.identities.every((identity) => identity.note === undefined));
  for (const agent of agents.agents) {
    const identity = profile.identities.find((row) => row.slug === agent.slug);
    assert.equal(identity.harness, PROFILE_HARNESS_BY_ROSTER[agent.harness]);
    assert.equal(identity.status, agent.status);
  }
  const activeHarnesses = new Set(
    agents.agents.filter((agent) => agent.status === 'active').map((agent) => PROFILE_HARNESS_BY_ROSTER[agent.harness]),
  );
  assert.deepEqual(Object.keys(profile.defaults).sort(), [...activeHarnesses].sort());
  for (const [harness, slug] of Object.entries(profile.defaults)) {
    assert.equal(slug, defaultSlugFor(agents.account, harness));
  }
});

test('the default App is account-harness-agent and must be an active matching identity', () => {
  assert.equal(defaultSlugFor('example', 'claude'), 'example-claude-agent');
  const profile = projectOrganizationProfile(roster(claudeDefault, claudeModel));
  assert.deepEqual(profile.defaults, { claude: 'example-claude-agent' });
  assert.throws(
    () => projectOrganizationProfile(roster(claudeModel)),
    /example-claude-agent/,
  );
});

test('retired identities stay in the profile and do not become defaults', () => {
  const profile = projectOrganizationProfile(roster(
    claudeDefault,
    { slug: 'example-old-agent', harness: 'claude-code', status: 'retired' },
  ));
  assert.deepEqual(profile.defaults, { claude: 'example-claude-agent' });
  assert.ok(profile.identities.some((identity) => identity.slug === 'example-old-agent' && identity.status === 'retired'));
});

test('unknown roster harnesses and empty rosters fail closed', () => {
  assert.throws(
    () => projectOrganizationProfile(roster({ slug: 'example-windsurf-agent', harness: 'windsurf', status: 'active' })),
    /no runtime harness/,
  );
  assert.throws(
    () => projectOrganizationProfile(roster()),
    /at least one roster identity/,
  );
});

test('the organization label defaults to the account and otherwise is the caller\'s', () => {
  assert.equal(projectOrganizationProfile(roster(claudeDefault)).organization, 'example');
  assert.equal(
    projectOrganizationProfile(roster(claudeDefault), { organization: 'example-engineering' }).organization,
    'example-engineering',
  );
  assert.throws(
    () => projectOrganizationProfile(roster(claudeDefault), { organization: ' ' }),
    /organization label must be a non-empty string/,
  );
});

function scaffold(agents) {
  const root = mkdtempSync(path.join(tmpdir(), 'org-profile-'));
  mkdirSync(path.join(root, 'governance'), { recursive: true });
  writeFileSync(path.join(root, 'governance', 'agents.json'), JSON.stringify({ account: 'example', agents }, null, 2));
  return root;
}

function runCli(root, args = []) {
  let exitCode = 0;
  let output = '';
  try {
    output = execFileSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = `${error.stdout}${error.stderr}`;
  }
  return { exitCode, output };
}

test('the published label is read from the profile on disk and is undefined until one exists', () => {
  const root = scaffold([claudeDefault]);
  const profilePath = path.join(root, 'governance', 'organization-profile.json');
  assert.equal(publishedOrganizationLabel(profilePath), undefined);
  writeFileSync(profilePath, 'not json\n');
  assert.equal(publishedOrganizationLabel(profilePath), undefined);
  writeFileSync(profilePath, JSON.stringify({ organization: 'example-engineering' }));
  assert.equal(publishedOrganizationLabel(profilePath), 'example-engineering');
  rmSync(root, { recursive: true, force: true });
});

test('check fails until --write, then matches the roster and keeps the label across rewrites', () => {
  const root = scaffold([claudeDefault]);
  const profilePath = path.join(root, 'governance', 'organization-profile.json');
  const missing = runCli(root, ['check']);
  assert.equal(missing.exitCode, 1);
  assert.match(missing.output, /organization profile not found/);

  const written = runCli(root, ['--write']);
  assert.equal(written.exitCode, 0);

  const fresh = runCli(root, ['check']);
  assert.equal(fresh.exitCode, 0);
  assert.match(fresh.output, /matches .* \(1 identities, 1 defaults, organization example\)/);
  const published = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(published.defaults.claude, 'example-claude-agent');
  assert.equal(published.organization, 'example');

  // The label is the profile's own field: renaming it is not drift, and a
  // rewrite carries it forward.
  writeFileSync(profilePath, JSON.stringify({ ...published, organization: 'example-engineering' }, null, 2) + '\n');
  assert.equal(runCli(root, ['check']).exitCode, 0);
  assert.equal(runCli(root, ['--write']).exitCode, 0);
  assert.equal(JSON.parse(readFileSync(profilePath, 'utf8')).organization, 'example-engineering');

  writeFileSync(profilePath, '{}\n');
  const stale = runCli(root, ['check']);
  assert.equal(stale.exitCode, 1);
  assert.match(stale.output, /out of date/);
  rmSync(root, { recursive: true, force: true });
});
