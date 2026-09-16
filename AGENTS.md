# AGENTS.md

Canonical, vendor-neutral agent context for this repository, per ENG-0006. The shared working agreement — PR-first, validation before push, commit and PR hygiene, the untrusted-input threat model — is defined once in the [org-wide agent conventions](https://github.com/qwts/agent-sop/blob/main/docs/reference/agent-conventions.md) and applies here without restatement.

## What this repository is

The qwts instance of the agent-org template: `org.json` (identity, the pinned SOP source, the capability map), the fleet's governance data under `governance/`, the validators under `tools/`, and the docs that define the contract. Map: [README.md](README.md).

## What is specific to this repository

- `org.json` is validated by `node tools/org.mjs`: every `ref` is a 40-hex commit SHA, every capability name is kebab-case, and unknown keys fail. Moving a capability to a new commit is a reviewed edit of that one file.
- Editing `governance/repos.json` or `governance/agents.json` requires regenerating the derived files with `node tools/repos.mjs --write`; `npm run check` fails on an un-regenerated edit, and CI runs the same check.
- Docs under `docs/`, `README.md`, and this file pass `npm run lint:markdown` before a PR is opened. `docs-gov.config.json` configures the documentation-governance gate for the shared docs-gov tool; a new doc is linked from `README.md` or its orphan rule fails it.
- No secrets in any file. The profile is the secret-free projection the agent identity runtime consumes; credentials are minted by that runtime.
