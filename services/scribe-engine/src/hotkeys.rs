//! Global hotkeys (Windows low-level hooks). Slice S2.

use std::time::Instant;

/// One trigger from the user. `Instant` is taken inside the hook callback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyEvent {
    HoldDown(Instant),
    HoldUp(Instant),
    Toggle(Instant),
    Cancel,
}
