# Agent onboarding and standing operating conventions

This guide covers bringing a new coding-agent harness onto the `qwts` fleet and the standing operating conventions every agent follows in every session. Policy and App registration rules live in [Agent bot organization operations](agent-bot-operations.md); runtime commands and internals live in [`qwts/agent-bot-identity`](https://github.com/qwts/agent-bot-identity).

## First-time setup (new harness or new machine)

Onboarding spans four governed surfaces:

- **Organization governance and roster (`qwts/qwts-agent-org` and `qwts/agent-sop`):** Register the harness's GitHub App row in [`governance/agents.json`](../governance/agents.json), install the App across active and onboarding repositories in [`governance/repos.json`](../governance/repos.json), and regenerate [`governance/organization-profile.json`](../governance/organization-profile.json) with `node tools/organization-profile.mjs --write` (or `node tools/repos.mjs --write`).
- **Machine setup (`qwts/managed-machine`):** Provision the host packages, CLI tools, and local configuration through the `managed-machine` formula and catalog.
- **Identity runtime and `gh` shim (`qwts/agent-bot-identity`):** Bootstrap the machine roster and fail-closed `gh` shim from the organization profile, restore App credentials from `pass-cli`, and stand up the agent's canonical long-lived soul.
- **CI policy (`qwts/qwts-agent-ci`):** Every governed repository enforces `qwts-agent-ci` checks on pull requests, requiring Web-Flow verified bot commits (`agent-bot signed-commit`) and repository-specific gates (such as `changes/` changelog fragments in `qwts/agent-bot-identity` or `npm run check` and `npm run lint:markdown` here).

Walk and verify each onboarding step in order:

1. **Provision credentials from `pass-cli`.** Confirm `pass-cli` is signed in with access to the `Agent Identities` vault, then restore the App ID and private key:

   ```bash
   agent-bot ensure-private-key --app <slug>
   ```

   This populates the managed App credential store (or legacy `~/.config/<slug>/{app-id,private-key.pem}`).
2. **Verify the first token mint with `GH_AGENT_APP`.** Do not run `agent-bot mint-token --app <slug>` from an unpinned checkout with no stated identity in the owner's account — that path triggers the macOS owner-approval gate and prompts for administrator credentials on every call. State the identity via `GH_AGENT_APP=<slug>`:

   ```bash
   tok="$(GH_AGENT_APP=<slug> agent-bot mint-token)" || exit 1
   ```

3. **Install the `gh` shim and verify machine readiness.** Ensure the fail-closed `gh` shim is installed (`agent-bot install-gh-shim` or `agent-bot bootstrap --with-gh-shim`) and verify the installation with `agent-bot doctor --machine-only --json --require-schema-version 1`.
4. **Stand up the agent's canonical long-lived soul.** Discover the installed `Genius` template with `agent-bot soul templates --json`, spawn one canonical soul for the harness (`agent-bot soul spawn <genius-template-path> --name <name> --harness <harness>`), and seed its package `AGENTS.md` with the standing conventions below.

## Standing operating conventions (every session)

1. **One long-lived soul per agent (reuse, never spawn per task).** Each agent persona operates as one canonical long-lived soul across tasks. Link task worktrees into that soul (`<soul>/worktrees/<task>`) and pin them (`agentBot.agentId`). When joining from an unpinned worktree, pass `--soul <agent-id>` (`agent-bot join --name <name> --harness <harness> --soul <agent-id> --json`); inside an already-pinned worktree, `agent-bot join` reuses the pinned soul automatically. The soul's package `AGENTS.md` is its standing instruction set and grows via reviewed revisions (`agent-bot soul revision prepare` / `edit ... --apply`), skill learning (`agent-bot soul skill learn`), and the owner-gated dream. Retire any ephemeral task-scoped souls after their work merges (`agent-bot soul remove <agentId> --plan`, then owner-gated `agent-bot soul remove <agentId>`, which archives the soul's folders permanently with no un-retire).
2. **Worktree-first isolation.** Never commit directly on `main` or mutate the human owner's primary checkout. Create an isolated git worktree under the soul's `worktrees/` directory for each task and bind it before committing:

   ```bash
   AGENT_BOT_ID=<agent-id> GH_AGENT_APP=<slug> agent-bot setup-worktree <slug>
   ```

3. **`mint-token` and `gh` shim token contract.**
   - Always pass `GH_AGENT_APP=<slug>` (or run inside a pinned worktree) when calling `agent-bot mint-token`; never call `agent-bot mint-token --app <slug>` from an unpinned, unmarked context.
   - Whenever any soul marker (`GH_AGENT_APP`, `agentBot.app`, `AGENT_BOT_ID`, `agentBot.agentId`, or `<git-dir>/agent-binding.json`) is present, the `gh` shim (`~/.local/bin/gh`) sets `SOUL_BOUND=1`, unsets any inherited `GH_TOKEN`, and requires a live daemon binding (`<git-dir>/agent-binding.json`) to mint; in an unpinned context without a soul marker, inherited tokens are not used for bot attribution.
   - When operating without a live daemon binding, mint a token with `GH_AGENT_APP=<slug> agent-bot mint-token`, verify `.data.viewer.login == "<slug>[bot]"` via GraphQL, and invoke the real `gh` binary (for example `/opt/homebrew/bin/gh`) with `GH_TOKEN`:

     ```bash
     tok="$(GH_AGENT_APP=<slug> agent-bot mint-token)" && \
     login="$(GH_TOKEN="$tok" /opt/homebrew/bin/gh api graphql -f 'query={viewer{login}}' --jq .data.viewer.login)" && \
     [ "$login" = "<slug>[bot]" ] && \
     GH_TOKEN="$tok" /opt/homebrew/bin/gh pr view ...
     ```

4. **GitHub-verified bot commits (`agent-bot signed-commit`).** Every bot commit on a `qwts` repository must be authored by `<slug>[bot]` and verified via GitHub's Web-Flow API. Commit locally in the bound worktree, then immediately replace the commit and push with `signed-commit`:

   ```bash
   AGENT_BOT_ID=<agent-id> GH_AGENT_APP=<slug> git commit -F <msg-file>
   GH_AGENT_APP=<slug> agent-bot signed-commit
   ```

   `agent-bot signed-commit` signs and advances the remote branch on `origin` and resets the local branch to the verified commit; do not run a separate `git push` afterward.
5. **Respect owner-gated boundaries.** Agents never bypass or self-approve owner gates:
   - **Dream maintenance (`agent-bot soul skill dream`):** Agents inspect `--status` and `--history` and prepare revisions or skill learnings; the owner authorizes `--schedule PT<N>H`, `--run-now`, `--pause`, `--unschedule`, and `--ack-notice`.
   - **Soul lifecycle and cold wake:** `agent-bot soul remove`, `soul fork`, and `soul cold-wake` mutations require owner authorization.
   - **Machine updates and SSH enrollment (`managed-machine`):** `managed-machine --update` refuses from agent sessions, and `managed-machine ssh enroll` is strictly human-only.
