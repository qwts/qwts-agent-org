# The governed-repos manifest

`governance/repos.json` is the single source of truth for which repositories an organization governs. [governed-repos.md](governed-repos.md) is its human-readable view: the table there is generated from the manifest by `tools/repos.mjs` and gated in CI, so the list cannot drift from the machine-readable record.

## How scope works

Governance is inherit-by-default: a repository under the organization's account follows the shared baselines the moment it exists — silence means baseline, not exemption. The manifest does not change that. It is a *registry* of the governed universe with per-repo metadata (visibility, shared-CI adoption, and each repo's recorded delta), not an allowlist a repo must appear in to be governed. A new repository is governed on day one; the rule the manifest adds is that it must also be *recorded*, so the set is knowable in one place.

Removing a repo is therefore an act of offboarding, not deletion: a repo that leaves the account or is retired keeps its row with `status: retired`, so the record of what was once governed survives.

## How to add or remove a repo

Every operation is a manifest edit followed by a regenerate. Never edit the generated table by hand.

1. **Edit** `governance/repos.json`:
   - **Onboard** — add a repo object with `status: "onboarding"` while it aligns to the baselines, then flip it to `"active"` once it conforms.
   - **Offboard** — flip the repo's `status` to `"retired"`; do not remove the row.
   - **Record a variance** — put the one-line difference in the repo's `delta`.
2. **Regenerate** the table: `node tools/repos.mjs --write`. The same command rewrites `governance/organization-profile.json` from the agent roster, so the two derived files never diverge.
3. **Verify**: `node tools/repos.mjs check` passes (CI runs the same check; an un-regenerated edit fails it).
4. **Commit** the manifest and the regenerated files together in the same PR.

## Schema

The manifest is a JSON object with two fields:

- `account` — the GitHub account or organization that owns the repositories; a non-empty string.
- `repos` — an array of repo objects, rendered in array order.

Each repo object carries:

- `name` — the repository name under the account: a GitHub slug (`[\w.-]+`), unique case-insensitively.
- `visibility` — `public` or `private`.
- `status` — `active`, `onboarding`, or `retired`.
- `sharedCi` — boolean; whether the repo consumes the organization's reusable CI workflows.
- `publish` — optional boolean. Only the boolean `true` opts a repo into a public dashboard; absent means unpublished. A string `"true"` or a `1` is rejected rather than silently withholding the repo.
- `codexSync` — optional; exceptions to a harness user-directory primitive (the field keeps its original name). `enabled: false` skips the repository. `exclude` lists paths the sync leaves alone: non-empty strings, no duplicates. `preserveJsonArrayEntries` is an additional hook inside a JSON file, used only when a named harness cannot read that primitive from its user directory. Keys are `.json` paths that are not also excluded. Values are non-empty arrays of unique, non-empty marker strings. The entry does not replace the user-level hook and does not win when the two disagree. [ENG-0384](https://github.com/qwts/qwts-agent-sop/blob/b65bb85023050fb295830faf6f35ac8764ddd874/docs/decisions/ENG-0384-harness-config-lives-in-the-user-directory.md) is the decision. This manifest does not decide which paths are managed, and it does not distribute files into repositories.
- `delta` — optional string; the one-line variance this repo carries from the shared baseline, or empty for a pure consumer.
- `note` — optional string; free-text context, kept out of the generated table.

The validator reports every problem it finds in one pass and exits 1 on any; the exact rules are in `tools/lib/manifest.mjs`.
