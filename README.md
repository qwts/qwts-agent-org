# qwts-agent-org

The qwts instance of [agent-org](https://github.com/qwts/agent-org), the template for an organization's org repository. This is the one place that says who qwts is, which SOP instance its agents follow (`qwts/qwts-agent-sop`), and which repositories hold each capability the fleet relies on — every one pinned to a commit in `org.json`. The tooling, docs, CI, and metadata are the template's, unchanged; the data in `org.json` and under `governance/` is real. Created from the template at its first commit; the governance data moved here verbatim from `qwts/agent-sop` at commit `ed5c5d8f7aadba6eefa41a7fd17b076601530848` under qwts/agent-sop#371 and qwts/agent-sop#372.

## The contract

| File | What it holds | Read by |
| --- | --- | --- |
| `org.json` | Identity, the pinned SOP source, and the capability map | Agents resolving the organization; `tools/org.mjs` validates it |
| `governance/repos.json` | The manifest of governed repositories | `tools/repos.mjs`, which also renders the table in `docs/governed-repos.md` |
| `governance/agents.json` | The GitHub App roster: one row per agent identity | `tools/organization-profile.mjs`, which projects it into the profile |
| `governance/organization-profile.json` | The secret-free projection the agent identity runtime bootstraps machines from | `agent-bot bootstrap --profile`, fetched by managed-machine |

Capability repositories have no pointers or subdomains of their own: a name such as `agent-bot` or `aca` resolves through `org.json` to a repository, a commit, and an entry file. Moving a capability is a reviewed edit of one file. `npm run check` validates all four files and the derived table (`node tools/org.mjs`, `node tools/repos.mjs check`, `node tools/organization-profile.mjs`); `npm test` runs the validators' tests; CI runs both plus `npm run lint:markdown` on every pull request. Editing the manifest or the roster is followed by `node tools/repos.mjs --write`, which regenerates the table and the profile together.

## Documents

- [The local configuration file](docs/config.md) — the `config.toml` an agent starts from, and the resolution order it follows.
- [The governed-repos manifest](docs/manifest.md) — the schema and rules of `governance/repos.json`.
- [Governed repositories](docs/governed-repos.md) — the fleet, generated from the manifest by `tools/repos.mjs`.
- [GitHub account](docs/github-account.md) — the account tier the fleet lives under and what depends on it.
- [Agent bot organization operations](docs/agent-bot-operations.md) — registering, verifying, and handling incidents around the agent Apps in the roster; moved here from agent-sop.
- [Agent onboarding and standing operating conventions](docs/onboarding.md) — first-time setup for a new harness or machine and the standing operating conventions every agent follows.
- [AGENTS.md](AGENTS.md) — agent context for this repository.

## Runtime model

| Surface | What it governs | Canonical home |
| --- | --- | --- |
| Soul model | One long-lived soul per agent, package `AGENTS.md` as standing instructions, task worktrees linked and pinned to the soul (`agentBot.agentId`), dream as owner-gated consolidation, and retirement of task-scoped souls after merge (`soul remove`) | [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity) ([soul packages](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-package.md), [joining](https://github.com/qwts/agent-bot-identity/blob/main/docs/joining.md), [soul homes](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-homes.md), [dream maintenance](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-skill-dream-design.md)) |
| GitHub App identity and `gh` shim | Per-harness GitHub App roster, `pass-cli` credential provisioning (`ensure-private-key`), `GH_AGENT_APP` token minting, Web-Flow verified commits (`signed-commit`), and the fail-closed `gh` shim | [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity), [Agent bot organization operations](docs/agent-bot-operations.md), and [Agent onboarding and standing operating conventions](docs/onboarding.md) |
| CI policy | `ci-policy` gate, required status checks, bounded commands, and release lifecycles across governed repositories | [`qwts/qwts-agent-ci`](https://github.com/qwts/qwts-agent-ci) |
| Machine setup | Self-tapped Homebrew formula, catalog app provisioning, and local machine setup | [`qwts/managed-machine`](https://github.com/qwts/managed-machine) |

## Pending

`org.json` maps seven capabilities, each pinned to a commit: `agent-bot` (`qwts/agent-bot-identity`), `managed-machine` (`qwts/managed-machine`), `aca` (`qwts/agentic-code-analysis`), `ci` (`qwts/qwts-agent-ci`), `docs-gov` (`qwts/qwts-agent-docs-gov`), `inventory` (`qwts/qwts-agent-inventory`), and `sdlc` (`qwts/qwts-agent-sdlc`). Moving a pin is a reviewed change to this file.
