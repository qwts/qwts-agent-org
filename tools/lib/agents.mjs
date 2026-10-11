// Agent-identity roster — load and validate.
//
// `governance/agents.json` is the source of truth for which GitHub App
// identities exist. The organization profile is projected from it and the
// agent identity runtime installs what the profile lists, so registering an
// agent here is what makes it *known*; an App that exists on GitHub but not in
// this file is an App nothing provisions, and the first symptom is a push
// failing on a repository it was never installed on.
//
// Same shape and constraints as the repo manifest (lib/manifest.mjs): stdlib
// only, validator returns problems rather than printing, unknown fields fail
// rather than being ignored.

import { readFileSync } from 'node:fs';

export const VALID_AGENT_STATUS = ['active', 'retired'];
const AGENT_FIELDS = new Set(['slug', 'harness', 'status', 'note']);
const ROSTER_FIELDS = new Set(['account', 'agents', 'settings']);
const DAEMON_PREFERENCES = new Set(['off', 'prefer', 'required']);
// Machine settings the organization profile carries for the runtime
// (agent-bot organization profile `settings`). The runtime validates them again
// against its own schema; this keeps a typo from reaching a published profile.
export const PROFILE_SETTINGS = Object.freeze([
  'spaces_root', 'daemon_preference', 'unmanaged_authors', 'keyd_team_id', 'keyd_identifier',
]);

export function loadAgents(agentsPath) {
  let raw;
  try {
    raw = readFileSync(agentsPath, 'utf8');
  } catch {
    throw new Error(`agent roster not found: ${agentsPath}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`agent roster is not valid JSON (${agentsPath}): ${error.message}`);
  }
}

export function validateAgents(roster) {
  const errors = [];
  if (roster === null || typeof roster !== 'object' || Array.isArray(roster)) {
    return ['agent roster must be a JSON object'];
  }
  for (const field of Object.keys(roster)) {
    // A typo'd top-level key is how a roster silently means less than it says.
    if (!ROSTER_FIELDS.has(field)) errors.push(`roster has unknown field ${JSON.stringify(field)}`);
  }
  if (typeof roster.account !== 'string' || roster.account.trim() === '') {
    errors.push('account must be a non-empty string');
  }
  if (roster.settings !== undefined) errors.push(...validateSettings(roster.settings));
  if (!Array.isArray(roster.agents)) {
    errors.push('agents must be an array');
    return errors;
  }

  const seen = new Set();
  roster.agents.forEach((agent, index) => {
    const where = `agents[${index}]`;
    if (agent === null || typeof agent !== 'object' || Array.isArray(agent)) {
      errors.push(`${where} must be an object`);
      return;
    }
    for (const field of Object.keys(agent)) {
      if (!AGENT_FIELDS.has(field)) errors.push(`${where} has unknown field ${JSON.stringify(field)}`);
    }
    // The slug is a path segment (~/.config/<slug>/) and reaches a shell
    // through the credential helper, so it carries the same restriction the
    // helper enforces rather than a looser one here.
    if (typeof agent.slug !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(agent.slug)) {
      errors.push(`${where}.slug must be a GitHub App slug (letters, digits, inner hyphens)`);
    } else if (seen.has(agent.slug)) {
      errors.push(`${where}.slug duplicates ${JSON.stringify(agent.slug)}`);
    } else {
      seen.add(agent.slug);
    }
    if (typeof agent.harness !== 'string' || agent.harness.trim() === '') {
      errors.push(`${where}.harness must be a non-empty string`);
    }
    if (!VALID_AGENT_STATUS.includes(agent.status)) {
      errors.push(`${where}.status must be one of ${VALID_AGENT_STATUS.join(', ')}`);
    }
    if (agent.note !== undefined && typeof agent.note !== 'string') {
      errors.push(`${where}.note must be a string when present`);
    }
  });
  return errors;
}

function validateSettings(settings) {
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    return ['settings must be an object when present'];
  }
  const errors = [];
  for (const field of Object.keys(settings)) {
    if (!PROFILE_SETTINGS.includes(field)) errors.push(`settings has unknown field ${JSON.stringify(field)}`);
  }
  if (settings.spaces_root !== undefined
    && (typeof settings.spaces_root !== 'string'
      || !settings.spaces_root.startsWith('/')
      || settings.spaces_root.includes('\0'))) {
    errors.push('settings.spaces_root must be an absolute path without NUL bytes');
  }
  if (settings.daemon_preference !== undefined
    && (typeof settings.daemon_preference !== 'string' || !DAEMON_PREFERENCES.has(settings.daemon_preference))) {
    errors.push(`settings.daemon_preference must be one of ${[...DAEMON_PREFERENCES].join(', ')}`);
  }
  if (settings.unmanaged_authors !== undefined) {
    const authors = settings.unmanaged_authors;
    if (!Array.isArray(authors) || authors.length > 64
      || !authors.every((author) => typeof author === 'string' && /^[a-z0-9][a-z0-9._@+-]{0,99}$/.test(author))
      || new Set(authors).size !== authors.length) {
      errors.push('settings.unmanaged_authors must be at most 64 distinct lowercase logins');
    }
  }
  // A profile names one Developer ID team for keyd; it can never loosen the
  // check to any Developer ID (agent-bot-identity#594).
  if (settings.keyd_team_id !== undefined
    && (typeof settings.keyd_team_id !== 'string' || !/^[A-Z0-9]{10}$/.test(settings.keyd_team_id))) {
    errors.push('settings.keyd_team_id must be a 10-character Team ID (A-Z, 0-9)');
  }
  if (settings.keyd_identifier !== undefined
    && (typeof settings.keyd_identifier !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9.-]{0,254}$/.test(settings.keyd_identifier)
      || settings.keyd_identifier === 'any-developer-id')) {
    errors.push('settings.keyd_identifier must be a specific code-signing identifier');
  }
  return errors;
}

// The slugs consumers act on. Retired identities keep their row — the same
// offboarding discipline the repo manifest uses — but nothing installs or
// checks them any more.
export function activeAgentSlugs(roster) {
  return roster.agents.filter((agent) => agent.status === 'active').map((agent) => agent.slug);
}
