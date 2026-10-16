# Qt build branch (any PySide6 or Qt Widgets app)

How to build Qt screens that pass [`design-audit`](../../design-audit/SKILL.md) and its [`qt-audit.md`](../../design-audit/references/qt-audit.md). Values come from one token module per app; never type a hex in a view. A new Qt app starts by copying [`tokens.css`](../../../../projects/leonidas-command-center/src/tokens.css) values into a Python dict, the way Leonidas Scribe's [`styles.py`](../../../../projects/leonidas-scribe/ui/styles.py) `T` does. Scribe is the reference implementation named in the examples below. Distilled 2026-09-27 from apple-desktop-designer and qt-ui-design, with their off-canon indigo palette dropped.

## 1. Reuse before inventing

Check the app's shared widget module first. In Scribe that is [`widgets.py`](../../../../projects/leonidas-scribe/ui/widgets.py): `page_header`, `make_card`, `setting_row`, `setting_group`, `section_label`, `kpi_tile`, `button(kind="GhostBtn")`, `ToggleSwitch`, plus [`charts.py`](../../../../projects/leonidas-scribe/ui/charts.py) (`BarList`, `DayBars`) and [`motion.py`](../../../../projects/leonidas-scribe/ui/motion.py). A new pattern used on two pages moves into the shared module. A new app with no helpers gets `page_header`, `make_card` and `setting_row` equivalents first, copied from Scribe.

## 2. Page skeleton

```python
page = QWidget(); outer = QVBoxLayout(page); outer.setContentsMargins(0, 0, 0, 0)
scroll = QScrollArea(); scroll.setWidgetResizable(True)
scroll.setFrameShape(QFrame.Shape.NoFrame)
scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
body = QWidget(); v = QVBoxLayout(body); v.setContentsMargins(24, 20, 24, 24); v.setSpacing(12)
v.addLayout(page_header("Title", "One line saying what this page is for"))
# cards...
v.addStretch(1); scroll.setWidget(body); outer.addWidget(scroll)
```

Window: `setMinimumSize(760, 560)` on the top-level window. Card padding 16, gaps 12, radius 12 (design system).

## 3. Rows that never clip

- A row holds at most about 5 widgets. Status goes on one row, actions on another, or actions collapse into a menu button.
- Variable text gets either `setWordWrap(True)` or an elided label with the full text in its tooltip:

```python
class ElideLabel(QLabel):
    def resizeEvent(self, e):
        full = self.property("full") or self.text()
        self.setProperty("full", full)
        self.setText(self.fontMetrics().elidedText(full, Qt.ElideRight, self.width()))
        self.setToolTip(full); super().resizeEvent(e)
```

- Live states (gates, engine, queue) render as chips in a wrapping row, not as one long sentence. One chip per state, a colored left edge by role (gold attention, success ok, error failing), always with a text label.

## 4. Tables and history lists

- Hairline row dividers only, no grid; styled header; `verticalHeader().hide()`; row height about 36; tabular numbers (JetBrains Mono) for time and counts.
- Long logs: filter chips above (tier, status, source), newest first, relative time ("4 min ago") with the absolute time in the tooltip, and a detail pane on selection rather than squeezing every field into columns.
- Empty and filtered-empty states say what would appear and how.

## 5. Settings pages

- Group into cards by the question the user asks ("How does he sound?", "When may he talk?"), not by implementation.
- Every control has a hint line and a tooltip; saving is one save bar at the bottom (the existing Settings pattern) or instant with in-place "Saved" feedback, never both on one page.
- Remove knobs nobody changes; hardcode their safe default in code with a comment.

## 6. Feedback and threading

- HTTP or disk work runs off the UI thread (`QThread` or a worker plus signals). The UI shows progress within 400 ms.
- Buttons confirm in place for about 1.5 s ("Saved", "Copied"), then revert. Errors become a readable line with a next step, never a raw exception.

## 7. Keyboard and access

`setTabOrder` through every control, cyan focus ring via `:focus` in the global sheet, `setAccessibleName` plus `setToolTip` on icon-only buttons. Mouse4 and Mouse5 are `Qt.MouseButton.XButton1` and `XButton2`; hotkey capture commits only after a non-modifier key, and Escape cancels.

## 8. See it live

Relaunch (or use the app's reload path), then screenshot with the `grab()` snippet from [`qt-audit.md`](../../design-audit/references/qt-audit.md). Scribe self-restarts about 16 s after a `.py` save once idle ([`projects/leonidas-scribe/agent-playbook.md`](../../../../projects/leonidas-scribe/agent-playbook.md)).
