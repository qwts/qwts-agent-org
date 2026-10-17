# Agent onboarding and standing operating conventions

This guide covers onboarding an agent or harness onto the `qwts` fleet and the standing operating conventions every agent follows in every session. Policy and App registration rules live in [Agent bot organization operations](agent-bot-operations.md); runtime commands and internals live in [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity).

## Agent onboarding checklist

Treat onboarding like a new teammate's first-day orientation:

1. **Follow the SOP and the org repository.** Start from [`org.json`](../org.json), [`governance/`](../governance/repos.json), and the [README map](../README.md), which resolve the current approved SOP (`qwts/qwts-agent-sop`) and capability repositories.
2. **Read the runtime model.** Review the [Runtime model](../README.md#runtime-model) section in `README.md` for the host (GeniusBar), composition (`agent-bot-identity`, `agent-comms`, and the account-local soul population), and soul package lifecycle.
3. **Run the mechanical checks.** Verify SOP resolution, the local soul population, and runtime readiness before mutating any repository:

   ```bash
   agent-bot sop
   agent-bot population list
   agent-bot doctor
   ```

4. **Confirm the worktree binding.** Verify that the worktree's `agentBot.agentId` pin (`git config --worktree --get agentBot.agentId` or `agent-bot identity current`) is present and matches the intended long-lived soul.
5. **Know where each surface onboards:**
   - **CI policy (`qwts/qwts-agent-ci`):** Shared CI policy and composite actions for governed repositories that adopt shared CI (`sharedCi: true` in [`governance/repos.json`](../governance/repos.json)), plus repository-specific gates (such as `npm run check`, `npm test`, and `npm run lint:markdown` here, or `changes/` changelog fragments in `qwts/agent-bot-identity`).
   - **Development environment and org governance (`qwts/qwts-agent-org` and `qwts/qwts-agent-sop`):** Register the harness's GitHub App row in [`governance/agents.json`](../governance/agents.json), install the App across active and onboarding repositories in [`governance/repos.json`](../governance/repos.json), and regenerate [`governance/organization-profile.json`](../governance/organization-profile.json) with `node tools/organization-profile.mjs --write` (or `node tools/repos.mjs --write`).
   - **Identity runtime and `gh` shim (`qwts/agent-bot-identity`):** Confirm `pass-cli` access to the `Agent Identities` vault, install the fail-closed `gh` shim (`agent-bot install-gh-shim` or `agent-bot bootstrap --with-gh-shim`), and spawn the agent's canonical long-lived soul from the `Genius` template (`agent-bot soul templates --json`, then `agent-bot soul spawn <template-path> --name <name> --harness <harness>`). Provisioning and first-mint prerequisites depend on the App's credential backend (`store` in `config.json` / `soul.json`), distinguishing using `pass-cli` to import a key into a readable `file`/`keychain` store from retaining `store: "pass-cli"` as the credential backend:
     - **`agent-bot-keyd` (`store: "keyd"`, shipped with GeniusBar) and `store: "pass-cli"` backends:** For `store: "keyd"`, `ensure-private-key` refuses `keyd`-held credentials (`keyd-held`), and `mint-token` routes through `mintThroughDaemon`, which rejects callers without a live daemon binding (`<git-dir>/agent-binding.json`). For `store: "pass-cli"`, `passCliStore` (`identity/soul-credentials.mjs`) refuses any soul-marked caller — including `GH_AGENT_APP=<slug>` — before any provider call (`owner-only`: `soul credential stores are unavailable to a soul caller`). Establish `<git-dir>/agent-binding.json` in a linked worktree first by running `agent-bot join --name <name> --harness <harness> --soul <agent-id>` (which pins `agentBot.agentId` and mints `<git-dir>/agent-bind-token.json`) followed by the MCP `bind` exchange (or `agent-bot join ... --wake acp`) so `mintForCaller` and `/v0/credential` can mint through the daemon. **Runtime `setup-worktree` limitation:** `setup-worktree` only mints a bind token (`prepareWorktreeBinding`) — it is not an alternative to the MCP `bind` exchange — and `setup-worktree.mjs` currently calls `reconcileAppCredentials` (`ensurePrivateKey`) before writing GitHub attribution, which does not use the daemon credential path and fails during `local preparation` with `keyd-held` (even after MCP `bind`) for `store: "keyd"` or `owner-only` for soul-marked `store: "pass-cli"`. Full `agent-bot setup-worktree <slug>` attribution therefore requires a readable `file` or `keychain` store (or legacy `~/.config/<slug>`) until `setup-worktree` / `reconcileAppCredentials` routes preparation through the daemon.
     - **Readable `file` or `keychain` credential stores (or legacy `~/.config/<slug>/{app-id,private-key.pem}`):** Import credentials from Proton Pass with `agent-bot ensure-private-key --app <slug>` into the `file` or `keychain` store, and verify the first token mint via `GH_AGENT_APP=<slug>` and GraphQL viewer login (without triggering the unmarked `mint-token --app <slug>` owner-approval dialog).
   - **Machine setup (`qwts/managed-machine`):** Host packages, catalog applications, and local machine setup via the `managed-machine` formula.

To verify the first token mint cleanly during setup (from inside the bound worktree via `agent-bot mint-token` after `join` + MCP `bind` when the App uses `store: "keyd"` or `store: "pass-cli"`, or with `GH_AGENT_APP=<slug> agent-bot mint-token` after `ensure-private-key` imports the key into a readable `file` or `keychain` store):

```bash
GH_TOKEN="$(GH_AGENT_APP=<slug> agent-bot mint-token)" || exit 1
export GH_TOKEN
login="$(/opt/homebrew/bin/gh api graphql -f 'query={viewer{login}}' --jq .data.viewer.login)" || { unset GH_TOKEN; exit 1; }
unset GH_TOKEN
[ "$login" = "<slug>[bot]" ] || exit 1
```

## Standing operating conventions (every session)

1. **One long-lived soul per agent (reuse, never spawn per task).** Each agent persona operates as one canonical long-lived soul across tasks. Link task worktrees into that soul (`<soul>/worktrees/<task>`) and pin them (`agentBot.agentId`). When joining from an unpinned worktree, pass `--soul <agent-id>` (`agent-bot join --name <name> --harness <harness> --soul <agent-id> --json`); inside an already-pinned worktree, `agent-bot join` reuses the pinned soul automatically. The soul's package `AGENTS.md` is its standing instruction set and grows via reviewed revisions (`agent-bot soul revision prepare` / `edit ... --apply`), skill learning (`agent-bot soul skill learn`), and the owner-gated dream. Retire any ephemeral task-scoped souls after their work merges (`agent-bot soul remove <agentId> --plan`, then owner-gated `agent-bot soul remove <agentId>`, which archives the soul's folders permanently with no un-retire).
2. **Read load-bearing facts from source, never from a summary.** Read commit SHAs, capability pins, worktree bindings, and Agent IDs directly from source (`org.json`, `git rev-parse`, `agent-bot identity current`, `agent-bot population list`) at the start of every task; never copy a SHA or pin from a context summary or prior chat turn.
3. **Drift findings become doc PRs (the ratchet rule).** When a session discovers an undocumented runtime behavior, an onboarding gap, or convention drift, turn that finding into a reviewed documentation or runtime PR rather than leaving it as a private one-off correction.
4. **The nightly dream is owner-registered (agents prepare, owners authorize).** Agents inspect dream status (`agent-bot soul skill dream --soul <id> --status` / `--history`) and prepare revisions or skill learnings, while the owner registers schedules (`--schedule PT<N>H`), triggers runs (`--run-now`), acknowledges notices (`--ack-notice`), and authorizes other owner-gated actions (`agent-bot soul remove`, `soul fork`, `soul cold-wake`, and `managed-machine --update` / `ssh enroll`).
5. **Worktree-first isolation.** Never commit directly on `main` or mutate the human owner's primary checkout. Create an isolated git worktree under the soul's `worktrees/` directory for each task, link it (`agent-bot join --name <name> --harness <harness> --soul <agent-id>`), complete the MCP `bind` exchange (or `join --wake acp`) to write `<git-dir>/agent-binding.json`, and configure GitHub attribution before committing (requires a readable `file`/`keychain` or legacy `~/.config/<slug>` credential store until `setup-worktree.mjs` / `reconcileAppCredentials` supports daemon-backed preparation for `store: "keyd"` and `store: "pass-cli"`):

   ```bash
   AGENT_BOT_ID=<agent-id> GH_AGENT_APP=<slug> agent-bot setup-worktree <slug>
   ```

6. **`mint-token` and `gh` shim token contract.**
   - Always pass `GH_AGENT_APP=<slug>` (or run inside a pinned worktree) when calling `agent-bot mint-token`; never call `agent-bot mint-token --app <slug>` from an unpinned, unmarked context, which fires the macOS owner-approval gate on every invocation.
   - Whenever any soul marker (`GH_AGENT_APP`, `agentBot.app`, `AGENT_BOT_ID`, `agentBot.agentId`, or `<git-dir>/agent-binding.json`) is present, the `gh` shim (`~/.local/bin/gh`) sets `SOUL_BOUND=1`, unsets any inherited `GH_TOKEN`, and requires a live daemon binding (`<git-dir>/agent-binding.json`) to mint; in an unpinned context without a soul marker, inherited tokens are not used for bot attribution.
   - Credential backends determine first-mint prerequisites. Follow the
     [onboarding checklist](#agent-onboarding-checklist) above for daemon-bound
     `keyd`/`pass-cli` stores and readable `file`/`keychain` stores; it includes
     the GraphQL viewer check and the real-`gh` token invocation contract.

7. **GitHub-verified bot commits (`agent-bot signed-commit`).** Every bot commit on a `qwts` repository must be authored by `<slug>[bot]` and verified via GitHub's Web-Flow API. Commit locally in the bound worktree, then immediately replace the commit and push with `signed-commit`:

   ```bash
   AGENT_BOT_ID=<agent-id> GH_AGENT_APP=<slug> git commit -F <msg-file>
   GH_AGENT_APP=<slug> agent-bot signed-commit
   ```

   `agent-bot signed-commit` signs and advances the remote branch on `origin` and resets the local branch to the verified commit; do not run a separate `git push` afterward.
