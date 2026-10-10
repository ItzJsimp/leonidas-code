# Leonidas Code

Leonidas Code is an "agent harness control surface". It controls the coding agents on your machine (Claude Code, Codex, Cursor, Grok Build, OpenCode, and Google Antigravity) from one desktop app, using your own subscriptions. If they are set up on your computer, Leonidas Code can control them.

Leonidas Code is a fork of [T3 Code](https://github.com/pingdotgg/t3code) by T3 Tools (MIT). The original MIT copyright notice is kept in [LICENSE](./LICENSE).

## Installation

> [!WARNING]
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`
> - Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.

### Desktop app

Download the latest Windows installer from [GitHub Releases](https://github.com/ItzJsimp/t3code/releases). The app checks that repository for updates and shows a toast when a new release is ready.

The installer is unsigned, so Windows SmartScreen warns once on first install. Updates still apply.

## Documentation

Full docs live in [docs/](./docs).

- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run Leonidas Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md). Team workflow for this fork is in [LEONIDAS.md](./LEONIDAS.md).

## Contributing

### Install `vp`

Leonidas Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.

Issues and ideas: https://github.com/ItzJsimp/t3code/issues
