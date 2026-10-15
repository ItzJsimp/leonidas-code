# Official n8n Loop & Batch Processing Patterns

Authoritative patterns for iterative processing in n8n (v1.0+), covering the `Loop Over Items` node, pagination accumulators, rate-limit throttling, and infinite-loop prevention.

---

## 1. Loop Over Items vs. Split In Batches

In modern n8n (v1.0+), the official node is **`Loop Over Items`** (internally `n8n-nodes-base.splitInBatches`).

### Node Outputs

- **`loop` output (top / main[1]):** Fires once per batch/item. Connect this to the nodes that perform the repeated work.
- **`done` output (bottom / main[0]):** Fires once after ALL items or batches have been processed. Connect this to downstream aggregators or notifications.

```text
[Incoming Data (100 items)]
        |
        v
[Loop Over Items (Batch Size: 10)]
    |                     \
    | (done)               \ (loop)
    v                       v
[Final Summary]        [Process Batch]
                            |
                            v
                       [HTTP Call / Transform]
                            |
                            v
                       (Loops back to Loop Over Items input)
```

---

## 2. Preventing Runaway & Infinite Loops

Without a deterministic termination condition, loops will cycle infinitely and exhaust server memory or API quotas.

### The 4 Loop Invariants:

1. **Always Loop Back to the Loop Node:** The final node in your loop body MUST connect back to the input of the `Loop Over Items` node.
2. **Never Connect to Nodes Before the Loop:** Looping back to a node _before_ the `Loop Over Items` node re-injects the original data and causes an infinite loop.
3. **Handle Empty Arrays Gracefully:** If an upstream API returns an empty array `[]`, the `done` branch fires immediately. Ensure downstream nodes handle empty input without throwing null reference errors.
4. **Enforce Hard Circuit Breaker on Dynamic Loops:** For pagination loops where the total count is unknown, use an `IF` node checking `$runIndex > 50` to abort if an API pagination token never terminates.

---

## 3. Pagination Patterns

### Pattern A: Cursor-Based Pagination

Used by modern APIs (Slack, Stripe, Twitter, GitHub):

```text
[Set Initial Cursor: null]
        |
        v
[HTTP Request: GET /items?cursor={{$json.cursor}}]
        |
        v
[IF: Does $json.next_cursor exist?]
    |                     \
    | (true)               \ (false)
    v                       v
[Update Cursor]         [Done: Process All Items]
    |
    v
(Loops back to HTTP Request)
```

_Important:_ In cursor loops without `Loop Over Items`, store collected items using `$getWorkflowStaticData('global')` in a Code node so items from previous pages are not lost.

### Pattern B: Offset / Page-Based Pagination

Used by SQL-backed REST APIs (`?page=1&limit=50`):

```javascript
// Code node: Increment page counter
const staticData = $getWorkflowStaticData("global");
staticData.currentPage = (staticData.currentPage || 1) + 1;
return [{ json: { page: staticData.currentPage } }];
```

---

## 4. Cross-Iteration Data Accumulation

A major gotcha in n8n loops: referencing an upstream node with `$('Node Name').all()` from outside the loop **only returns the items from the final batch**.

### Two Solutions for Accumulation:

#### Solution 1: The Aggregate Node (Recommended)

Connect the `done` output of `Loop Over Items` to the `Aggregate` node. Set aggregate fields to merge items from the loop body into a single combined array.

#### Solution 2: Static Data Accumulator (Code Node)

Inside the loop body, append processed items to global workflow memory:

```javascript
// In a Code node inside the loop
const staticData = $getWorkflowStaticData("global");
if (!staticData.allItems) {
  staticData.allItems = [];
}

const currentItems = $input.all().map((item) => item.json);
staticData.allItems.push(...currentItems);

return $input.all();
```

_Reset Note:_ Clear `staticData.allItems = []` in an initialization node before the loop starts to avoid data bleeding across workflow runs.

---

## 5. Rate Limiting & Error Isolation

### Rate-Limit Throttling:

When processing hundreds of items against strict third-party rate limits (e.g. 5 requests/sec):

- Insert a **`Wait`** node in the loop body set to `500ms` or `1s`.
- Set batch size to match API limits (e.g. batch size 50 for bulk endpoints, batch size 1 for single-resource updates).

### Error Isolation (Per-Item Fault Tolerance):

- Enable **`Continue On Fail`** in the settings of the HTTP/Action node inside the loop.
- Use an `IF` node immediately after:
  - If `$json.error` exists -> route to a "Log Failed Item" branch.
  - If success -> continue normal loop flow.
- This ensures one 404 or bad payload does not abort the remaining 99 items.
