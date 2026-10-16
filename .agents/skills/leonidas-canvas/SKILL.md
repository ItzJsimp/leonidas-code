---
name: "leonidas-canvas"
description: "Publish an interactive HTML canvas (tabs, KPI cards, flowcharts, tables) in the chat with html_render. Use for architecture, deep research, specs, roadmaps, comparisons and long multi-part answers."
category: "design"
scope: "structural"
distribution: "template"
type: "skill"
id: "skill-leonidas-canvas"
title: "Leonidas Interactive Canvas"
kind: "procedure"
load: "on-demand"
owner: "leonidas"
verified: "2026-10-11"
related: ["design-build", "design-audit", "impeccable", "prompt-composer"]
---

# Leonidas Interactive Canvas

Transforms complex agent output-architecture specifications, multi-facet research, system designs, game mechanics, and roadmaps-from overwhelming walls of markdown into an **Apple-grade, interactive executive dashboard** rendered directly in the Leonidas Code chat stream.

Inspired by Rostyslav Melnyk's executive research outputs in T3 Code, this skill uses Leonidas Code's native `html_render` tool to display an interactive canvas with clickable pill tabs, glowing KPI cards, inline SVG diagrams, and high-density styled tables.

---

## 1. When to Use (Activation Triggers)

Use an Interactive Canvas whenever your output is substantive and multifaceted:

| Category                         | Typical Scenarios                                                | What the Canvas Replaces                         |
| :------------------------------- | :--------------------------------------------------------------- | :----------------------------------------------- |
| **System Architecture & Specs**  | End-to-end subsystem designs, data schemas, API contracts        | 800+ lines of nested headers and ascii diagrams  |
| **Deep Research & Syntheses**    | Multi-topic investigation, tech stack evaluation, game mechanics | Walls of unstructured bullet points              |
| **Release & Strategic Roadmaps** | Multi-phase milestones, deliverables, dependency graphs          | Long, dry chronological markdown lists           |
| **Audits & Trade-off Matrices**  | Codebase assessments, benchmark comparisons, pros/cons           | Unreadable plain-text tables with scroll fatigue |

**Do NOT use for:** Quick bug fixes, single-function edits, simple questions, or progress notes between subagent tool runs. For those, use standard markdown with Focus / Next Actions.

---

## 2. Anatomy of a Leonidas Canvas

Every canvas follows a structured visual hierarchy engineered to match the Leonidas Code dark-mode aesthetic:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Plan]  [Power · levels · death]  [World & Maps]  [Weapons]  [Roadmap] │ ⤢
├────────────────────────────────────────────────────────────────────────┤ (gradient line)
│  Title & Executive Thesis (1-2 sentences bold lead-in)                │
│                                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ ⚡ KPI 1      │ │ ⏱️ KPI 2     │ │ 🎯 KPI 3     │ │ 💰 KPI 4     │  │
│  │ Three.js ≤8MB│ │ 12 Weeks     │ │ 1 + 3 Hubs   │ │ $25-40/mo    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                        │
│  ■ SECTION HEADER WITH ACCENT GLYPH                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Step 1] ──> [Step 2] ──> [Step 3] ──> [Step 4] ──> [Outcome]     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ■ DATA & ENTITY MATRIX                                                │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ Name         │ Type         │ Status       │ Action / Specs      │  │
│  ├──────────────┼──────────────┼──────────────┼─────────────────────┤  │
│  │ Firstlight   │ Hub World    │ [ GREEN ]    │ Launch Default      │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Components & Styling Tokens

1. **Pill Navigation Tabs**:
   - Capsule buttons (`border-radius: 9999px`) with subtle borders.
   - Active tab highlighted in vibrant magenta/purple (`#ec4899` / `#a855f7`) with a soft glow (`box-shadow: 0 0 12px rgba(236, 72, 153, 0.35)`).
   - Underneath the tab bar: A sleek 1px gradient hairline (`linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6, #06b6d4)`).
2. **Executive KPI Stat Cards**:
   - 4-column responsive grid on desktop (collapses gracefully on mobile).
   - Border-accented with distinct thematic hues:
     - **Cyan/Teal (`#2dd4bf`)**: Technical parameters, client tech, engine.
     - **Pink/Magenta (`#fb7185`)**: Timeline, velocity, duration.
     - **Amber/Orange (`#fbbf24`)**: Scope, milestones, quantity.
     - **Emerald/Green (`#34d399`)**: Economics, hosting, cost, efficiency.
3. **Pipeline Flowcharts & Sequential Loops**:
   - Step boxes connected with pill arrows (`➔`).
   - Clean color coding for phases (Initialization ➔ Loop ➔ Terminal State).
4. **Orbital & System Network Diagrams**:
   - Inline clean `<svg>` with centered hub nodes, concentric dashed orbits, and color-coded destination planets or microservices.
5. **Styled Matrix Tables**:
   - Dark translucent table rows (`rgba(255, 255, 255, 0.02)` / alternating `0.04`).
   - Status pill badges (`GREEN`, `YELLOW`, `V1 starter`).
   - Crisp uppercase headers with subtle letter-spacing.

---

## 3. The CSS & Theme Variable Contract

Leonidas Code automatically injects its theme tokens into `:root`. Always build against these variables to guarantee 100% theme fidelity:

```css
:root {
  /* Injected automatically by Leonidas Code */
  --background: canvas background (matches chat thread);
  --foreground: primary text color;
  --muted: muted background surface;
  --muted-foreground: secondary/subtitle text color;
  --card: card and container background;
  --border: subtle line and container border;
  --accent: brand accent color;
  --font-sans: system UI font stack;
  --font-mono: monospace font stack;
  --radius: 0.625rem;
}
```

### Critical Rules

- **No external CDN dependencies**: Everything must load offline and instantly. No unpkg/cdnjs links. Use native CSS and SVG.
- **Self-contained vanilla JS**: Tab switching must use clean vanilla DOM manipulation (`document.querySelectorAll('.tab-pane')`).
- **Zero layout shift**: Ensure container heights are stable when switching tabs.

---

## 4. End-to-End Workflow

Follow this disciplined sequence:

1. **Synthesize the Architecture / Findings**: Group your content into 3 to 6 logical pill tabs (e.g. `Plan`, `System Architecture`, `Data Model`, `Roadmap`, `Economics`).
2. **Draft the HTML Document**: Use the pre-built template in [`templates/canvas-boilerplate.html`](templates/canvas-boilerplate.html). Customize the tabs, KPI cards, flowcharts, and tables.
3. **Preview & Measure (`html_preview`)**:
   Call `html_preview({ html, width: 728 })` to verify visual layout, ensure there are no CSS/JS errors, and obtain `contentHeight`.
4. **Render in Chat (`html_render`)**:
   Call `html_render({ title: "Executive Specification", html, height: contentHeight })`.
5. **Output Final Chat Message**:
   Because the reader sees the interactive canvas directly above your response:
   - Provide a 1-2 sentence executive summary pointing to the canvas.
   - Follow the standard Focus / Next Actions / Dock format.
   - Do NOT duplicate the content already inside the canvas.

---

## 5. Reference Templates & Snippets

- [`templates/canvas-boilerplate.html`](templates/canvas-boilerplate.html): Complete, drop-in HTML canvas ready for customization.
- [`templates/components.html`](templates/components.html): Standalone code snippets for KPI grids, pipeline flowcharts, SVG orbital maps, and styled data tables.
