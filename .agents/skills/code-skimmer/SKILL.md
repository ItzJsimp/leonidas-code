---
name: code-skimmer
description: "Read a large code file as a symbol outline, then open only the needed line range. Use before reading any code file over 300 lines or when finding a function in a big file."
category: efficiency
scope: structural
distribution: core
license: MIT
---

# Code Skimmer: AST Symbol & File Outline Engine

High-speed zero-dependency AST symbol skimmer for Python, TypeScript, JavaScript, PowerShell, and Markdown files.

Use this skill whenever an agent is about to inspect a file over 100 lines. Instead of running `view_file` on the entire file (which costs 2,000 to 10,000 tokens per turn), skim the symbol outline first (<200 tokens), identify target function/class line spans, and read only the required line slice via `StartLine` and `EndLine`.

---

## When to Use

- Inspecting large source code files (>100 lines) before editing or debugging.
- Locating function definitions, class structures, or markdown sections.
- Avoiding context window snowballing on long debugging sessions.
- Triggers: `/code-skimmer`, `skim <file>`, `outline <file>`.

---

## Usage

Run the skimmer script directly:

```powershell
# Format as a human-readable table with line spans
python scripts/get-symbol-outline.py path/to/file.py

# Format as structured JSON
python scripts/get-symbol-outline.py path/to/file.ts --json

# Run unit verification
python scripts/get-symbol-outline.py --selftest
```

### Supported Languages

1. **Python (`.py`):** Uses Python standard library `ast` to map classes, methods, synchronous and asynchronous functions, and nested classes with exact start and end line bounds.
2. **TypeScript / JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`):** Regex scanner for exported functions, classes, interfaces, types, and const arrow functions.
3. **PowerShell (`.ps1`, `.psm1`):** Regex scanner for `function`, `filter`, `class`, and `configuration`.
4. **Markdown (`.md`):** Heading hierarchy scanner (`#`, `##`, `###`).

---

## 2-Step Inspection Workflow

1. **Step 1 (Skim Symbol Map):**

   ```bash
   python scripts/get-symbol-outline.py scripts/get-harness-tokens.py
   ```

   _Output:_

   ```text
   Kind         | Lines        | Symbol Name
   -------------|--------------|-----------------------------------------
   def          | L16-L100     | parse_protobuf_metrics
   def          | L102-L172    | get_antigravity_data
   ```

2. **Step 2 (Targeted View):**
   Call `view_file` with explicit bounds (e.g. `StartLine: 16`, `EndLine: 100`).
   _Token savings:_ 85% to 95% reduction vs full file read.
