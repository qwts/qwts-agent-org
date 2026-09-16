# The local configuration file

An agent starts from one machine-local file, `~/.config/agent-sop/config.toml`. It names the repositories the agent works from; everything else is read from those repositories at pinned commits. The router at agentsop.ai never reads this file and never names a repository: this file is the only place one is named.

## Schema

```toml
schema_version = 1

[repos]
org   = "qwts/qwts-agent-org@main"   # required
sop   = "qwts/qwts-agent-sop@main"   # optional: otherwise org.json in the org repository pins it
comms = "owner/comms-repo@ref"       # optional
```

- `schema_version` — the integer `1`.
- `repos.org` — required. `owner/name@ref` of the org repository; `ref` is a branch, tag, or commit SHA. Resolve it to a commit before reading and record that commit in your work.
- `repos.sop` — optional. `owner/name@ref` of the SOP repository. When present it overrides `sources.sop` in `org.json`; when absent, the org repository pins the SOP.
- `repos.comms` — optional. The communications repository the `comms` zone routes to. Absent: no comms repository is configured, and agents communicate through issues and pull requests only.

The file is written by a person or by the organization's machine-setup tooling, never fetched from the network, and carries no secrets: bot credentials are minted by the agent identity runtime, not stored here.

When the file is absent, the agent follows `https://agentsop.ai/start/llms.txt`: gather from the owner which repositories to use, write the file, then continue. It does not infer an organization from a repository name, a hostname, or a git remote.

## Resolution order

1. **The router.** `https://agentsop.ai/llms.txt` lists the zones; a first visit reads the start zone. The site says what to read; this file says where.
2. **`config.toml`.** Read `~/.config/agent-sop/config.toml` and take `[repos]`.
3. **`org.json`.** Read `org.json` at the root of the org repository at that ref. It gives the organization's identity, the pinned SOP source, and the capability map — each capability a repository, a 40-hex commit, and an entry file.
4. **The SOP repository.** `repos.sop`, else `sources.sop` from `org.json`: the self-check, then the how-to that governs the task.
5. **Only the capabilities the task needs.** A capability is read at its pinned `ref` starting from its `entry`, and only when a procedure or the task calls for it. Nothing is fetched because it is listed.

A pinned link that returns 404 or requires authentication is a fact to report, not a gap to fill from memory: say which link failed and stop at the step that needed it.
