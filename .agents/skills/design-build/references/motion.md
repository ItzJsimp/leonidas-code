# Motion: when it earns its place

Distilled 2026-09-27 from Emil Kowalski's design engineering, Apple's fluid-interface principles and qt-ui-design. Budgets are canon in [`app-building-standard.md`](../../../../standards/app-building-standard.md) section 6; this file decides _whether_ and _how_ to animate.

## 1. Should it animate at all? (frequency decides)

| How often Jake sees it                                             | Decision                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| 100+ times a day (hotkeys, palette toggle, tab switch by keyboard) | Never animate. Raycast opens instantly for this reason |
| Tens of times a day (hover, list navigation)                       | Micro only (150 ms), or none                           |
| Occasionally (dialogs, drawers, toasts, cards arriving)            | Entrance (240 ms)                                      |
| Rarely (task completed, decision approved, first run)              | Celebration allowed (up to 900 ms)                     |

## 2. It needs a purpose

Valid: spatial consistency (it leaves the way it came), state change (a button morphs to "Saved"), feedback (a press compresses), or softening a jarring change (content swapping in place). "It looks cool" on a frequent action is not a purpose.

## 3. Easing and physics

- Entering or responding: strong ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`. Moving on screen: ease-in-out, `cubic-bezier(0.77, 0, 0.175, 1)`. Never ease-in for UI: it feels late.
- Interruptible beats perfect: a new input mid-animation must redirect it, not wait for it (CSS transitions over keyframes on web; restart the `QPropertyAnimation` from the current value in Qt).
- Nothing appears from nothing: start at `scale(0.95)` plus `opacity: 0`, never `scale(0)`. Popovers grow from their trigger; modals stay centered.
- Animate opacity and transform only. Geometry animation causes layout jank on web and fights layout managers in Qt.
- Press feedback: `scale(0.97)` on web; a one-step darker fill (`crimson_press`) in Qt.

## 4. Speed is perception

A 180 ms dropdown feels faster than a 400 ms one with the same load time. Skip tooltip delay after the first tooltip in a toolbar has opened. Anything over 1 s shows progress; over 10 s shows an estimate.

## 5. Sound and Calm

Earcons for approve, complete, error and spawn only (app-building-standard 6). The Calm switch turns off ambient motion, celebrations and sound in one move; in Scribe every animation goes through [`motion.py`](../../../../projects/leonidas-scribe/ui/motion.py) so `motion.enabled()` is honoured.

## Review format

When reviewing motion, use one table:

| Before                  | After                                        | Why                                       |
| ----------------------- | -------------------------------------------- | ----------------------------------------- |
| `transition: all 300ms` | `transition: opacity 150ms, transform 150ms` | List properties; stay on the micro budget |
