# The local configuration file

An agent starts from one machine-local file, `~/.config/agentsop/config.toml`. Its only required key is the pointer to the org repository; everything else an agent needs is pinned by commit SHA inside that repository's `org.json`, so the file has exactly one value that moves.

## Schema

```toml
schema_version = 1

[repos]
org = "qwts/qwts-agent-org@main"   # required: the one moving pointer
# sop = "owner/repo@ref"           # optional override; otherwise the org repo pins it
```

- `schema_version` — the integer `1`.
- `repos.org` — required. `owner/name@ref` of the org repository; `ref` is a branch, tag, or commit SHA. This is the only pointer an agent follows from local state.
- `repos.sop` — optional. `owner/name@ref` of the SOP instance. When present it overrides `sources.sop` in `org.json`; when absent, the org repository pins the SOP.

The file is written by a person or by the organization's machine-setup tooling, never fetched from the network, and carries no secrets: bot credentials are minted by the agent identity runtime, not stored here.

When the file is absent, the agent is working against templates. It says so in any output that depends on organization state, and it does not infer an organization from a repository name, a hostname, or a git remote.

## Resolution order

1. **The router start zone.** Read `https://agentsop.ai/llms.txt`: the zone map and the resolution procedure. Load nothing else from it.
2. **`config.toml`.** Read `~/.config/agentsop/config.toml` and take `repos.org`.
3. **`org.json`.** Read `org.json` at the root of that repository at that ref. It gives the organization's identity, the pinned SOP source, and the capability map — each capability a repository, a 40-hex commit, and an entry file.
4. **The SOP entry.** Read `sources.sop.entry` at the pinned ref (or the `repos.sop` override): the procedures the organization follows.
5. **Only the capabilities the task needs.** A capability is read at its pinned `ref` starting from its `entry`, and only when a procedure or the task calls for it. Nothing is fetched because it is listed.

A pinned link that returns 404 or requires authentication is a fact to report, not a gap to fill from memory: say which link failed and stop at the step that needed it.
