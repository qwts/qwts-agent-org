# qwts-agent-org

The qwts instance of [agent-org](https://github.com/qwts/agent-org), the template for an organization's org repository. This is the one place that says who qwts is, which SOP instance its agents follow (`qwts/qwts-agent-sop`), and which repositories hold pinned shared capabilities in `org.json`, with live SOP discovery and installed runtime bundles. The tooling and documentation include the live-governance delta; the data in `org.json` and under `governance/` is real. Created from the template at its first commit; the governance data moved here verbatim from `qwts/agent-sop` at commit `ed5c5d8f7aadba6eefa41a7fd17b076601530848` under qwts/agent-sop#371 and qwts/agent-sop#372.

## The contract

| File | What it holds | Read by |
| --- | --- | --- |
| `org.json` | Identity, the live SOP source, and the capability map | Agents resolving the organization; `tools/org.mjs` validates it |
| `governance/repos.json` | The manifest of governed repositories | `tools/repos.mjs`, which also renders the table in `docs/governed-repos.md` |
| `governance/agents.json` | The GitHub App roster: one row per agent identity | `tools/organization-profile.mjs`, which projects it into the profile |
| `governance/organization-profile.json` | The secret-free projection the agent identity runtime bootstraps machines from | `agent-bot bootstrap --profile`, fetched by managed-machine |

Capability repositories have no pointers or subdomains of their own: a name such as `ci` or `docs-gov` resolves through `org.json` to a repository, a commit, and an entry file. Moving a capability is a reviewed edit of one file. `npm run check` validates all four files and the derived table (`node tools/org.mjs`, `node tools/repos.mjs check`, `node tools/organization-profile.mjs`); `npm test` runs the validators' tests; CI runs both plus `npm run lint:markdown` on every pull request. Editing the manifest or the roster is followed by `node tools/repos.mjs --write`, which regenerates the table and the profile together.

## Documents

- [The local configuration file](docs/config.md) — the `config.toml` an agent starts from, and the resolution order it follows.
- [The governed-repos manifest](docs/manifest.md) — the schema and rules of `governance/repos.json`.
- [Governed repositories](docs/governed-repos.md) — the fleet, generated from the manifest by `tools/repos.mjs`.
- [GitHub account](docs/github-account.md) — the account tier the fleet lives under and what depends on it.
- [Agent bot organization operations](docs/agent-bot-operations.md) — registering, verifying, and handling incidents around the agent Apps in the roster; moved here from agent-sop.
- [Agent onboarding and standing operating conventions](docs/onboarding.md) — first-time setup for a new harness or machine and the standing operating conventions every agent follows.
- [AGENTS.md](AGENTS.md) — agent context for this repository.

## Runtime model

- **Host:** GeniusBar.
- **Composition:** [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity) (the identity runtime: GitHub App identities, tokens, hooks, and the `gh` shim), `agent-comms` (the hub), and the account-local soul population (the fleet).
- **Soul model:** A soul is a growing package — the root `AGENTS.md` is the core starting point, and `worktrees/` plus `.soul-state/` are working state. Agents work in worktrees linked to a long-lived soul and pinned via `agentBot.agentId` (retiring any task-scoped souls after merge with `soul remove`). Dream maintenance is a scheduled, owner-gated turn that recalibrates the package from accumulated experience.
- **Links for depth:** [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity) docs ([soul-package.md](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-package.md), [joining.md](https://github.com/qwts/agent-bot-identity/blob/main/docs/joining.md), [soul-homes.md](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-homes.md), [soul-skill-dream-design.md](https://github.com/qwts/agent-bot-identity/blob/main/docs/soul-skill-dream-design.md), [ADR-0275](https://github.com/qwts/agent-bot-identity/blob/main/docs/decisions/ADR-0275-soul-packages-are-versioned-definitions-souls-can-grow.md), [ADR-0332](https://github.com/qwts/agent-bot-identity/blob/main/docs/decisions/ADR-0332-souls-are-the-agents-territory.md)), the `agent-bot` skill ([`skills/agent-bot/SKILL.md`](https://github.com/qwts/agent-bot-identity/blob/main/skills/agent-bot/SKILL.md)), [Agent bot organization operations](docs/agent-bot-operations.md), [Agent onboarding and standing operating conventions](docs/onboarding.md), CI policy ([`qwts/qwts-agent-ci`](https://github.com/qwts/qwts-agent-ci)), and machine setup ([`qwts/managed-machine`](https://github.com/qwts/managed-machine)).

## Pending

`org.json` maps six capabilities, each pinned to a commit: `managed-machine` (`qwts/managed-machine`), `aca` (`qwts/agentic-code-analysis`), `ci` (`qwts/qwts-agent-ci`), `docs-gov` (`qwts/qwts-agent-docs-gov`), `inventory` (`qwts/qwts-agent-inventory`), and `sdlc` (`qwts/qwts-agent-sdlc`). Moving a pin is a reviewed change to this file.

## Runtime skill discovery

`agent-bot` (including `agent-space`) and `agent-comms` supply operational
guidance from their installed CLI bundles. They are outside the capability
pin map; follow [installed runtime guidance](docs/config.md#installed-runtime-guidance).
Record the installed version and source provenance, check the bundled skill's
compatibility range, and manage upgrades through the release/install process.
