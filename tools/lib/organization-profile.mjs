// Secret-free organization profile projection (agent-bot profile schema v1).
//
// `governance/agents.json` remains the roster source of truth. This module
// projects it into the document cold-start `agent-bot bootstrap --profile`
// consumes. This repository never imports agent-bot-identity modules
// (ENG-0128); the runtime validates the same JSON against its own schema.
//
// Harness names in the roster are governance vocabulary (`claude-code`).
// The profile uses the runtime vocabulary (`claude`). The default App for
// each active harness is `{account}-{profileHarness}-agent` — the unpinned
// harness-level identity. Model-specific rows stay in `identities` so
// credentials reconcile; they do not invent model-id arrays.
//
// The organization label is the one profile field the roster does not carry.
// It lives in the published profile itself: a check reads it from there and a
// write keeps it, so an instance's label survives regeneration without a
// hardcoded constant in the tooling. A first write, with no profile on disk,
// takes the account name.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadAgents, validateAgents } from './agents.mjs';

export const ORGANIZATION_PROFILE_SCHEMA_VERSION = 1;
export const RUNTIME_PROFILE_INTERFACE_VERSION = 1;

export const PROFILE_HARNESS_BY_ROSTER = Object.freeze({
  'claude-code': 'claude',
  codex: 'codex',
  copilot: 'copilot',
  cursor: 'cursor',
  devin: 'devin',
  muse: 'muse',
  vscode: 'vscode',
  antigravity: 'antigravity',
  cline: 'cline',
  deepseek: 'deepseek',
  'factory-droid': 'droid',
  goose: 'goose',
  grok: 'grok',
  hermes: 'hermes',
  kiro: 'kiro',
  opencode: 'opencode',
  pi: 'pi',
  'qwen-code': 'qwen',
  warp: 'warp',
  zcode: 'zcode',
  amp: 'amp',
  aider: 'aider',
});

export function defaultSlugFor(account, profileHarness) {
  return `${account}-${profileHarness}-agent`;
}

export function projectOrganizationProfile(roster, { organization } = {}) {
  const rosterErrors = validateAgents(roster);
  if (rosterErrors.length > 0) {
    throw new Error(`agent roster is invalid:\n  - ${rosterErrors.join('\n  - ')}`);
  }
  if (roster.agents.length === 0) {
    throw new Error('organization profile requires at least one roster identity');
  }
  const label = organization ?? roster.account;
  if (typeof label !== 'string' || label.trim() === '') {
    throw new Error('organization profile organization label must be a non-empty string');
  }

  const identities = roster.agents.map((agent) => {
    const harness = PROFILE_HARNESS_BY_ROSTER[agent.harness];
    if (!harness) {
      throw new Error(`organization profile has no runtime harness for roster harness ${JSON.stringify(agent.harness)}`);
    }
    return {
      slug: agent.slug,
      harness,
      status: agent.status,
    };
  }).sort((left, right) => left.slug.localeCompare(right.slug));

  const defaults = {};
  const activeHarnesses = new Set(
    identities.filter((identity) => identity.status === 'active').map((identity) => identity.harness),
  );
  for (const harness of [...activeHarnesses].sort()) {
    const slug = defaultSlugFor(roster.account, harness);
    const identity = identities.find((row) => row.slug === slug);
    if (!identity || identity.harness !== harness || identity.status !== 'active') {
      throw new Error(
        `organization profile default ${JSON.stringify(slug)} is missing or not an active ${harness} identity`,
      );
    }
    defaults[harness] = slug;
  }

  return {
    schema_version: ORGANIZATION_PROFILE_SCHEMA_VERSION,
    organization: label,
    account_owner: roster.account,
    minimum_runtime_interface_version: RUNTIME_PROFILE_INTERFACE_VERSION,
    defaults,
    identities,
  };
}

export function renderOrganizationProfile(profile) {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

export function loadOrganizationProfile(profilePath) {
  let raw;
  try {
    raw = readFileSync(profilePath, 'utf8');
  } catch {
    throw new Error(`organization profile not found: ${profilePath}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`organization profile is not valid JSON (${profilePath}): ${error.message}`);
  }
}

// The organization label the published profile carries, or undefined when
// there is no usable profile on disk yet (absent, unreadable, or not JSON —
// each of which a check reports on its own and a write repairs).
export function publishedOrganizationLabel(profilePath) {
  if (!existsSync(profilePath)) return undefined;
  let profile;
  try {
    profile = loadOrganizationProfile(profilePath);
  } catch {
    return undefined;
  }
  const label = profile?.organization;
  return typeof label === 'string' && label.trim() !== '' ? label : undefined;
}

export function profileFromAgentsPath(agentsPath, options) {
  return projectOrganizationProfile(loadAgents(agentsPath), options);
}

// What the published profile must equal: the roster projected under the label
// the profile already carries.
export function expectedProfileFor(agentsPath, profilePath) {
  return profileFromAgentsPath(agentsPath, { organization: publishedOrganizationLabel(profilePath) });
}

export function writeOrganizationProfile(profilePath, profile) {
  writeFileSync(profilePath, renderOrganizationProfile(profile));
}

export function profilesMatch(actual, expected) {
  return renderOrganizationProfile(actual) === renderOrganizationProfile(expected);
}
