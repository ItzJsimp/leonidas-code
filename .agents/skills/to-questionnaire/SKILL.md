---
name: to-questionnaire
description: "Convert open decisions into asynchronous, standalone Markdown questionnaires for collaborators."
category: planning
scope: structural
source: "https://github.com/mattpocock/skills (skills/productivity/to-questionnaire, MIT, adapted for the AIOS)"
distribution: core
type: skill
id: skill-to-questionnaire
title: "To Questionnaire : Asynchronous Question & Requirements Gatherer"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-22
related: ["skills-index", "technical-writing", "master-instructions"]
generated: false
disable-model-invocation: true
license: MIT
---

# To Questionnaire

## Purpose

When a project has unresolved requirements that require input from someone else (e.g., a partner, a client, an external partner), `/to-questionnaire` extracts all pending questions and packages them into a clean, easy-to-fill Markdown document.

---

## Procedure

1. **Scan Context:** Identify all open questions, decision forks, missing credentials, or undefined business rules in the current task.
2. **Group Logically:** Categorize questions by topic (e.g. Brand & Tone, Pricing & Offers, Technical Credentials, Workflow Preferences).
3. **Draft High-Signal Prompts:**
   - Frame questions with multiple-choice recommendations and clear write-in fields.
   - State _why_ each answer is needed and what default will be used if left blank.
4. **Save Document:** Write to `projects/<project>/questionnaire-YYYY-MM-DD.md` or `handoff-docs/questionnaire-YYYY-MM-DD-<topic>.md`.

---

## Output Template

```markdown
# Questionnaire: [Topic Name]

**Prepared for:** [Name] | **Date:** YYYY-MM-DD | **Return by:** [Date/Time]
**Context:** [1-2 sentences explaining why this information is needed]

---

### Section 1: [Category Name]

#### 1. [Question Title]

[Brief background explaining the decision]

- [ ] Option A: [Description] _(Recommended)_
- [ ] Option B: [Description]
- Write-in: `___________________________`

_Default if skipped:_ [What we will assume if unselected]
```

Credit: adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). See [LICENSE](LICENSE).
