import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { duplicateKeys, validateOrg, validateOrgFile } from '../lib/org.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const FIXTURES = path.join(here, 'fixtures', 'org');
const cli = path.join(ROOT, 'tools', 'org.mjs');

function findings(fixture) {
  return validateOrgFile(path.join(FIXTURES, fixture), { root: FIXTURES });
}

// --- pass -----------------------------------------------------------------

test('the checked-in org.json validates clean', () => {
  assert.deepEqual(validateOrgFile(path.join(ROOT, 'org.json'), { root: ROOT }), []);
});

test('the valid fixture validates clean', () => {
  assert.deepEqual(findings('valid.json'), []);
});

test('an empty capability map is valid — the map may be filled in later', () => {
  const org = JSON.parse(readFileSync(path.join(FIXTURES, 'valid.json'), 'utf8'));
  org.capabilities = {};
  assert.deepEqual(validateOrg(org, { root: FIXTURES }), []);
});

// --- each failure class, one fixture apiece --------------------------------

const FAILURES = [
  ['not-an-object.json', /must be a JSON object/],
  ['invalid-json.json', /not valid JSON/],
  ['unknown-top-level-key.json', /unknown top-level key "extra"/],
  ['schema-version.json', /schema_version must be 1 \(got 2\)/],
  ['organization-id.json', /organization\.id must be a non-empty string/],
  ['organization-account.json', /organization\.account must be a non-empty string/],
  ['organization-profile-missing.json', /organization\.profile "governance\/missing\.json" does not exist/],
  ['sop-missing.json', /sources\.sop is required/],
  ['sop-repo.json', /sources\.sop\.repo must be owner\/name/],
  ['sop-ref.json', /sources\.sop\.ref must be a 40-hex commit SHA/],
  ['sop-entry.json', /sources\.sop\.entry must be a non-empty relative path/],
  ['sop-summary.json', /sources\.sop\.summary must be a non-empty string/],
  ['capabilities-not-object.json', /capabilities must be a JSON object/],
  ['capability-name.json', /capabilities key "Agent_Bot" is not kebab-case/],
  ['capability-duplicate.json', /duplicate key "capabilities\.ci"/],
];

for (const [fixture, pattern] of FAILURES) {
  test(`rejects ${fixture}`, () => {
    const errors = findings(fixture);
    assert.ok(
      errors.some((message) => pattern.test(message)),
      `expected ${pattern} among:\n  ${errors.join('\n  ') || '(no findings)'}`,
    );
  });
}

test('every problem in a capability entry is reported in one pass', () => {
  const errors = findings('capability-fields.json');
  assert.match(errors.join('\n'), /capabilities\.ci has unknown field "extra"/);
  assert.match(errors.join('\n'), /capabilities\.ci\.repo must be owner\/name/);
  assert.match(errors.join('\n'), /capabilities\.ci\.ref must be a 40-hex commit SHA/);
  assert.match(errors.join('\n'), /capabilities\.ci\.entry must be a non-empty relative path/);
  assert.match(errors.join('\n'), /capabilities\.ci\.summary must be a non-empty string/);
});

test('a ref must be exactly 40 lowercase hex characters', () => {
  const org = JSON.parse(readFileSync(path.join(FIXTURES, 'valid.json'), 'utf8'));
  for (const bad of ['main', 'v1.2.3', '0'.repeat(39), '0'.repeat(41), 'A'.repeat(40)]) {
    org.sources.sop.ref = bad;
    assert.ok(
      validateOrg(org, { root: FIXTURES }).some((message) => message.includes('sources.sop.ref')),
      `should reject ${JSON.stringify(bad)}`,
    );
  }
});

test('an entry is a path inside the repository — no absolute paths, no parent segments', () => {
  const org = JSON.parse(readFileSync(path.join(FIXTURES, 'valid.json'), 'utf8'));
  for (const bad of ['/README.md', '../README.md', 'docs/../README.md', 'docs/', 'docs\\README.md']) {
    org.sources.sop.entry = bad;
    assert.ok(
      validateOrg(org, { root: FIXTURES }).some((message) => message.includes('sources.sop.entry')),
      `should reject ${JSON.stringify(bad)}`,
    );
  }
});

test('duplicateKeys reports the dotted path of every repeated key and nothing else', () => {
  assert.deepEqual(duplicateKeys('{"a": 1, "b": {"c": 1, "c": 2}, "a": 3}'), ['b.c', 'a']);
  assert.deepEqual(duplicateKeys('{"a": [{"x": 1}, {"x": 2}], "s": "not: a key"}'), []);
  assert.deepEqual(duplicateKeys('{"quote\\"d": 1, "quote\\"d": 2}'), ['quote"d']);
});

// --- CLI --------------------------------------------------------------------

function runCli(args) {
  let exitCode = 0;
  let output = '';
  try {
    output = execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = `${error.stdout}${error.stderr}`;
  }
  return { exitCode, output };
}

test('the CLI passes on this repository and names what it resolved', () => {
  const result = runCli(['--root', ROOT]);
  assert.equal(result.exitCode, 0, result.output);
  assert.match(result.output, /org\.json valid: organization \S+ \(account \S+\), sop \S+@[0-9a-f]{7}/);
});

test('the CLI prints each finding and exits 1 on an invalid file', () => {
  const result = runCli(['check', '--root', FIXTURES, '--org', 'capability-fields.json']);
  assert.equal(result.exitCode, 1);
  assert.match(result.output, /capability-fields\.json has \d+ problem\(s\):/);
  assert.match(result.output, /  - capabilities\.ci\.ref must be a 40-hex commit SHA/);
});

test('the CLI exits 1 when org.json is missing and 2 on an unknown argument', () => {
  assert.equal(runCli(['--root', FIXTURES, '--org', 'nope.json']).exitCode, 1);
  assert.equal(runCli(['--bogus']).exitCode, 2);
});
