---
name: "n8n-workflow-patterns"
description: "Architectural patterns for n8n workflows: webhooks, APIs, AI agents, batch loops, and error handling."
category: code
scope: "structural"
distribution: template
disable-model-invocation: true
license: MIT
---

# n8n Workflow Patterns

Proven architectural patterns for designing, testing, and operating n8n workflows.

---

## AIOS Tier 4 Automation Integration

In your AIOS and any peer AIOS, n8n serves as the Tier 4 Workflow Orchestrator for:

- **the peer AIOS:** Parsing inbound brand inquiry emails, creating automated Discord stage notifications, and generating client contract briefs.
- **Leonidas:** Ingesting webhooks from mobile capture, third-party APIs, and triggering local webhook endpoints.

_Local Setup Status:_ If n8n is not yet running locally on Windows 11, see [references/local-setup-guide.md](references/local-setup-guide.md) to launch it in seconds via Docker or npm.

---

## The 6 Core Workflow Patterns

1. **Webhook Processing (Most Common)**
   - Receive HTTP requests -> Validate -> Transform -> Respond/Notify
   - Pattern: Webhook -> Payload Validation -> Transform -> Respond to Webhook
2. **HTTP API Integration**
   - Fetch from REST APIs -> Transform -> Store/Use
   - Pattern: Trigger -> HTTP Request -> Transform -> Action -> Error Handler
3. **Database Operations**
   - Read/Write/Sync database data
   - Pattern: Schedule -> Query -> Transform -> Write -> Verify
4. **AI Agent Workflow**
   - AI agents with dynamic tools and memory
   - Pattern: Trigger -> AI Agent (Model + Tools + Memory) -> Output
5. **Scheduled Tasks**
   - Recurring automation workflows
   - Pattern: Schedule -> Fetch -> Process -> Deliver -> Log
6. **Batch & Loop Processing**
   - Process large datasets in chunks with rate limits and pagination
   - Pattern: Prepare Items -> Loop Over Items -> Process Batch -> Accumulate -> Aggregate
   - Full specification: [references/official-loop-patterns.md](references/official-loop-patterns.md)

---

## Official n8n Loop Patterns (v1.0+)

Modern n8n replaces legacy batching with the official **`Loop Over Items`** node.

### Loop Architecture

```text
[Input Items] -> [Loop Over Items (Batch Size: N)]
                     | (loop: main[1])      | (done: main[0])
                     v                      v
             [Process Batch Items]     [Final Aggregate / Done]
                     |
                     v
             (Connects back to Loop input)
```

### Essential Rules for Resilient Loops:

1. **Never Loop Infinitely:** The last node in the loop body must connect strictly to the input of `Loop Over Items`. Never connect back to a node _before_ the loop node.
2. **Cross-Iteration Accumulation:** Nodes outside the loop only see the last batch. Use the `Aggregate` node connected to the `done` output, or `$getWorkflowStaticData('global')` in a Code node to accumulate items across all passes.
3. **Throttling & Rate Limits:** Insert a `Wait` node (e.g. 500ms) inside the loop body when updating third-party APIs to prevent HTTP 429 rate-limit blocks.
4. **Per-Item Fault Tolerance:** Set `Continue On Fail` on inner HTTP nodes so one corrupt item does not abort the entire batch.

See [references/official-loop-patterns.md](references/official-loop-patterns.md) for complete cursor-based pagination, offset incrementing, and code snippets.

---

## Human-in-the-Loop & Approval Bridges

When an automation requires human verification (e.g. approving a payout, verifying an API key, or handling MFA):

1. **The `Wait` Node (Resume on Webhook):**
   - Set the `Wait` node to "On Webhook Call".
   - n8n pauses workflow execution, persists state to disk/database, and releases worker memory.
   - Send the generated resume URL (`$execution.resumeUrl`) to Discord or email.
   - When the user clicks the link or submits a form, execution resumes instantly from that exact state.
2. **AIOS Wizard Bridge:**
   - For local operator setups, pair the workflow with an interactive CLI wizard via [manual-setup-walkthrough](../manual-setup-walkthrough/SKILL.md).

---

## Workflow Creation & Deployment Lifecycle

Before activating any workflow, follow the 4-gate verification sequence:

1. **Validate:** Check node parameters, required credentials, expressions, and schemas.
2. **Verify Connections:** Inspect node wiring. Confirm `loop` and `done` branches connect to their correct downstream targets.
3. **Test with Dry Run:** Execute against test data. Real side effects fire during tests (emails send, database writes commit); verify carefully before testing write nodes.
4. **Activate:** Set the workflow to Active. Monitor the first 3 automatic executions via the executions dashboard.

_Testing Gotcha:_ The **`Error Trigger`** node only fires on _automatic_ scheduled or webhook executions. It will never trigger during manual test clicks in the editor.

---

## Supporting References

- **Skeletons & Templates:** [references/quick-start-examples.md](references/quick-start-examples.md)
- **Official Loop & Batch Patterns:** [references/official-loop-patterns.md](references/official-loop-patterns.md)
- **Local Windows 11 Setup Guide:** [references/local-setup-guide.md](references/local-setup-guide.md)
