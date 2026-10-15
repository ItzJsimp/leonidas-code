# Output style mechanics

Platform facts, version gates, and troubleshooting for Claude Code output
styles. Authoring guidance lives in [`SKILL.md`](./SKILL.md).

Verified 2026-09-08 against the official docs plus one empirical finding on
this machine. Re-verify when Claude Code updates, since this surface has
already broken compatibility once (see Stale sources).

## Frontmatter reference

| Field                      | Purpose                                                                                           | Default                 |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| `name`                     | Style name shown in the picker                                                                    | File name without `.md` |
| `description`              | One-line blurb in the picker                                                                      | None                    |
| `keep-coding-instructions` | Retain Claude Code's built-in engineering instructions                                            | `false`                 |
| `force-for-plugin`         | Plugin styles only: apply automatically when the plugin is enabled, overriding the user's setting | `false`                 |

Constraints that bite:

- **`outputStyle` must match `name` exactly, case-sensitive.** "Ship Mode" and
  "ship mode" are different values, and a mismatch fails silently.
- **`force-for-plugin` in a user-level style logs a warning** and does nothing.
  It belongs only in plugin-shipped styles.
- **Maximum file size is 1 MB.**
- **Malformed YAML hides the style silently.** No error, it simply never
  appears in the picker. Suspect frontmatter first when a style goes missing.

## Where style files live

- User: `~/.claude/output-styles/`
- Project: `.claude/output-styles/`
- Managed policy: `.claude/output-styles/` inside the managed settings directory
- Plugin: `<plugin>/output-styles/`

Per the docs, project styles load from every `.claude/output-styles/` between
the working directory and the repository root, and the directory closest to the
working directory wins on a name collision.

**Empirical finding, Claude Desktop Code tab, 2026-09-08:** a style in the
project directory did not appear in the desktop picker until the project folder
was symlinked into the global location. This contradicts the documented
behaviour and is recorded because it was observed directly on this machine, not
because a source claims it.

The AIOS arrangement, which works: styles live in `.claude/output-styles/`
inside the repo (version-controlled, one copy), and `~/.claude/output-styles`
is a symlink pointing at it.

Related: GitHub issue anthropics/claude-code#25612 requested per-directory
style _selection_ and was closed as not planned. Selection later became
per-project through `.claude/settings.local.json`, so treat that issue as
historical context rather than current state.

## Activation

- **Terminal:** `/config`, then Output style. Saves to
  `.claude/settings.local.json`.
- **Desktop app (Code tab):** the three-dot menu carries an Output style
  submenu. `/config` in the desktop app opens Settings rather than a picker.
- **Any surface:** set the field directly.

```json
{ "outputStyle": "Leonidas" }
```

Two behaviours worth planning around:

- **Style files are read at startup.** Creating or editing a style during a
  running session requires a restart before it is visible.
- **Switching styles rebuilds the prompt cache once.** The style is part of the
  system prompt, so a mid-session switch is a Tier 2 invalidation: the tool
  cache survives, the system and message caches do not.

## Built-in styles

| Style           | Behaviour                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**     | Standard Claude Code engineering prompt                                                                                                                        |
| **Proactive**   | Executes immediately, assumes rather than pausing on routine decisions. Stronger than auto mode, and independent of permission mode                            |
| **Concise**     | Leads with the result, skips narration, stays short. Keeps error reports, security warnings, and destructive-action confirmations complete. Requires v2.1.237+ |
| **Explanatory** | Adds educational "Insights" between engineering steps                                                                                                          |
| **Learning**    | Adds Insights plus `TODO(human)` markers for the operator to implement                                                                                         |

`Concise` is the built-in worth studying: it is the reference implementation of
an honesty floor, since it compresses output while explicitly preserving
failures and warnings at full length.

## Scope limits

- **Main conversation only.** Subagents run their own system prompts, so a
  style never reaches them. A `fork` inherits the parent prompt and is the sole
  exception.
- **Claude Code only.** Antigravity has no equivalent surface.

## Token cost

Style instructions add input tokens on every request, largely absorbed by
prompt caching after the first. Output tokens move with the style's own rules:
Explanatory and Learning are longer than Default by design, Concise is shorter.

## Troubleshooting

| Symptom                            | First check                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Style absent from the picker       | Malformed YAML frontmatter, then restart, then the symlink arrangement above |
| Setting does not select it         | `outputStyle` value must match `name` exactly, case included                 |
| Coding behaviour degraded          | Missing `keep-coding-instructions: true`                                     |
| Edits to a style have no effect    | Files are read at startup; restart                                           |
| `force-for-plugin` warning in logs | Field belongs only in plugin styles; remove it                               |
| Style ignored inside a subagent    | Working as designed; put it in the agent definition                          |

## Stale sources

This surface changes, and third-party guides lag. Verified as of 2026-09-08:

- **`/output-style` is gone.** Deprecated in v2.1.73, removed in v2.1.91. Many
  guides still teach `/output-style <Name>` as the activation path. Use
  `/config`, the desktop menu, or the settings field.
- **Guides pointing selection at `~/.claude/settings.json`** predate the move
  to `.claude/settings.local.json`.

Version gates seen so far: Concise requires v2.1.237+, and the VS Code picker
requires v2.1.257+. When a documented behaviour does not reproduce, check the
version before assuming the doc is wrong.

## Sources

- Official: https://code.claude.com/docs/en/output-styles
- Authoring guide: https://github.com/jensensics/claude-code-output-styles
- Issue: https://github.com/anthropics/claude-code/issues/25612
