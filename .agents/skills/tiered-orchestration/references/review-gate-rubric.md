# Orchestrator Review Gate

Review every delegated result before integrating it.

1. Inspect the exact file list and diff. Confirm the worker stayed within its assignment and preserve unrelated workspace changes.
2. Check the implementation against the task brief and relevant interfaces.
3. Probe relevant edge cases, invalid or missing data, errors, async behavior, and resource cleanup.
4. Run focused checks only when the user authorizes them and project instructions permit them. Report checks not run.
5. Correct confirmed omissions, integrate the work, and report accepted changes and remaining limits.

A worker's completion claim is not evidence by itself. Do not use broad resets to remove out-of-scope edits. Inspect before changing files with unclear ownership.
