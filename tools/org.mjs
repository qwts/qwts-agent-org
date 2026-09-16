#!/usr/bin/env node

// org — validate org.json, the org repository's identity file.
//
//   check   (default)  validate the schema; print every finding; exit 1 on any.
//
// Zero dependencies by design: CI runs it from a bare checkout with no install.
//
// Usage:
//   node tools/org.mjs [check] [--root <dir>] [--org <file>]
//
// A relative --org resolves against --root (default: the current directory),
// and organization.profile resolves against --root as well.

import path from 'node:path';
import process from 'node:process';
import { loadOrg, validateOrgFile } from './lib/org.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), org: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case 'check':
        break;
      case '--root':
        args.root = path.resolve(argv[++i]);
        break;
      case '--org':
        args.org = argv[++i];
        break;
      default:
        throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  args.org = path.resolve(args.root, args.org ?? 'org.json');
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const orgRel = path.relative(args.root, args.org) || 'org.json';
  const errors = validateOrgFile(args.org, { root: args.root });
  if (errors.length > 0) {
    console.error(`${orgRel} has ${errors.length} problem(s):`);
    for (const message of errors) console.error(`  - ${message}`);
    process.exit(1);
  }

  const { org } = loadOrg(args.org);
  const names = Object.keys(org.capabilities);
  const sop = org.sources.sop;
  console.log(
    `${orgRel} valid: organization ${org.organization.id} (account ${org.organization.account}), ` +
      `sop ${sop.repo}@${sop.ref.slice(0, 7)}, ${names.length} capabilit${names.length === 1 ? 'y' : 'ies'}` +
      (names.length ? ` (${names.join(', ')})` : '') +
      '.',
  );
}

main();
