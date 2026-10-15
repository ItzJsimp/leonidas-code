# Canonical Skill Templates

Use these starter templates when authoring new skills. Conforms to ADR-0012, ADR-0013, and ADR-0038.

---

## 1. Minimal Model-Invoked Skill Template

Use when the skill should be reachable both autonomously by the AI and manually by the user.

`markdown
---

name: "kebab-case-name"
description: "Front-loaded action verb describing what this skill does under 250 chars. For situation A, situation B."
scope: structural
distribution: core
---

# Title of the Skill

One-line mission statement explaining the operational outcome of this skill.

## 1. Procedure

1. **Step 1:** First concrete action ending on a checkable gate.
2. **Step 2:** Second sequential action.
3. **Step 3:** Next action.

## 2. Completion Criteria

- [ ] Clear observable state confirming work is finished.
- [ ] Automated verification script or test command passes with exit code 0.
      `

---

## 2. Minimal User-Invoked Skill Template (disable-model-invocation)

Use for manual workflows, destructive scripts, or developer checklists that should never fire automatically. Consumes 0 context listing tokens.

`markdown
---

name: "kebab-case-name"
description: "Human-facing summary of this manual operator workflow."
disable-model-invocation: true
scope: structural
distribution: core
---

# Title of Manual Skill

Detailed procedural guide executed strictly when manually invoked via /kebab-case-name.

## 1. Interactive Steps

1. **Step 1:** Actionable operator instructions.
2. **Step 2:** Follow-up verification.

## 2. Done When

- Operator confirms completion.
  `

---

## 3. Router Skill Template

Use when grouping multiple user-invoked skills under a single cognitive entry point.

`markdown
---

name: "kebab-router-name"
description: "Route domain tasks across specialized child skills."
scope: structural
distribution: core
---

# Domain Router

Guides the operator or agent to the right specialized skill based on the active task.

## Routing Ladder

| Condition / Task Type | Recommended Skill | Invocation     |
| --------------------- | ----------------- | -------------- |
| Specific Task A       | child-skill-a     | /child-skill-a |
| Specific Task B       | child-skill-b     | /child-skill-b |

## Procedure

1. Identify the matching task branch above.
2. Invoke the corresponding skill directly.
   `
