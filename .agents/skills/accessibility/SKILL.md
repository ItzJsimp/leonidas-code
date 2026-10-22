---
name: accessibility
description: "Audit and fix web accessibility: WCAG 2.2 AA, keyboard use, screen readers, contrast, focus. Use when building or reviewing UI, forms or interactive controls."
category: design
scope: structural
distribution: core
license: MIT
---

# Web Accessibility & WCAG Compliance

Audit, test, and implement digital accessibility best practices across user interfaces to achieve WCAG 2.2 Level AA compliance.

## Quick Reference

Comprehensive criteria and test patterns live in [`references/WCAG.md`](./references/WCAG.md).

## Core Principles

1. **Perceivable:** Provide text alternatives for non-text content, captions for multimedia, and maintain 4.5:1 contrast for standard text (3:1 for large text).
2. **Operable:** Make all functionality available via keyboard alone, avoid keyboard traps, provide clear focus indicators, and ensure skip-to-content links exist.
3. **Understandable:** Use clear language, predictable navigation, and actionable form error messages.
4. **Robust:** Use valid semantic HTML elements (`<main>`, `<nav>`, `<button>`, `<dialog>`) and standard ARIA roles only when semantic elements cannot fulfill the requirement.
