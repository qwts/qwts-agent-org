// org.json — load and validate.
//
// `org.json` is the org repository's identity file: who the organization is,
// the SOP instance its agents follow, and the capability map — which
// repository holds each capability, at which commit, and where to start
// reading. Every `ref` is a full commit SHA so nothing an agent resolves from
// here can move underneath it; the only moving pointer is the local
// `config.toml` that names this repository.
//
// Same discipline as the governance validators: stdlib only, the validator
// returns problems rather than printing, and unknown fields fail rather than
// being ignored — a typo'd key is how a file silently means less than it says.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const ORG_SCHEMA_VERSION = 1;
export const TOP_LEVEL_FIELDS = ['schema_version', 'organization', 'sources', 'capabilities'];
export const ORGANIZATION_FIELDS = ['id', 'account', 'profile'];
export const SOURCE_FIELDS = ['repo', 'ref', 'entry', 'summary'];
export const REQUIRED_SOURCES = ['sop'];

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OWNER_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[\w.-]+$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// A path inside a repository: non-empty, relative, forward slashes, and no
// `.`/`..` segments — an entry an agent can append to a raw-file URL.
function isRelativePath(value) {
  if (!isNonEmptyString(value) || value.includes('\\')) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function loadOrg(orgPath) {
  let raw;
  try {
    raw = readFileSync(orgPath, 'utf8');
  } catch {
    throw new Error(`org.json not found: ${orgPath}`);
  }
  try {
    return { raw, org: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`org.json is not valid JSON (${orgPath}): ${error.message}`);
  }
}

// JSON.parse keeps the last of two equal keys, so a capability pasted twice
// would silently replace the first rather than fail. This walks the raw text
// once (it must already be valid JSON) and returns the dotted path of every
// key that repeats inside one object, e.g. `capabilities.ci`.
export function duplicateKeys(raw) {
  const found = [];
  const stack = []; // one frame per open object ({keys, key}) or array (keys: null)
  let pendingString = null;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length && raw[j] !== '"') j += raw[j] === '\\' ? 2 : 1;
      pendingString = JSON.parse(raw.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === '{') {
      stack.push({ keys: new Set(), key: null });
    } else if (ch === '[') {
      stack.push({ keys: null, key: null });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    } else if (ch === ':') {
      const frame = stack[stack.length - 1];
      if (frame?.keys && pendingString !== null) {
        frame.key = pendingString;
        const dotted = stack.filter((f) => f.keys).map((f) => f.key).join('.');
        if (frame.keys.has(pendingString)) found.push(dotted);
        frame.keys.add(pendingString);
      }
    }
    if (ch === '{' || ch === '[' || ch === '}' || ch === ']' || ch === ':' || ch === ',') {
      pendingString = null;
    }
    i += 1;
  }
  return found;
}

function validateEntries(section, entries, errors) {
  for (const [name, entry] of Object.entries(entries)) {
    const where = `${section}.${name}`;
    if (!KEBAB_CASE.test(name)) {
      errors.push(`${section} key ${JSON.stringify(name)} is not kebab-case (lowercase words joined by single hyphens)`);
    }
    if (!isObject(entry)) {
      errors.push(`${where} must be a JSON object with repo, ref, entry, and summary`);
      continue;
    }
    for (const field of Object.keys(entry)) {
      if (!SOURCE_FIELDS.includes(field)) errors.push(`${where} has unknown field ${JSON.stringify(field)}`);
    }
    if (typeof entry.repo !== 'string' || !OWNER_NAME.test(entry.repo)) {
      errors.push(`${where}.repo must be owner/name (got ${JSON.stringify(entry.repo)})`);
    }
    if (typeof entry.ref !== 'string' || !COMMIT_SHA.test(entry.ref)) {
      errors.push(`${where}.ref must be a 40-hex commit SHA (got ${JSON.stringify(entry.ref)})`);
    }
    if (!isRelativePath(entry.entry)) {
      errors.push(`${where}.entry must be a non-empty relative path inside the repository (got ${JSON.stringify(entry.entry)})`);
    }
    if (!isNonEmptyString(entry.summary)) {
      errors.push(`${where}.summary must be a non-empty string`);
    }
  }
}

// Returns an array of human-readable problem strings; empty means valid.
// `root` is the directory `organization.profile` resolves against — the
// repository root, where org.json lives.
export function validateOrg(org, { root = process.cwd() } = {}) {
  const errors = [];
  if (!isObject(org)) return ['org.json must be a JSON object'];

  for (const key of Object.keys(org)) {
    if (!TOP_LEVEL_FIELDS.includes(key)) errors.push(`unknown top-level key ${JSON.stringify(key)}`);
  }
  if (org.schema_version !== ORG_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${ORG_SCHEMA_VERSION} (got ${JSON.stringify(org.schema_version)})`);
  }

  if (!isObject(org.organization)) {
    errors.push('organization must be a JSON object with id, account, and profile');
  } else {
    for (const field of Object.keys(org.organization)) {
      if (!ORGANIZATION_FIELDS.includes(field)) errors.push(`organization has unknown field ${JSON.stringify(field)}`);
    }
    if (!isNonEmptyString(org.organization.id)) errors.push('organization.id must be a non-empty string');
    if (!isNonEmptyString(org.organization.account)) errors.push('organization.account must be a non-empty string');
    const profile = org.organization.profile;
    if (!isRelativePath(profile)) {
      errors.push(`organization.profile must be a non-empty relative path (got ${JSON.stringify(profile)})`);
    } else {
      const abs = path.resolve(root, profile);
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        errors.push(`organization.profile ${JSON.stringify(profile)} does not exist (resolved against ${root})`);
      }
    }
  }

  if (!isObject(org.sources)) {
    errors.push('sources must be a JSON object with at least sop');
  } else {
    for (const required of REQUIRED_SOURCES) {
      if (!Object.hasOwn(org.sources, required)) errors.push(`sources.${required} is required: the SOP instance this org follows`);
    }
    validateEntries('sources', org.sources, errors);
  }

  if (!isObject(org.capabilities)) {
    errors.push('capabilities must be a JSON object keyed by capability name');
  } else {
    validateEntries('capabilities', org.capabilities, errors);
  }

  return errors;
}

// Reads, parses, and validates one file, folding load failures into findings
// so a caller gets every problem the same way. Duplicate keys are judged on
// the raw text because the parsed object has already lost them.
export function validateOrgFile(orgPath, { root = path.dirname(orgPath) } = {}) {
  let loaded;
  try {
    loaded = loadOrg(orgPath);
  } catch (error) {
    return [error.message];
  }
  const errors = duplicateKeys(loaded.raw).map((dotted) => `duplicate key ${JSON.stringify(dotted)} — JSON keeps only the last copy`);
  return [...errors, ...validateOrg(loaded.org, { root })];
}
