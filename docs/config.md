# The local configuration file

An agent starts from one machine-local file, `~/.config/agent-sop/config.toml`. It names the repositories the agent works from; live governance is resolved afresh to immutable commits for each operation. The router at agentsop.ai never reads this file and never names a repository: this file is the only place one is named.

## Schema

```toml
schema_version = 1

[repos]
org   = "qwts/qwts-agent-org"        # required: current default branch
# sop = "qwts/qwts-agent-sop"        # optional override; normally declared by org.json
comms = "owner/comms-repo@ref"       # optional
```

- `schema_version` — the integer `1`.
- `repos.org` — required. `owner/name` selects the org repository's current default branch (`HEAD`). An explicit `@ref` selects a branch, tag, or full commit SHA, including historical replay. Resolve it once per operation and record the exact commit.
- `repos.sop` — optional. `owner/name` or `owner/name@ref` of the SOP repository. When present it overrides `sources.sop` in `org.json`; when absent, resolve the declared SOP repository's current default branch. A legacy `sources.sop.ref` is a provenance baseline, not the effective live selection.
- `repos.comms` — optional. The communications repository the `comms` zone routes to. Absent: no comms repository is configured, and agents communicate through issues and pull requests only.

The file is written by a person or by the organization's machine-setup tooling, never fetched from the network, and carries no secrets: bot credentials are minted by the agent identity runtime, not stored here.

When the file is absent, the agent follows `https://agentsop.ai/start/llms.txt`: gather from the owner which repositories to use, write the file, then continue. It does not infer an organization from a repository name, a hostname, or a git remote.

## Resolution order

1. **The router.** `https://agentsop.ai/llms.txt` lists the zones; a first visit reads the start zone. The site says what to read; this file says where.
2. **`config.toml`.** Read `~/.config/agent-sop/config.toml` and take `[repos]`.
3. **`org.json`.** Read `org.json` at the root of the org repository at that ref. It gives the organization's identity, the live SOP repository selector, and the capability map — each capability a repository, a 40-hex commit, and an entry file.
4. **The SOP repository.** `repos.sop`, else `sources.sop` from `org.json`: the self-check, then the how-to that governs the task.
5. **Only the capabilities the task needs.** A capability is read at its pinned `ref` starting from its `entry`, and only when a procedure or the task calls for it. Nothing is fetched because it is listed.

A pinned link that returns 404 or requires authentication is a fact to report, not a gap to fill from memory: say which link failed and stop at the step that needed it.


## Migration and freshness

Deploy the runtime that supports live governance before removing
`sources.sop.ref` from a manifest; older runtimes require that field. Schema
version 1 accepts its omission only for `sources.sop`. Capability refs and
other source refs still require full immutable SHAs.

To migrate a frozen local selection, retain a backup and replace
`org = "qwts/qwts-agent-org@<sha>"` with
`org = "qwts/qwts-agent-org"`. Remove a legacy `repos.sop` override when the
organization's declared SOP should govern, or use a bare repository to keep
an override live. Do not rewrite an intentional rollback or historical
selection automatically. Full replay selects both org and SOP SHAs; freezing
only the org still discovers the declared SOP's live head. Run `agent-bot sop --json` and inspect the resolved
org and SOP commits before continuing.

Resolve at task entry and again at each later policy or skill use. All files
within one operation use its resolved SHA, even if a branch advances during
the read. An unavailable remote or invalid manifest fails the dependent
operation; a cached revision is not evidence of current policy. Protected
default branches and review rules establish approval in the selected active
repositories. Archived `agent-org` and `agent-sop` remain templates, not
runtime defaults.

Policy activation, persona activation, and launch snapshots remain explicit:
fresh discovery does not reactivate or authorize them. CLI skill bundles
remain paired with the installed executable. SOP-owned relative skill links
are read from the resolved SOP snapshot; external capability links remain
pinned.
