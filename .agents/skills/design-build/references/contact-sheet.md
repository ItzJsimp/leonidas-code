# Contact sheet: Jake picks from pixels

Jake narrows taste fastest from rendered specimens side by side ([`patterns.md`](../../../../memory/observed/patterns.md), "Taste Is Chosen From Rendered Specimens"). Never offer visual choices as text only.

## Build it

1. One self-contained HTML file in the project folder (for example `projects/<project>/design/<surface>-directions.html`). It loads the project's fonts and tokens, or for AIOS canon [`assets/fonts/fonts.css`](../../../../assets/fonts/fonts.css) and the CSS variables from [`tokens.css`](../../../../projects/leonidas-command-center/src/tokens.css), so every direction is on-system. Desktop screens are mocked in HTML at the real window size and documents at page size; that is faster than building three native variants. For a project choosing its own brand, the 3 directions may also differ in palette and type.
2. Use real data sampled from the live source (events, tasks, config), not lorem ipsum. Include one long string and one empty state per direction so clipping shows.
3. Exactly 3 directions, side by side at the real width, labeled A, B, C. Make them structurally different (layout and information architecture), not three color tweaks. Typical spread for an app screen (for a landing page or document, pick 3 archetypes that fit that form instead):
   - **A: Dense list plus detail pane** (Apple Mail, Linear). Wins when scanning many items.
   - **B: Cards and summary first** (Apple Health, Vercel dashboard). Wins when the headline number matters most.
   - **C: Single focused column with progressive disclosure** (macOS System Settings). Wins when the screen is mostly configuration.
4. Under each: one "wins when" line and what it would cost to build (S, M, L).
5. Open it for Jake with `SendUserFile` (display `render`) or the browser pane, and screenshot it into the chat.

## Record the pick

Write Jake's answer verbatim ("B, but A's header") plus the resolved recipe (layout, components, which states) into the grill capture file or the task's spec before building.
