# n8n Quick Start Examples

Five minimal, copy-ready workflow skeletons - one per core pattern.

---

## Quick Start Examples

### Example 1: Simple Webhook → Slack

```
1. Webhook (path: "form-submit", POST)
2. Set (map form fields)
3. Slack (post message to #notifications)
```

### Example 2: Scheduled Report

```
1. Schedule (daily at 9 AM)
2. HTTP Request (fetch analytics)
3. Code (aggregate data)
4. Email (send formatted report)
5. Error Trigger → Slack (notify on failure)
```

### Example 3: Database Sync

```
1. Schedule (every 15 minutes)
2. Postgres (query new records)
3. IF (check if records exist)
4. MySQL (insert records)
5. Postgres (update sync timestamp)
```

### Example 4: AI Assistant

```
1. Webhook (receive chat message)
2. AI Agent
   ├─ OpenAI Chat Model (ai_languageModel)
   ├─ HTTP Request Tool (ai_tool)
   ├─ Database Tool (ai_tool)
   └─ Window Buffer Memory (ai_memory)
3. Webhook Response (send AI reply)
```

### Example 5: API Integration

```
1. Manual Trigger (for testing)
2. HTTP Request (GET /api/users)
3. Split In Batches (process 100 at a time)
4. Set (transform user data)
5. Postgres (upsert users)
6. Loop (back to step 3 until done)
```

---

---

## Pattern Statistics

Common workflow patterns:

**Most Common Triggers**:

1. Webhook - 35%
2. Schedule (periodic tasks) - 28%
3. Manual (testing/admin) - 22%
4. Service triggers (Slack, email, etc.) - 15%

**Most Common Transformations**:

1. Set (field mapping) - 68%
2. Code (custom logic) - 42%
3. IF (conditional routing) - 38%
4. Switch (multi-condition) - 18%

**Most Common Outputs**:

1. HTTP Request (APIs) - 45%
2. Slack - 32%
3. Database writes - 28%
4. Email - 24%

**Average Workflow Complexity**:

- Simple (3-5 nodes): 42%
- Medium (6-10 nodes): 38%
- Complex (11+ nodes): 20%

---

## Quick Start Examples

### Example 1: Simple Webhook → Slack

```
1. Webhook (path: "form-submit", POST)
2. Set (map form fields)
3. Slack (post message to #notifications)
```

### Example 2: Scheduled Report

```
1. Schedule (daily at 9 AM)
2. HTTP Request (fetch analytics)
3. Code (aggregate data)
4. Email (send formatted report)
5. Error Trigger → Slack (notify on failure)
```

### Example 3: Database Sync

```
1. Schedule (every 15 minutes)
2. Postgres (query new records)
3. IF (check if records exist)
4. MySQL (insert records)
5. Postgres (update sync timestamp)
```

### Example 4: AI Assistant

```
1. Webhook (receive chat message)
2. AI Agent
   ├─ OpenAI Chat Model (ai_languageModel)
   ├─ HTTP Request Tool (ai_tool)
   ├─ Database Tool (ai_tool)
   └─ Window Buffer Memory (ai_memory)
3. Webhook Response (send AI reply)
```

### Example 5: API Integration

```
1. Manual Trigger (for testing)
2. HTTP Request (GET /api/users)
3. Split In Batches (process 100 at a time)
4. Set (transform user data)
5. Postgres (upsert users)
6. Loop (back to step 3 until done)
```

---

## Detailed Pattern Files

For comprehensive guidance on each pattern:

- `webhook_processing.md` (planned) - Webhook patterns, data structure, response handling
- `http_api_integration.md` (planned) - REST APIs, authentication, pagination, retries
- `database_operations.md` (planned) - Queries, sync, transactions, batch processing
- `ai_agent_workflow.md` (planned) - AI agents, tools, memory, langchain nodes
- `scheduled_tasks.md` (planned) - Cron schedules, reports, maintenance tasks

---

---

## Real Template Examples

From n8n template library:

**Template #2947**: Weather to Slack

- Pattern: Scheduled Task
- Nodes: Schedule → HTTP Request (weather API) → Set → Slack
- Complexity: Simple (4 nodes)

**Webhook Processing**: Most common pattern

- Most common: Form submissions, payment webhooks, chat integrations

**HTTP API**: Common pattern

- Most common: Data fetching, third-party integrations

**Database Operations**: Common pattern

- Most common: ETL, data sync, backup workflows

**AI Agents**: Growing in usage

- Most common: Chatbots, content generation, data analysis

Use `search_templates` and `get_template` from n8n-mcp tools to find examples!

---
